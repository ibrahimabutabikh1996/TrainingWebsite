import type { JsonRecord } from "@/types";
import { requireAdminPage } from "@/lib/authGuard";
import { getLandingContent } from "../../admin/cms/actions";
import { LoginScreen } from "@/components/auth/LoginScreen";
import "../../login/login.css";

/**
 * The sign-in screen as it will look once the draft in the content manager is
 * published — the sibling of `/cms-preview`, which does the same for the home
 * page.
 *
 * It exists because the content manager used to preview this screen by opening
 * the real `/login?preview=true`: a working sign-in form, with nothing on it to
 * say it was a preview and no way back. Every other tab in the panel opened a
 * guarded preview route with the standard bar on it; this one did not, and that
 * is the difference this route closes.
 *
 * Guarded twice, like `/cms-preview`: `requireAdminPage` here, and the path is
 * covered by the matcher in `src/proxy.ts` so an unauthenticated request never
 * reaches this file.
 *
 * Only `login.css` is imported, so the document is dressed exactly as the
 * visitor's is — the same reason `/cms-preview` sits outside `/admin`.
 */
export const dynamic = "force-dynamic";

export default async function LoginPreviewPage() {
  await requireAdminPage();

  const settings = await getLandingContent();
  const initialCmsData = settings ? (settings.content_ar as JsonRecord) : null;

  return <LoginScreen isPreview initialCmsData={initialCmsData} />;
}
