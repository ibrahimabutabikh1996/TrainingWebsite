import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/authGuard";
import AdminCMSClient from "./AdminCMSClient";
import { translations as defaultTranslations } from "@/lib/translations";
import type { JsonRecord } from "@/types";

export default async function AdminCMSPage() {
  /* The proxy already turned strangers away before this rendered — but a
     matcher is a list of paths, and this page reads every subscriber it can
     find. It proves the caller for itself rather than inheriting the answer.
     See @/lib/authGuard. */
  await requireAdminPage();

  const settings = await prisma.site_settings.findUnique({
    where: { id: "landing_content" },
  });

  const contentAr = settings?.content_ar as JsonRecord || defaultTranslations;

  return (
    /* Named so the stylesheet can give this one screen a full-height column.
       The content manager scrolls its own content pane rather than the shell's
       main element — see `.cms-page-shell` in cms.css for why. `padding: 0` was
       a no-op on a bare div and is gone with it. */
    <div className="cms-page-shell">
      <AdminCMSClient initialAr={contentAr} />
    </div>
  );
}
