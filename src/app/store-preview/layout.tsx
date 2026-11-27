import { requireAdminPage } from "@/lib/authGuard";
import { getAllProducts, getStoreSettings } from "@/lib/store/catalog";
import { contentFrom, withDraft } from "@/lib/store/content";
import { loadStoreContentDraft } from "../admin/store/content/actions";
import StorePreviewRoot from "./StorePreviewRoot";
import "../store/store.css";
/* Every rule in it sits under `html.store-inline-editing`, which only the
   framed preview sets. */
import "./inline-edit.css";

/**
 * The storefront for the store content screen (/admin/store/content) — the
 * same components as /store, drawn from the saved draft, with the screen's
 * unsaved edits pushed in on top. See StorePreviewRoot.
 *
 * Outside /admin so that only the store's own stylesheet dresses it, as the
 * home page's preview does. The coach's alone: `requireAdminPage()` with no
 * grant named, like the store panel, and the path is in the proxy's matcher.
 */
export const dynamic = "force-dynamic";

export default async function StorePreviewLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  const [settings, { products }, draft] = await Promise.all([
    getStoreSettings(),
    getAllProducts(),
    loadStoreContentDraft(),
  ]);
  const active = products.filter((p) => p.is_active);
  const initialContent = withDraft(contentFrom(settings, active), draft);

  return (
    <StorePreviewRoot settings={settings} products={active} initialContent={initialContent}>
      {children}
    </StorePreviewRoot>
  );
}
