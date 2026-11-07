import { getLandingContent } from "./admin/cms/actions";
import LandingClient from "./LandingClient";
import { getActiveProducts } from "@/lib/store/catalog";
import { toShowcaseProduct } from "@/lib/storePromo";
import type { JsonRecord } from "@/types";

/**
 * Rendered per request, not once at build.
 *
 * This page reads `site_settings` — the row the content manager writes — and had
 * neither `dynamic` nor `revalidate`, so Next classified it `○ Static` and baked
 * whatever the table held at build time into the HTML. Every other page that
 * reads the database declares this; the one page whose entire purpose is to show
 * editable content did not.
 *
 * The effect was the bug the coach actually reported: saving in the panel
 * succeeded, the row changed, and the site kept showing the old text. Verified
 * directly — with `off_card1_active = false` in the database, the served payload
 * still carried `"true"`.
 *
 * `revalidatePath("/")` in `saveLandingContent` remains, and now has a
 * per-request render to invalidate rather than a build artifact.
 */
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  /* The store card's three products are the coach's picks from the store
     (`store_promo_product1..3`), so it needs the store's active products —
     only what drawing one takes. Read alongside the content, not after it. */
  const [settings, products] = await Promise.all([getLandingContent(), getActiveProducts()]);
  const initialCmsData = settings ? (settings.content_ar as JsonRecord) : null;
  return <LandingClient initialCmsData={initialCmsData} storeProducts={products.map(toShowcaseProduct)} />;
}
