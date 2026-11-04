"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminAction } from "@/lib/authGuard";
import { isMissingTable, STORE_SETTINGS_ID, toProduct } from "@/lib/store/catalog";
import { getCustomerDetail } from "./data";
import {
  isOrderStatus,
  isStoreCategory,
  normalizeSettings,
  type OrderItem,
  type StoreProduct,
  type StoreSettings,
} from "@/lib/store/types";

/* The store panel's writes. The coach only: `requireAdminAction()` with no
 * permission named admits nobody else, the same rule as analytics and staff
 * management. A server action is a public endpoint, so every field is checked
 * again here whatever the form allowed. */

const MAX_IMAGES = 8;

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string };

const DENIED = { success: false as const, error: "غير مصرح لك بهذا الإجراء" };
const NO_TABLES = {
  success: false as const,
  error: "جداول المتجر غير موجودة بعد — شغّل ملف prisma/manual/2026-11-04-store.sql في Supabase",
};

function failure(error: unknown, fallback: string): { success: false; error: string } {
  if (isMissingTable(error)) return NO_TABLES;
  console.error(`[store] ${fallback}:`, error);
  return { success: false, error: fallback };
}

function revalidateStore(slug?: string) {
  revalidatePath("/store");
  if (slug) revalidatePath(`/store/${slug}`);
  revalidatePath("/admin/store", "layout");
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const money = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 100_000_000 ? n : null;
};

function slugify(value: string): string {
  const latin = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return latin.slice(0, 60);
}

/* ------------------------------------------------------------------ *
 * Products
 * ------------------------------------------------------------------ */

export type ProductInput = Omit<StoreProduct, "id"> & { id?: string | null };

function cleanProduct(input: ProductInput): { ok: true; data: Omit<StoreProduct, "id"> } | { ok: false; error: string } {
  const name = text(input.name, 120);
  if (name.length < 2) return { ok: false, error: "اسم المنتج مطلوب" };

  const category = isStoreCategory(input.category) ? input.category : null;
  if (!category) return { ok: false, error: "اختر قسم المنتج" };

  const sizes = (Array.isArray(input.sizes) ? input.sizes : [])
    .map((s) => ({ label: text(s?.label, 40), price: money(s?.price) }))
    .filter((s): s is { label: string; price: number } => !!s.label && s.price !== null)
    .slice(0, 8);

  const price = sizes[0]?.price ?? money(input.price);
  if (price === null || price <= 0) return { ok: false, error: "السعر مطلوب" };

  const compare = input.compare_at_price === null || input.compare_at_price === undefined || (input.compare_at_price as unknown) === ""
    ? null
    : money(input.compare_at_price);

  const stockRaw = input.stock as unknown;
  const stock = stockRaw === null || stockRaw === undefined || stockRaw === "" ? null : Math.max(0, Math.floor(Number(stockRaw)));
  if (stock !== null && !Number.isFinite(stock)) return { ok: false, error: "المخزون غير صحيح" };

  const accent = /^#[0-9a-fA-F]{6}$/.test(String(input.accent)) ? String(input.accent) : "#60A5FA";

  const images = (Array.isArray(input.images) ? input.images : input.image_url ? [input.image_url] : [])
    .map((u) => text(u, 1000))
    .filter(Boolean)
    .slice(0, MAX_IMAGES);
  if (images.some((u) => !/^(https:\/\/|\/)/.test(u))) return { ok: false, error: "رابط صورة غير صالح" };
  const threshold = Math.max(0, Math.min(10_000, Math.floor(Number(input.low_stock_threshold) || 0)));

  const slugSource = text(input.slug, 60) || slugify(name);
  const slug = slugify(slugSource) || `product-${Date.now().toString(36)}`;

  return {
    ok: true,
    data: {
      slug,
      name,
      tagline: text(input.tagline, 160),
      category,
      brand: text(input.brand, 80),
      description: text(input.description, 3000),
      price,
      compare_at_price: compare && compare > price ? compare : null,
      image_url: images[0] ?? null,
      images,
      accent,
      highlights: (input.highlights ?? [])
        .map((h) => ({ value: text(h?.value, 20), label: text(h?.label, 40) }))
        .filter((h) => h.value)
        .slice(0, 4),
      features: (input.features ?? [])
        .map((f) => ({ title: text(f?.title, 80), text: text(f?.text, 400) }))
        .filter((f) => f.title || f.text)
        .slice(0, 6),
      usage: (input.usage ?? []).map((u) => text(u, 300)).filter(Boolean).slice(0, 8),
      nutrition: (input.nutrition ?? [])
        .map((n) => ({ label: text(n?.label, 60), value: text(n?.value, 40) }))
        .filter((n) => n.label)
        .slice(0, 16),
      ingredients: text(input.ingredients, 2000),
      flavors: (input.flavors ?? []).map((f) => text(f, 40)).filter(Boolean).slice(0, 12),
      sizes,
      stock,
      low_stock_threshold: threshold,
      is_active: input.is_active !== false,
      is_featured: input.is_featured === true,
      sort_order: Number.isFinite(Number(input.sort_order)) ? Math.floor(Number(input.sort_order)) : 0,
    },
  };
}

export async function saveProduct(input: ProductInput): Promise<Result<StoreProduct>> {
  if (!(await requireAdminAction())) return DENIED;
  if (!input || typeof input !== "object") return { success: false, error: "صيغة غير صحيحة" };

  const cleaned = cleanProduct(input);
  if (!cleaned.ok) return { success: false, error: cleaned.error };
  const data = cleaned.data;
  const id = typeof input.id === "string" && /^[0-9a-f-]{36}$/i.test(input.id) ? input.id : null;

  try {
    /* A slug already taken by another product gets a short suffix. */
    const clash = await prisma.store_products.findFirst({
      where: { slug: data.slug, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    if (clash) data.slug = `${data.slug}-${Math.random().toString(36).slice(2, 6)}`;

    const json = {
      ...data,
      highlights: data.highlights as object,
      features: data.features as object,
      usage: data.usage as object,
      nutrition: data.nutrition as object,
      sizes: data.sizes as object,
    };

    /* A stock figure changed in the editor is a count, and goes in the log
       like one from the inventory screen. */
    const before = id ? await prisma.store_products.findUnique({ where: { id }, select: { stock: true } }) : null;
    const row = await prisma.$transaction(async (tx) => {
      const saved = id
        ? await tx.store_products.update({ where: { id }, data: json })
        : await tx.store_products.create({
            data: {
              ...json,
              sort_order: data.sort_order || ((await tx.store_products.count()) + 1),
            },
          });
      const previous = before?.stock ?? null;
      if (!id ? saved.stock !== null : previous !== saved.stock) {
        await tx.store_stock_movements.create({
          data: {
            product_id: saved.id,
            change: (saved.stock ?? 0) - (previous ?? 0),
            stock_after: saved.stock,
            reason: !id ? "restock" : saved.stock === null || previous === null ? "tracking" : "count",
            note: !id ? "الكمية الافتتاحية" : "تعديل من محرر المنتج",
          },
        });
      }
      return saved;
    });
    revalidateStore(row.slug);
    return { success: true, data: toProduct(row) };
  } catch (error) {
    return failure(error, "تعذّر حفظ المنتج");
  }
}

export async function setProductFlag(id: string, flag: "is_active" | "is_featured", value: boolean): Promise<Result> {
  if (!(await requireAdminAction())) return DENIED;
  if (flag !== "is_active" && flag !== "is_featured") return { success: false, error: "حقل غير صالح" };
  try {
    const row = await prisma.store_products.update({ where: { id: String(id) }, data: { [flag]: value === true } });
    revalidateStore(row.slug);
    return { success: true };
  } catch (error) {
    return failure(error, "تعذّر تحديث المنتج");
  }
}

export async function deleteProduct(id: string): Promise<Result> {
  if (!(await requireAdminAction())) return DENIED;
  try {
    const row = await prisma.store_products.delete({ where: { id: String(id) } });
    revalidateStore(row.slug);
    return { success: true };
  } catch (error) {
    return failure(error, "تعذّر حذف المنتج");
  }
}

/* ------------------------------------------------------------------ *
 * Orders
 * ------------------------------------------------------------------ */

/**
 * Moves an order along, and with it the stock and the customer's points.
 *
 * Stock is taken when the coach confirms (or delivers) an order — not when the
 * customer sends it, since an unanswered WhatsApp message is not a sale — and
 * given back if a taken order is cancelled. Points land on the customer's
 * balance when the order is delivered, and come off again if a delivered order
 * is moved back. Every one of those changes is written to its log, inside the
 * same transaction as the status.
 */
export async function updateOrderStatus(id: string, status: string): Promise<Result> {
  if (!(await requireAdminAction())) return DENIED;
  if (!isOrderStatus(status)) return { success: false, error: "حالة غير صالحة" };

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.store_orders.findUnique({ where: { id: String(id) } });
      if (!order) throw new Error("not-found");

      const items = (Array.isArray(order.items) ? order.items : []) as unknown as OrderItem[];
      const takes = (status === "confirmed" || status === "delivered") && !order.stock_applied;
      const gives = (status === "cancelled" || status === "new") && order.stock_applied;

      if (takes || gives) {
        for (const item of items) {
          if (typeof item?.productId !== "string" || !/^[0-9a-f-]{36}$/i.test(item.productId)) continue;
          const qty = Math.max(0, Math.floor(Number(item.qty) || 0));
          if (qty === 0) continue;
          const product = await tx.store_products.findUnique({ where: { id: item.productId }, select: { stock: true } });
          /* Only tracked stock moves; a null stock stays "not tracked". */
          if (!product || product.stock === null) continue;
          const after = takes ? Math.max(0, product.stock - qty) : product.stock + qty;
          await tx.store_products.update({ where: { id: item.productId }, data: { stock: after } });
          await tx.store_stock_movements.create({
            data: {
              product_id: item.productId,
              change: after - product.stock,
              stock_after: after,
              reason: takes ? "order" : "order_reversed",
              order_reference: order.reference,
            },
          });
        }
      }

      const awards = status === "delivered" && !order.points_awarded && order.points_earned > 0 && !!order.customer_id;
      const reverses = status !== "delivered" && order.points_awarded && !!order.customer_id;
      if ((awards || reverses) && order.customer_id) {
        const change = awards ? order.points_earned : -order.points_earned;
        const customer = await tx.store_customers.update({
          where: { id: order.customer_id },
          data: { points: { increment: change } },
          select: { points: true },
        });
        await tx.store_points_log.create({
          data: {
            customer_id: order.customer_id,
            change,
            balance_after: customer.points,
            reason: awards ? "order" : "order_reversed",
            order_reference: order.reference,
          },
        });
      }

      await tx.store_orders.update({
        where: { id: order.id },
        data: {
          status,
          stock_applied: takes ? true : gives ? false : order.stock_applied,
          points_awarded: awards ? true : reverses ? false : order.points_awarded,
        },
      });
    });
    revalidateStore();
    return { success: true };
  } catch (error) {
    if ((error as Error)?.message === "not-found") return { success: false, error: "الطلب غير موجود" };
    return failure(error, "تعذّر تحديث الطلب");
  }
}

export async function deleteOrder(id: string): Promise<Result> {
  if (!(await requireAdminAction())) return DENIED;
  try {
    await prisma.store_orders.delete({ where: { id: String(id) } });
    revalidatePath("/admin/store", "layout");
    return { success: true };
  } catch (error) {
    return failure(error, "تعذّر حذف الطلب");
  }
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export async function saveStoreSettings(input: StoreSettings): Promise<Result<StoreSettings>> {
  if (!(await requireAdminAction())) return DENIED;
  const settings = normalizeSettings(input);
  if (typeof input?.whatsapp === "string" && input.whatsapp.replace(/\D/g, "").length < 8) {
    return { success: false, error: "رقم واتساب غير صحيح — اكتبه بالصيغة الدولية مثل 9647XXXXXXXXX" };
  }
  try {
    await prisma.site_settings.upsert({
      where: { id: STORE_SETTINGS_ID },
      update: { content_ar: settings as unknown as object },
      create: { id: STORE_SETTINGS_ID, content_ar: settings as unknown as object },
    });
    revalidateStore();
    return { success: true, data: settings };
  } catch (error) {
    return failure(error, "تعذّر حفظ الإعدادات");
  }
}

/* ------------------------------------------------------------------ *
 * Inventory
 * ------------------------------------------------------------------ */

export type StockAction =
  | { kind: "restock"; qty: number; note?: string }
  | { kind: "count"; stock: number; note?: string }
  | { kind: "track"; tracked: boolean };

/**
 * One change to a product's stock from the inventory screen: stock received
 * (added to what is there), a count (the shelf is now exactly this), or
 * switching tracking on or off. Returns the new figure.
 */
export async function changeStock(productId: string, action: StockAction): Promise<Result<{ stock: number | null }>> {
  if (!(await requireAdminAction())) return DENIED;
  const note = "note" in action ? text(action.note, 200) || null : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.store_products.findUnique({ where: { id: String(productId) }, select: { stock: true, slug: true } });
      if (!product) throw new Error("not-found");
      const before = product.stock;
      let after: number | null;
      let reason: string;

      if (action.kind === "restock") {
        const qty = Math.floor(Number(action.qty));
        if (!Number.isFinite(qty) || qty <= 0 || qty > 100_000) throw new Error("bad-qty");
        after = (before ?? 0) + qty;
        reason = "restock";
      } else if (action.kind === "count") {
        const stock = Math.floor(Number(action.stock));
        if (!Number.isFinite(stock) || stock < 0 || stock > 1_000_000) throw new Error("bad-qty");
        after = stock;
        reason = "count";
      } else {
        after = action.tracked ? (before ?? 0) : null;
        reason = "tracking";
      }

      if (after === before) return { stock: after, slug: product.slug };

      await tx.store_products.update({ where: { id: String(productId) }, data: { stock: after } });
      await tx.store_stock_movements.create({
        data: {
          product_id: String(productId),
          change: (after ?? 0) - (before ?? 0),
          stock_after: after,
          reason,
          note: action.kind === "track" ? (action.tracked ? "تفعيل تتبع المخزون" : "إيقاف تتبع المخزون") : note,
        },
      });
      return { stock: after, slug: product.slug };
    });
    revalidateStore(result.slug);
    return { success: true, data: { stock: result.stock } };
  } catch (error) {
    const msg = (error as Error)?.message;
    if (msg === "not-found") return { success: false, error: "المنتج غير موجود" };
    if (msg === "bad-qty") return { success: false, error: "الكمية غير صحيحة" };
    return failure(error, "تعذّر تحديث المخزون");
  }
}

export async function setLowStockThreshold(productId: string, threshold: number): Promise<Result> {
  if (!(await requireAdminAction())) return DENIED;
  const value = Math.max(0, Math.min(10_000, Math.floor(Number(threshold) || 0)));
  try {
    await prisma.store_products.update({ where: { id: String(productId) }, data: { low_stock_threshold: value } });
    revalidatePath("/admin/store", "layout");
    return { success: true };
  } catch (error) {
    return failure(error, "تعذّر حفظ حد التنبيه");
  }
}

/* ------------------------------------------------------------------ *
 * Customers
 * ------------------------------------------------------------------ */

/** Adds or takes points by hand — a gift, a correction. Needs a reason. */
export async function adjustCustomerPoints(customerId: string, change: number, note: string): Promise<Result<{ points: number }>> {
  if (!(await requireAdminAction())) return DENIED;
  const delta = Math.trunc(Number(change));
  const reason = text(note, 200);
  if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1_000_000) return { success: false, error: "عدد النقاط غير صحيح" };
  if (reason.length < 2) return { success: false, error: "اكتب سبب التعديل" };

  try {
    const points = await prisma.$transaction(async (tx) => {
      const current = await tx.store_customers.findUnique({ where: { id: String(customerId) }, select: { points: true } });
      if (!current) throw new Error("not-found");
      /* A balance never goes below zero. */
      const applied = Math.max(-current.points, delta);
      const updated = await tx.store_customers.update({
        where: { id: String(customerId) },
        data: { points: { increment: applied } },
        select: { points: true },
      });
      await tx.store_points_log.create({
        data: { customer_id: String(customerId), change: applied, balance_after: updated.points, reason: "manual", note: reason },
      });
      return updated.points;
    });
    revalidatePath("/admin/store", "layout");
    return { success: true, data: { points } };
  } catch (error) {
    if ((error as Error)?.message === "not-found") return { success: false, error: "الزبون غير موجود" };
    return failure(error, "تعذّر تعديل النقاط");
  }
}

export async function saveCustomerNotes(customerId: string, notes: string): Promise<Result> {
  if (!(await requireAdminAction())) return DENIED;
  try {
    await prisma.store_customers.update({ where: { id: String(customerId) }, data: { notes: text(notes, 1000) || null } });
    return { success: true };
  } catch (error) {
    return failure(error, "تعذّر حفظ الملاحظة");
  }
}

/** One customer's orders and points history, for the customer drawer. */
export async function loadCustomer(customerId: string): Promise<Result<NonNullable<Awaited<ReturnType<typeof getCustomerDetail>>>>> {
  if (!(await requireAdminAction())) return DENIED;
  const detail = await getCustomerDetail(String(customerId));
  if (!detail) return NO_TABLES;
  return { success: true, data: detail };
}
