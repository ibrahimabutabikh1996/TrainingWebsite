import type { JsonRecord } from "@/types";
import { requireAdminPage } from "@/lib/authGuard";
import { getLandingContent } from "../admin/cms/actions";
import LandingClient from "../LandingClient";

/**
 * The home page as it will look once the draft in the content manager is
 * published — the same component the visitor gets, rendered from the same
 * stylesheet, with nothing on it that can be clicked.
 *
 * It lives here rather than under `/admin` for one reason: fidelity. A page
 * inside the panel inherits the panel's layout and `admin.css`, and the point of
 * this screen is that it is not dressed up as anything. Its own route means the
 * only stylesheet in the document is the landing page's own, so what the coach
 * sees is what is served.
 *
 * It is still the coach's alone. `requireAdminPage` below is the check that says
 * so, and `/cms-preview` is listed in `src/proxy.ts` so an unauthenticated
 * request is turned away before this renders at all.
 *
 * The unsaved draft cannot come from here — it exists only in the browser the
 * coach is editing in. The server sends what is published; `LandingClient` reads
 * the draft out of local storage on mount and applies it over the top, and the
 * panel keeps pushing edits to this tab while it stays open. So this page shows
 * the published content when opened without a draft, which is the honest answer
 * to "what would a visitor see".
 */
export const dynamic = "force-dynamic";

export default async function CmsPreviewPage() {
  await requireAdminPage();

  const settings = await getLandingContent();
  const initialCmsData = settings ? (settings.content_ar as JsonRecord) : null;

  return <LandingClient initialCmsData={initialCmsData} isPreview />;
}
