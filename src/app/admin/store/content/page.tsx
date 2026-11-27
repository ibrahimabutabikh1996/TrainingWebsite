import { getAllProducts, getStoreSettings } from "@/lib/store/catalog";
import { contentFrom, withDraft } from "@/lib/store/content";
import { loadStoreContentDraft } from "./actions";
import StoreContentClient from "./StoreContentClient";

export const dynamic = "force-dynamic";

/* The store's written copy, edited on the storefront itself. The store
   layout above has already turned away anyone who is not the coach. */
export default async function StoreContentPage() {
  const [settings, { products }, draft] = await Promise.all([
    getStoreSettings(),
    getAllProducts(),
    loadStoreContentDraft(),
  ]);
  /* What a visitor can see — the preview draws the same set. */
  const active = products.filter((p) => p.is_active);
  const published = contentFrom(settings, active);

  return (
    <StoreContentClient
      published={published}
      initial={withDraft(published, draft)}
      products={active.map((p) => ({ id: p.id, slug: p.slug }))}
    />
  );
}
