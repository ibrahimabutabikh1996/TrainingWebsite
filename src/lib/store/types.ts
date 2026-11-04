/* The supplements store — the shapes every part of it agrees on.
 *
 * Client-safe on purpose: the storefront, the cart, the panel and the server all
 * import from here, so nothing in this file may reach for the database. The
 * reads live in `@/lib/store/catalog` (server only) and the writes in
 * `@/app/admin/store/actions`.
 *
 * Money is whole Iraqi dinars everywhere — an `Int` column, no fractions, no
 * currency conversion. */

export const STORE_CATEGORIES = [
  { key: "protein", label: "بروتين" },
  { key: "creatine", label: "كرياتين" },
  { key: "preworkout", label: "بري وركاوت" },
  { key: "gainer", label: "زيادة الوزن" },
  { key: "aminos", label: "أحماض أمينية" },
  { key: "vitamins", label: "فيتامينات ومعادن" },
] as const;

export type StoreCategory = (typeof STORE_CATEGORIES)[number]["key"];

export function categoryLabel(key: string): string {
  return STORE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function isStoreCategory(value: unknown): value is StoreCategory {
  return typeof value === "string" && STORE_CATEGORIES.some((c) => c.key === value);
}

/** The container drawn for a product that has no photograph yet. */
export type ProductShape = "tub" | "jar" | "bottle";

export function shapeFor(category: string): ProductShape {
  if (category === "protein" || category === "gainer") return "tub";
  if (category === "vitamins") return "bottle";
  return "jar";
}

export interface ProductHighlight {
  value: string;
  label: string;
}

export interface ProductFeature {
  title: string;
  text: string;
}

export interface ProductFact {
  label: string;
  value: string;
}

export interface ProductSize {
  label: string;
  price: number;
}

export interface StoreProduct {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  brand: string;
  description: string;
  /** The price of the first size, or of the product when it has no sizes. */
  price: number;
  /** A crossed-out "was" price. Shown only when above `price`. */
  compare_at_price: number | null;
  /** The main picture — always `images[0]` when there is a gallery. */
  image_url: string | null;
  /** The gallery, main picture first. Empty draws the container instead. */
  images: string[];
  /** The product's own colour, used to tint its showcase. Data, not a token —
   *  the same standing the plan accents have. */
  accent: string;
  highlights: ProductHighlight[];
  features: ProductFeature[];
  usage: string[];
  nutrition: ProductFact[];
  ingredients: string;
  flavors: string[];
  sizes: ProductSize[];
  /** Null is "not tracked" — always available. Zero is sold out. */
  stock: number | null;
  /** At or under this the inventory screen flags the product. */
  low_stock_threshold: number;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
}

export function isSoldOut(product: Pick<StoreProduct, "stock">): boolean {
  return product.stock !== null && product.stock <= 0;
}

/** The price a given size sells at, falling back to the product's own. */
export function priceFor(product: Pick<StoreProduct, "price" | "sizes">, size?: string | null): number {
  if (size) {
    const match = product.sizes.find((s) => s.label === size);
    if (match) return match.price;
  }
  return product.sizes[0]?.price ?? product.price;
}

/* ------------------------------------------------------------------ *
 * Settings — one row in site_settings, id "store_settings"
 * ------------------------------------------------------------------ */

export interface StoreSettings {
  /** International format, digits only: 9647XXXXXXXXX. */
  whatsapp: string;
  delivery_fee: number;
  /** Orders at or above this subtotal ship free. Zero turns it off. */
  free_delivery_over: number;
  /** When false the storefront still shows, but nothing can be ordered. */
  store_open: boolean;
  announcement: string;
  hero_title: string;
  hero_subtitle: string;
  /** Loyalty points earned per 1,000 IQD of an order's subtotal. Zero turns points off. */
  points_per_1000: number;
}

/* The same number the registration form sends people to — see COACH_WHATSAPP
   in src/components/form/PaymentGate.tsx. */
export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  whatsapp: "9647877511605",
  delivery_fee: 5000,
  free_delivery_over: 150000,
  store_open: true,
  announcement: "توصيل لجميع محافظات العراق · الدفع عند الاستلام",
  hero_title: "وقود العضلات. بلا مساومة.",
  hero_subtitle: "مكملات مختارة بعناية من الكابتن إبراهيم — لكل هدف، لكل مرحلة، ولكل تمرين.",
  points_per_1000: 1,
};

export function normalizeSettings(raw: unknown): StoreSettings {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const text = (key: keyof StoreSettings, max = 300) =>
    typeof src[key] === "string" ? (src[key] as string).trim().slice(0, max) : (DEFAULT_STORE_SETTINGS[key] as string);
  const money = (key: keyof StoreSettings) => {
    const n = Number(src[key]);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : (DEFAULT_STORE_SETTINGS[key] as number);
  };
  const whatsapp = typeof src.whatsapp === "string" ? src.whatsapp.replace(/\D/g, "").slice(0, 15) : "";
  return {
    whatsapp: whatsapp.length >= 8 ? whatsapp : DEFAULT_STORE_SETTINGS.whatsapp,
    delivery_fee: money("delivery_fee"),
    free_delivery_over: money("free_delivery_over"),
    store_open: typeof src.store_open === "boolean" ? src.store_open : DEFAULT_STORE_SETTINGS.store_open,
    announcement: text("announcement"),
    hero_title: text("hero_title", 120),
    hero_subtitle: text("hero_subtitle"),
    points_per_1000: (() => {
      const n = Number(src.points_per_1000);
      return Number.isFinite(n) && n >= 0 ? Math.min(100, Math.round(n * 10) / 10) : DEFAULT_STORE_SETTINGS.points_per_1000;
    })(),
  };
}

/** The points an order of this subtotal earns. Delivery is not counted. */
export function pointsFor(subtotal: number, settings: Pick<StoreSettings, "points_per_1000">): number {
  if (subtotal <= 0 || settings.points_per_1000 <= 0) return 0;
  return Math.floor((subtotal / 1000) * settings.points_per_1000);
}

export function deliveryFeeFor(subtotal: number, settings: Pick<StoreSettings, "delivery_fee" | "free_delivery_over">): number {
  if (subtotal <= 0) return 0;
  if (settings.free_delivery_over > 0 && subtotal >= settings.free_delivery_over) return 0;
  return settings.delivery_fee;
}

/* ------------------------------------------------------------------ *
 * Cart and orders
 * ------------------------------------------------------------------ */

export interface CartLine {
  /** product id + size + flavour — two flavours of one tub are two lines. */
  key: string;
  productId: string;
  slug: string;
  name: string;
  image_url: string | null;
  accent: string;
  category: string;
  size: string | null;
  flavor: string | null;
  unitPrice: number;
  qty: number;
}

export function lineKey(productId: string, size: string | null, flavor: string | null): string {
  return `${productId}::${size ?? ""}::${flavor ?? ""}`;
}

export const MAX_LINE_QTY = 20;

export const ORDER_STATUSES = [
  { key: "new", label: "جديد" },
  { key: "confirmed", label: "مؤكد" },
  { key: "delivered", label: "تم التسليم" },
  { key: "cancelled", label: "ملغي" },
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number]["key"];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && ORDER_STATUSES.some((s) => s.key === value);
}

export function orderStatusLabel(key: string): string {
  return ORDER_STATUSES.find((s) => s.key === key)?.label ?? key;
}

export interface OrderItem {
  productId: string;
  name: string;
  size: string | null;
  flavor: string | null;
  unitPrice: number;
  qty: number;
}

export interface StoreOrder {
  id: string;
  reference: string;
  customer_name: string;
  customer_phone: string;
  city: string;
  address: string;
  notes: string | null;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: string;
  created_at: string;
  customer_id: string | null;
  location_lat: number | null;
  location_lng: number | null;
  points_earned: number;
  points_awarded: boolean;
}

export const IRAQ_GOVERNORATES = [
  "بغداد", "البصرة", "نينوى", "أربيل", "النجف", "كربلاء", "بابل", "الأنبار",
  "ديالى", "ذي قار", "كركوك", "صلاح الدين", "واسط", "ميسان", "القادسية",
  "المثنى", "دهوك", "السليمانية", "حلبجة",
] as const;

/** Where the map opens for each governorate — its main city. */
export const GOVERNORATE_CENTERS: Record<string, [number, number]> = {
  "بغداد": [33.3152, 44.3661], "البصرة": [30.5085, 47.7804], "نينوى": [36.3456, 43.1575],
  "أربيل": [36.1911, 44.0092], "النجف": [32.0259, 44.3462], "كربلاء": [32.616, 44.0249],
  "بابل": [32.4637, 44.4196], "الأنبار": [33.4206, 43.3078], "ديالى": [33.75, 44.6333],
  "ذي قار": [31.0439, 46.2575], "كركوك": [35.4681, 44.3922], "صلاح الدين": [34.6, 43.6833],
  "واسط": [32.5, 45.8333], "ميسان": [31.8356, 47.1442], "القادسية": [31.9929, 44.9255],
  "المثنى": [31.3099, 45.2806], "دهوك": [36.8669, 42.9503], "السليمانية": [35.5613, 45.4306],
  "حلبجة": [35.1779, 45.9861],
};

export const IRAQ_CENTER: [number, number] = [33.3152, 44.3661];

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Inside a generous box around Iraq — a pin far outside it is a mistake. */
export function isInIraq(point: unknown): point is GeoPoint {
  const p = point as GeoPoint;
  return (
    !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    p.lat >= 28.5 && p.lat <= 38 && p.lng >= 38.5 && p.lng <= 49
  );
}

export function mapsLink(point: GeoPoint): string {
  return `https://maps.google.com/?q=${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}

/** 1.234.000 د.ع — Arabic grouping, Latin digits to match the rest of the site. */
export function formatIQD(amount: number): string {
  return `${Math.round(amount).toLocaleString("en-US")} د.ع`;
}

/** A short, readable order code: ST-7K2Q9P. No 0/O or 1/I to misread over the phone. */
export function makeOrderReference(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return `ST-${code}`;
}

export function isOrderReference(value: unknown): value is string {
  return typeof value === "string" && /^ST-[2-9A-HJ-NP-Z]{6}$/.test(value);
}

/** Iraqi mobile numbers as people type them: 07XXXXXXXXX, +9647…, 9647…. */
export function normalizeIraqiPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "").replace(/^00/, "");
  if (/^07\d{9}$/.test(digits)) return digits;
  if (/^9647\d{9}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^7\d{9}$/.test(digits)) return `0${digits}`;
  return null;
}

export interface OrderDraft {
  reference: string;
  customer_name: string;
  customer_phone: string;
  city: string;
  address: string;
  notes: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  location: GeoPoint | null;
  points: number;
}

/** The message the coach receives. Plain text, one line per item. */
export function buildWhatsAppMessage(order: OrderDraft): string {
  const lines: string[] = [];
  lines.push("🛒 *طلب جديد من متجر المكملات*");
  lines.push(`رقم الطلب: *${order.reference}*`);
  lines.push("");
  lines.push("*المنتجات:*");
  order.items.forEach((item, i) => {
    const variant = [item.size, item.flavor].filter(Boolean).join(" · ");
    lines.push(`${i + 1}. ${item.name}${variant ? ` (${variant})` : ""}`);
    lines.push(`   ${item.qty} × ${formatIQD(item.unitPrice)} = ${formatIQD(item.qty * item.unitPrice)}`);
  });
  lines.push("");
  lines.push(`المجموع: ${formatIQD(order.subtotal)}`);
  lines.push(`التوصيل: ${order.delivery_fee === 0 ? "مجاني" : formatIQD(order.delivery_fee)}`);
  lines.push(`*الإجمالي: ${formatIQD(order.total)}*`);
  lines.push("");
  lines.push("*معلومات الزبون:*");
  lines.push(`الاسم: ${order.customer_name}`);
  lines.push(`الهاتف: ${order.customer_phone}`);
  lines.push(`المحافظة: ${order.city}`);
  lines.push(`العنوان: ${order.address}`);
  if (order.location) lines.push(`📍 الموقع على الخريطة: ${mapsLink(order.location)}`);
  if (order.notes.trim()) lines.push(`ملاحظات: ${order.notes.trim()}`);
  lines.push("");
  if (order.points > 0) {
    lines.push(`⭐ نقاط هذا الطلب: ${order.points} نقطة (تُضاف لرصيدك عند التسليم)`);
  }
  lines.push("الدفع عند الاستلام 💵");
  return lines.join("\n");
}

export function whatsAppUrl(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
