import type { JsonRecord } from "@/types";
import { requireAdminPage, sessionCan } from "@/lib/authGuard";
import { getLandingContent, getLandingDraft } from "../admin/cms/actions";
/* Every rule in it sits under `html.cms-inline-editing`, which only the editing
   frame sets — loaded here, it changes nothing anywhere else. */
import "./inline-edit.css";
import LandingClient from "../LandingClient";
import { getActiveProducts } from "@/lib/store/catalog";
import { toShowcaseProduct } from "@/lib/storePromo";

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

export default async function CmsPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireAdminPage("cms.view");

  /* `?edit=1` is the content manager framing this page so the coach can write
     on it directly. Only for someone who may edit — a viewer gets the plain
     preview — and it starts from the saved draft, if any, rather than from
     what is published; the manager then pushes its unsaved edits on top. */
  const editing = (await searchParams).edit === "1" && sessionCan(session, "cms.edit");

  const [settings, draft, products] = await Promise.all([
    getLandingContent(),
    editing ? getLandingDraft() : Promise.resolve(null),
    getActiveProducts(),
  ]);
  const initialCmsData = draft ?? (settings ? (settings.content_ar as JsonRecord) : null);

  return <LandingClient initialCmsData={initialCmsData} storeProducts={products.map(toShowcaseProduct)} isPreview isEditing={editing} />;
}
