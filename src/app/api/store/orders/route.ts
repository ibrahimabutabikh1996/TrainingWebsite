import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientAddress, consumeAttempt } from "@/lib/rateLimit";
import { getActiveProducts, getStoreSettings, isMissingTable } from "@/lib/store/catalog";
import {
  IRAQ_GOVERNORATES,
  MAX_LINE_QTY,
  deliveryFeeFor,
  isInIraq,
  isOrderReference,
  normalizeIraqiPhone,
  pointsFor,
  priceFor,
  type OrderItem,
} from "@/lib/store/types";

/* The store's checkout.
 *
 * Public on purpose — buying needs no account. The cart has already opened
 * WhatsApp with the order by the time this answers (a popup has to be opened
 * inside the click, not after a request), so this is the panel's record of it,
 * not the order itself. That is also why nothing the browser says about money
 * is believed: every price and the delivery fee are worked out again here from
 * the catalogue, and what the coach sees in the panel is this figure.
 *
 * Rate limited per address: an open endpoint that writes rows is one a script
 * could fill. */

const ORDER_LIMIT = { max: 10, windowMinutes: 15 };
const MAX_LINES = 30;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  const limit = await consumeAttempt(`store-order:${clientAddress(request)}`, ORDER_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "طلبات كثيرة، حاول بعد قليل" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "صيغة الطلب غير صحيحة" }, { status: 400 });
  }

  const reference = body.reference;
  const name = text(body.customer_name, 80);
  const phone = normalizeIraqiPhone(text(body.customer_phone, 20));
  const city = text(body.city, 40);
  const address = text(body.address, 300);
  const notes = text(body.notes, 500);

  if (!isOrderReference(reference)) return NextResponse.json({ error: "رقم الطلب غير صالح" }, { status: 400 });
  if (name.length < 2) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "رقم الهاتف غير صحيح" }, { status: 400 });
  if (!(IRAQ_GOVERNORATES as readonly string[]).includes(city)) {
    return NextResponse.json({ error: "اختر المحافظة" }, { status: 400 });
  }
  if (address.length < 4) return NextResponse.json({ error: "العنوان مطلوب" }, { status: 400 });
  const location = isInIraq(body.location)
    ? { lat: Number((body.location as { lat: number }).lat), lng: Number((body.location as { lng: number }).lng) }
    : null;
  if (!location) return NextResponse.json({ error: "حدّد موقع التوصيل على الخريطة" }, { status: 400 });

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_LINES) {
    return NextResponse.json({ error: "السلة فارغة" }, { status: 400 });
  }

  const [products, settings] = await Promise.all([getActiveProducts(), getStoreSettings()]);
  if (!settings.store_open) {
    return NextResponse.json({ error: "المتجر مغلق حالياً" }, { status: 409 });
  }

  const items: OrderItem[] = [];
  for (const raw of body.items) {
    if (!raw || typeof raw !== "object") continue;
    const line = raw as Record<string, unknown>;
    const product = products.find((p) => p.id === line.productId);
    if (!product) {
      return NextResponse.json({ error: "أحد المنتجات لم يعد متوفراً" }, { status: 409 });
    }
    const qty = Math.floor(Number(line.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_LINE_QTY) {
      return NextResponse.json({ error: "كمية غير صحيحة" }, { status: 400 });
    }
    const size = typeof line.size === "string" && product.sizes.some((s) => s.label === line.size) ? line.size : null;
    const flavor = typeof line.flavor === "string" && product.flavors.includes(line.flavor) ? line.flavor : null;
    items.push({
      productId: product.id,
      name: product.name,
      size,
      flavor,
      unitPrice: priceFor(product, size),
      qty,
    });
  }
  if (items.length === 0) return NextResponse.json({ error: "السلة فارغة" }, { status: 400 });

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const delivery_fee = deliveryFeeFor(subtotal, settings);
  const total = subtotal + delivery_fee;
  const points_earned = pointsFor(subtotal, settings);

  try {
    /* One customer per phone number. The newest order's name and address are
       the ones kept — people move, and correct a typo the second time. The
       order and its customer are written together or not at all. */
    await prisma.$transaction(async (tx) => {
      const customer = await tx.store_customers.upsert({
        where: { phone },
        update: { name, city, address },
        create: { phone, name, city, address },
        select: { id: true },
      });
      await tx.store_orders.create({
        data: {
        reference,
        customer_id: customer.id,
        location_lat: location.lat,
        location_lng: location.lng,
        points_earned,
        customer_name: name,
        customer_phone: phone,
        city,
        address,
        notes: notes || null,
        items: items as unknown as object,
        subtotal,
        delivery_fee,
        total,
        },
      });
    });
    return NextResponse.json({ ok: true, recorded: true, reference, subtotal, delivery_fee, total, points_earned });
  } catch (error) {
    /* The same reference twice is a retried request — already recorded. */
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json({ ok: true, recorded: true, reference, subtotal, delivery_fee, total });
    }
    if (!isMissingTable(error)) console.error("[store] Failed to record order:", error);
    /* The order went to WhatsApp regardless; say so rather than fail it. */
    return NextResponse.json({ ok: true, recorded: false, reference, subtotal, delivery_fee, total });
  }
}
