import { requireAdminPage } from "@/lib/authGuard";
import { getAllProducts } from "@/lib/store/catalog";
import { StoreToaster } from "./StoreToaster";
import "./store-admin.css";

export const dynamic = "force-dynamic";

/* The store's half of the panel. The coach only — no staff grant opens it —
   checked here once for every screen under it, and again in each action. */
export default async function AdminStoreLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  const { isSample } = await getAllProducts();
  return (
    <div className="sa-root" dir="rtl">
      {isSample && (
        <div className="sa-setup" role="status">
          <strong>المتجر يعمل بالمنتجات التجريبية.</strong>
          <span>
            لتفعيل الحفظ والطلبات والزبائن والمخزن، شغّل في SQL Editor داخل Supabase الملف
            <code dir="ltr">prisma/manual/2026-11-04-store.sql</code> ثم <code dir="ltr">2026-11-04-store-v2.sql</code>.
          </span>
        </div>
      )}
      {children}
      <StoreToaster />
    </div>
  );
}
