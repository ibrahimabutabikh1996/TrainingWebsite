import { prisma } from "@/lib/db";
import AdminCMSClient from "./AdminCMSClient";
import { translations as defaultTranslations } from "@/lib/translations";

export default async function AdminCMSPage() {
  const settings = await prisma.site_settings.findUnique({
    where: { id: "landing_content" },
  });

  const contentEn = settings?.content_en as any || defaultTranslations.en;
  const contentAr = settings?.content_ar as any || defaultTranslations.ar;

  return (
    <div style={{ padding: 0 }}>
      <AdminCMSClient initialEn={contentEn} initialAr={contentAr} />
    </div>
  );
}
