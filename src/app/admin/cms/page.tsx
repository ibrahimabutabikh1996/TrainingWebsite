import { prisma } from "@/lib/db";
import AdminCMSClient from "./AdminCMSClient";
import { translations as defaultTranslations } from "@/lib/translations";
import type { JsonRecord } from "@/types";

export default async function AdminCMSPage() {
  const settings = await prisma.site_settings.findUnique({
    where: { id: "landing_content" },
  });

  const contentEn = settings?.content_en as JsonRecord || defaultTranslations.en;
  const contentAr = settings?.content_ar as JsonRecord || defaultTranslations.ar;

  return (
    <div style={{ padding: 0 }}>
      <AdminCMSClient initialEn={contentEn} initialAr={contentAr} />
    </div>
  );
}
