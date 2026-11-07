/* The store card on the landing page (StoreShowcase) and its tab in the
 * content manager ("قسم المتجر") read the same keys from the landing content.
 *
 * Every text has its default here, which is what the card said before it was
 * editable: a key the coach has never saved shows exactly that, and the
 * content manager shows it as the field's placeholder. Each text can also be
 * switched off through `<key>_active`, the content manager's usual convention.
 *
 * The three products are picked by slug from the store's active products. A
 * pick that has since been hidden or deleted, or picked twice, gives its place
 * to the next product in the store's order, so the card always stands three. */

export const STORE_PROMO_TEXTS = {
  store_promo_badge: "متجر المكملات الغذائية",
  store_promo_word: "المتجر",
  store_promo_title: "كل اللي يحتاجه جسمك، بمكان واحد",
  store_promo_desc: "بروتين، كرياتين، أحماض أمينية وفيتامينات — مختارة من الكابتن نفسه، وتوصلك لباب البيت.",
  store_promo_perk1: "توصيل لكل المحافظات",
  store_promo_perk2: "الدفع عند الاستلام",
  store_promo_perk3: "منتجات أصلية",
  store_promo_cta: "ادخل المتجر",
} as const;

export type StorePromoTextKey = keyof typeof STORE_PROMO_TEXTS;

export const STORE_PROMO_PRODUCT_KEYS = [
  "store_promo_product1",
  "store_promo_product2",
  "store_promo_product3",
] as const;

/** The three the card showed before they could be chosen. */
export const STORE_PROMO_DEFAULT_SLUGS = ["vast-mass", "rvit-creatine", "lusty-preworkout"] as const;

/** What the card needs of a product to draw it — no prices, no descriptions. */
export interface ShowcaseProduct {
  slug: string;
  name: string;
  category: string;
  accent: string;
  image_url: string | null;
}

export function toShowcaseProduct(p: ShowcaseProduct): ShowcaseProduct {
  return { slug: p.slug, name: p.name, category: p.category, accent: p.accent, image_url: p.image_url };
}

/** A text as the card shows it: the coach's, or the default when none is saved. */
export function storePromoText(content: Record<string, unknown>, key: StorePromoTextKey): string {
  const saved = content[key];
  return typeof saved === "string" && saved.trim() !== "" ? saved : STORE_PROMO_TEXTS[key];
}

/** Whether a text is shown — switched off only by an explicit "false". */
export function storePromoShown(content: Record<string, unknown>, key: StorePromoTextKey): boolean {
  return content[`${key}_active`] !== "false";
}

export function pickShowcaseProducts(
  content: Record<string, unknown>,
  products: ShowcaseProduct[],
): ShowcaseProduct[] {
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const picked: ShowcaseProduct[] = [];

  STORE_PROMO_PRODUCT_KEYS.forEach((key, i) => {
    const saved = content[key];
    const slug = typeof saved === "string" && saved !== "" ? saved : STORE_PROMO_DEFAULT_SLUGS[i];
    const product = bySlug.get(slug);
    if (product && !picked.includes(product)) picked.push(product);
  });

  for (const product of products) {
    if (picked.length >= STORE_PROMO_PRODUCT_KEYS.length) break;
    if (!picked.includes(product)) picked.push(product);
  }

  return picked.slice(0, STORE_PROMO_PRODUCT_KEYS.length);
}
