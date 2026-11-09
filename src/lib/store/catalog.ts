import "server-only";
import { prisma } from "@/lib/db";
import { seedCatalog } from "./seed";
import {
  DEFAULT_STORE_SETTINGS,
  normalizeSettings,
  type ProductFact,
  type ProductFeature,
  type ProductHighlight,
  type ProductSize,
  type StoreProduct,
  type StoreSettings,
} from "./types";

/* Reads for the store. Every one of them survives the tables not existing yet:
 * prisma/manual/2026-11-04-store.sql is run by hand, and until it is the
 * storefront shows the sample catalogue rather than an error page. Any other
 * failure falls back the same way and is logged. */

export const STORE_SETTINGS_ID = "store_settings";

/** A store table or column that is not there yet — one of the two SQL files
 *  in prisma/manual has not been run. Postgres undefined_table / undefined_column,
 *  as Prisma reports them either way. */
export function isMissingTable(error: unknown): boolean {
  const e = error as { code?: string; meta?: { code?: string } };
  const codes = ["P2021", "P2022", "42P01", "42703"];
  return codes.includes(e?.code ?? "") || codes.includes(e?.meta?.code ?? "");
}

function list<T>(value: unknown, pick: (item: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    if (item && typeof item === "object") {
      const picked = pick(item as Record<string, unknown>);
      if (picked) out.push(picked);
    } else if (typeof item === "string") {
      const picked = pick({ text: item });
      if (picked) out.push(picked);
    }
  }
  return out;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

type ProductRow = Awaited<ReturnType<typeof prisma.store_products.findFirst>>;

/* The photos in public/images/store were renamed, but the rows keep the old names
 * until prisma/manual/2026-11-09-store-single-images.sql has run. After that
 * nothing here matches any more and this can be removed. */
const RENAMED_IMAGES: Record<string, string> = {
  "/images/store/ans-creatine.webp": "/images/store/ans-creatine-monohydrate-300g.png",
  "/images/store/rvit-creatine.webp": "/images/store/rvit-creatine-monohydrate-blackcurrant.png",
  "/images/store/lusty-preworkout.webp": "/images/store/rvit-lusty-preworkout-blackcurrant.png",
  "/images/store/vast-mass.webp": "/images/store/rvit-vast-mass-strawberry.png",
  "/images/store/rice-carbs-pure.webp": "/images/store/rvit-rice-carbs-pure-banana.png",
  "/images/store/beta-alanine.webp": "/images/store/rvit-beta-alanine-cola.png",
  "/images/store/citrulline.webp": "/images/store/rvit-citrulline-cola.png",
  "/images/store/ashwagandha.webp": "/images/store/rvit-ashwagandha.png",
};
const DELETED_GALLERY_IMAGE = /^\/images\/store\/[\w-]+-[23]\.webp$/;

function currentImages(stored: string[]): string[] {
  return stored.filter((url) => !DELETED_GALLERY_IMAGE.test(url)).map((url) => RENAMED_IMAGES[url] ?? url);
}

export function toProduct(row: NonNullable<ProductRow>): StoreProduct {
  const images = currentImages(row.images.length > 0 ? row.images : row.image_url ? [row.image_url] : []);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    category: row.category,
    brand: row.brand,
    description: row.description,
    price: row.price,
    compare_at_price: row.compare_at_price,
    image_url: images[0] ?? null,
    images,
    accent: row.accent,
    highlights: list<ProductHighlight>(row.highlights, (i) =>
      str(i.value) ? { value: str(i.value), label: str(i.label) } : null
    ),
    features: list<ProductFeature>(row.features, (i) =>
      str(i.title) || str(i.text) ? { title: str(i.title), text: str(i.text) } : null
    ),
    usage: list<string>(row.usage, (i) => str(i.text) || null),
    nutrition: list<ProductFact>(row.nutrition, (i) =>
      str(i.label) ? { label: str(i.label), value: str(i.value) } : null
    ),
    ingredients: row.ingredients,
    flavors: row.flavors,
    sizes: list<ProductSize>(row.sizes, (i) => {
      const price = Number(i.price);
      return str(i.label) && Number.isFinite(price) ? { label: str(i.label), price: Math.round(price) } : null;
    }),
    stock: row.stock,
    low_stock_threshold: row.low_stock_threshold,
    is_active: row.is_active,
    is_featured: row.is_featured,
    sort_order: row.sort_order,
  };
}

export interface CatalogResult {
  products: StoreProduct[];
  /** True when the tables are not there yet and the sample list is showing. */
  isSample: boolean;
}

/** Everything, hidden products included — the panel's view. */
export async function getAllProducts(): Promise<CatalogResult> {
  try {
    const rows = await prisma.store_products.findMany({
      orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    });
    return { products: rows.map(toProduct), isSample: false };
  } catch (error) {
    if (!isMissingTable(error)) console.error("[store] Failed to read products:", error);
    return { products: seedCatalog(), isSample: true };
  }
}

/** What a visitor may see. */
export async function getActiveProducts(): Promise<StoreProduct[]> {
  const { products } = await getAllProducts();
  return products.filter((p) => p.is_active);
}

export async function getProductBySlug(slug: string): Promise<StoreProduct | null> {
  const products = await getActiveProducts();
  return products.find((p) => p.slug === slug) ?? null;
}

export async function getStoreSettings(): Promise<StoreSettings> {
  try {
    const row = await prisma.site_settings.findUnique({ where: { id: STORE_SETTINGS_ID } });
    return row ? normalizeSettings(row.content_ar) : DEFAULT_STORE_SETTINGS;
  } catch (error) {
    console.error("[store] Failed to read settings:", error);
    return DEFAULT_STORE_SETTINGS;
  }
}

