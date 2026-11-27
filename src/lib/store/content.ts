/* The store's written copy, as the store content screen edits it.
 *
 * Two kinds of text: the storefront's own wording, which lives in the store
 * settings row, and each product's name, tagline and description, which live
 * on the product. The screen edits both on the page itself and keeps them as a
 * draft until they are published.
 *
 * The draft holds only what differs from what is published. Publishing then
 * writes those fields and nothing else, so a delivery fee changed in the store
 * settings, or a price changed in the products screen, while a draft was open
 * is left exactly as it is. Client-safe: no database here. */

import { DEFAULT_STORE_SETTINGS, type StoreProduct, type StoreSettings } from "@/lib/store/types";

export const STORE_TEXT_FIELDS = [
  { key: "announcement", label: "شريط الإعلان أعلى المتجر", max: 300, long: false },
  { key: "catalog_title", label: "عنوان قائمة المنتجات", max: 120, long: false },
  { key: "catalog_subtitle", label: "السطر تحت عنوان القائمة", max: 300, long: false },
  { key: "perk_original", label: "سطر الضمان في صفحة المنتج", max: 80, long: false },
  { key: "perk_order", label: "سطر طريقة الطلب في صفحة المنتج", max: 120, long: false },
  { key: "related_title", label: "عنوان المنتجات المقترحة", max: 120, long: false },
  { key: "trust_delivery", label: "أسفل المتجر — التوصيل", max: 80, long: false },
  { key: "trust_original", label: "أسفل المتجر — الضمان", max: 80, long: false },
  { key: "trust_whatsapp", label: "أسفل المتجر — الطلب", max: 80, long: false },
  { key: "footer_text", label: "سطر الحقوق أسفل المتجر", max: 120, long: false },
  { key: "promo_title", label: "عنوان النافذة الترويجية", max: 120, long: false },
  { key: "promo_desc", label: "وصف النافذة الترويجية", max: 300, long: true },
  { key: "promo_discount", label: "شارة الخصم في النافذة", max: 40, long: false },
  { key: "promo_cta", label: "زر النافذة الترويجية", max: 60, long: false },
] as const satisfies readonly { key: keyof StoreSettings; label: string; max: number; long: boolean }[];

export type StoreTextKey = (typeof STORE_TEXT_FIELDS)[number]["key"];

export const PRODUCT_TEXT_FIELDS = [
  { key: "name", label: "اسم المنتج", max: 120, long: false },
  { key: "tagline", label: "الوصف المختصر", max: 160, long: false },
  { key: "description", label: "الوصف", max: 3000, long: true },
] as const;

export type ProductTextKey = (typeof PRODUCT_TEXT_FIELDS)[number]["key"];

export type StoreTexts = Record<StoreTextKey, string>;
export type ProductTexts = Record<ProductTextKey, string>;

/** Everything the screen edits, in full. */
export interface StoreContent {
  texts: StoreTexts;
  products: Record<string, ProductTexts>;
}

/** What is stored as the draft: only the fields that differ from published. */
export interface StoreContentDraft {
  texts: Partial<StoreTexts>;
  products: Record<string, Partial<ProductTexts>>;
}

export const EMPTY_DRAFT: StoreContentDraft = { texts: {}, products: {} };

const PRODUCT_ID = /^[0-9a-f-]{36}$/i;

export function contentFrom(settings: StoreSettings, products: StoreProduct[]): StoreContent {
  const texts = {} as StoreTexts;
  for (const f of STORE_TEXT_FIELDS) texts[f.key] = settings[f.key];
  const byId: Record<string, ProductTexts> = {};
  for (const p of products) byId[p.id] = { name: p.name, tagline: p.tagline, description: p.description };
  return { texts, products: byId };
}

/** `base` with the draft's fields laid over it. */
export function withDraft(base: StoreContent, draft: StoreContentDraft): StoreContent {
  const products: Record<string, ProductTexts> = {};
  for (const [id, fields] of Object.entries(base.products)) {
    products[id] = { ...fields, ...(draft.products[id] ?? {}) };
  }
  return { texts: { ...base.texts, ...draft.texts }, products };
}

/** The fields of `content` that differ from `published` — what a draft stores. */
export function draftBetween(content: StoreContent, published: StoreContent): StoreContentDraft {
  const draft: StoreContentDraft = { texts: {}, products: {} };
  for (const f of STORE_TEXT_FIELDS) {
    if (content.texts[f.key] !== published.texts[f.key]) draft.texts[f.key] = content.texts[f.key];
  }
  for (const [id, fields] of Object.entries(content.products)) {
    const was = published.products[id];
    if (!was) continue;
    for (const f of PRODUCT_TEXT_FIELDS) {
      if (fields[f.key] !== was[f.key]) (draft.products[id] ??= {})[f.key] = fields[f.key];
    }
  }
  return draft;
}

/**
 * Narrows anything to a draft: known fields only, strings only, cut to the
 * same lengths the store settings and the product editor allow. Used on what
 * comes back out of the database as well as on what a client sends.
 */
export function cleanDraft(raw: unknown): StoreContentDraft {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const draft: StoreContentDraft = { texts: {}, products: {} };

  const texts = src.texts && typeof src.texts === "object" ? (src.texts as Record<string, unknown>) : {};
  for (const f of STORE_TEXT_FIELDS) {
    const v = texts[f.key];
    if (typeof v === "string") draft.texts[f.key] = v.slice(0, f.max);
  }

  const products = src.products && typeof src.products === "object" ? (src.products as Record<string, unknown>) : {};
  for (const [id, value] of Object.entries(products)) {
    if (!PRODUCT_ID.test(id) || !value || typeof value !== "object") continue;
    const fields = value as Record<string, unknown>;
    const clean: Partial<ProductTexts> = {};
    for (const f of PRODUCT_TEXT_FIELDS) {
      const v = fields[f.key];
      if (typeof v === "string") clean[f.key] = v.slice(0, f.max);
    }
    if (Object.keys(clean).length > 0) draft.products[id] = clean;
  }
  return draft;
}

/** The settings and products a visitor would see with this content published. */
export function applyContent(
  settings: StoreSettings,
  products: StoreProduct[],
  content: Partial<StoreContent> | StoreContentDraft,
): { settings: StoreSettings; products: StoreProduct[] } {
  const texts = content.texts ?? {};
  const merged = { ...settings } as StoreSettings;
  for (const f of STORE_TEXT_FIELDS) {
    const v = (texts as Partial<StoreTexts>)[f.key];
    if (typeof v !== "string") continue;
    /* The same fallback the stored settings get: the storefront copy is never
       blank, the perks and the pop-up fields may be. */
    merged[f.key] = v || (f.key in COPY_FALLBACK ? DEFAULT_STORE_SETTINGS[f.key] : v);
  }
  const overrides = content.products ?? {};
  return {
    settings: merged,
    products: products.map((p) => {
      const o = (overrides as Record<string, Partial<ProductTexts>>)[p.id];
      return o ? { ...p, ...o, name: o.name || p.name } : p;
    }),
  };
}

/* The keys `normalizeSettings` refills when empty. */
const COPY_FALLBACK: Partial<Record<StoreTextKey, true>> = {
  catalog_title: true,
  catalog_subtitle: true,
  related_title: true,
  trust_delivery: true,
  trust_original: true,
  trust_whatsapp: true,
  footer_text: true,
};

/* ------------------------------------------------------------------ *
 * Addressing one field — how the page and the screen name a text
 * ------------------------------------------------------------------ */

/** `catalog_title`, or `product:<id>:name`. */
export type FieldId = string;

export const productFieldId = (id: string, key: ProductTextKey): FieldId => `product:${id}:${key}`;

export function parseFieldId(field: FieldId): { kind: "text"; key: StoreTextKey } | { kind: "product"; id: string; key: ProductTextKey } | null {
  if (field.startsWith("product:")) {
    const [, id, key] = field.split(":");
    if (PRODUCT_ID.test(id ?? "") && PRODUCT_TEXT_FIELDS.some((f) => f.key === key)) {
      return { kind: "product", id, key: key as ProductTextKey };
    }
    return null;
  }
  return STORE_TEXT_FIELDS.some((f) => f.key === field) ? { kind: "text", key: field as StoreTextKey } : null;
}

export function readField(content: StoreContent, field: FieldId): string | undefined {
  const at = parseFieldId(field);
  if (!at) return undefined;
  return at.kind === "text" ? content.texts[at.key] : content.products[at.id]?.[at.key];
}

export function writeField(content: StoreContent, field: FieldId, value: string): StoreContent {
  const at = parseFieldId(field);
  if (!at) return content;
  if (at.kind === "text") return { ...content, texts: { ...content.texts, [at.key]: value } };
  const was = content.products[at.id];
  if (!was) return content;
  return { ...content, products: { ...content.products, [at.id]: { ...was, [at.key]: value } } };
}
