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
    <div style={{ padding: 0 }}>
      <AdminCMSClient initialAr={contentAr} />
    </div>
  );
}
