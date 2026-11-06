import Link from "next/link";
import { AlertTriangle, ChevronLeft, Package, ReceiptText, ShoppingBag, TrendingUp, Store, Settings } from "lucide-react";
import { getAllProducts } from "@/lib/store/catalog";
import { formatIQD, isSoldOut, orderStatusLabel } from "@/lib/store/types";
import { getOrders } from "./data";

export const dynamic = "force-dynamic";

export default async function StoreOverviewPage() {
  const [{ products }, orders] = await Promise.all([getAllProducts(), getOrders(200)]);
  const list = orders ?? [];

  const active = products.filter((p) => p.is_active).length;
  const soldOut = products.filter((p) => isSoldOut(p));
  const lowStock = products.filter((p) => p.stock !== null && p.stock > 0 && p.stock <= p.low_stock_threshold);
  const newOrders = list.filter((o) => o.status === "new").length;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthSales = list
    .filter((o) => (o.status === "confirmed" || o.status === "delivered") && new Date(o.created_at) >= monthStart)
    .reduce((n, o) => n + o.total, 0);

  const stats = [
    { label: "طلبات جديدة", value: String(newOrders), icon: ReceiptText, href: "/admin/store/orders", tone: "primary" },
    { label: "مبيعات هذا الشهر", value: formatIQD(monthSales), icon: TrendingUp, href: "/admin/store/orders", tone: "success" },
    { label: "منتجات معروضة", value: `${active} / ${products.length}`, icon: Package, href: "/admin/store/products", tone: "primary" },
    { label: "نفدت الكمية", value: String(soldOut.length), icon: AlertTriangle, href: "/admin/store/inventory", tone: soldOut.length ? "warning" : "muted" },
  ];

  return (
    <div className="sa-page">
      <header className="sa-head">
        <div>
          <h1>لوحة المتجر</h1>
          <p>نظرة سريعة على المنتجات والطلبات.</p>
        </div>
        <Link href="/store" target="_blank" className="btn-primary sa-btn">
          <Store aria-hidden="true" /> فتح المتجر
        </Link>
      </header>

      <div className="sa-stats">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={`admin-card sa-stat sa-stat--${s.tone}`}>
            <span className="ui-icon-tile ui-icon-tile--lit sa-stat-icon"><s.icon aria-hidden="true" /></span>
            <span className="sa-stat-label">{s.label}</span>
            <strong className="sa-stat-value">{s.value}</strong>
          </Link>
        ))}
      </div>

      <div className="sa-split">
        <section className="admin-card sa-panel">
          <div className="sa-panel-head">
            <h2>آخر الطلبات</h2>
            <Link href="/admin/store/orders" className="sa-more">الكل <ChevronLeft aria-hidden="true" /></Link>
          </div>
          {orders === null ? (
            <p className="sa-muted">سجل الطلبات يبدأ بعد تشغيل ملف قاعدة البيانات.</p>
          ) : list.length === 0 ? (
            <div className="sa-empty"><ShoppingBag aria-hidden="true" /><p>لا توجد طلبات بعد</p></div>
          ) : (
            <ul className="sa-mini-list">
              {list.slice(0, 6).map((o) => (
                <li key={o.id}>
                  <div>
                    <strong>{o.customer_name}</strong>
                    <span dir="ltr">{o.reference}</span>
                  </div>
                  <div>
                    <span className={`sa-status sa-status--${o.status}`}>{orderStatusLabel(o.status)}</span>
                    <strong>{formatIQD(o.total)}</strong>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-card sa-panel">
          <div className="sa-panel-head">
            <h2>تنبيهات المخزون</h2>
            <Link href="/admin/store/inventory" className="sa-more">المخزن <ChevronLeft aria-hidden="true" /></Link>
          </div>
          {soldOut.length + lowStock.length === 0 ? (
            <p className="sa-muted">كل المنتجات متوفرة.</p>
          ) : (
            <ul className="sa-mini-list">
              {[...soldOut, ...lowStock].map((p) => (
                <li key={p.id}>
                  <div><strong>{p.name}</strong></div>
                  <div>
                    <span className={`sa-status ${isSoldOut(p) ? "sa-status--cancelled" : "sa-status--new"}`}>
                      {isSoldOut(p) ? "نفدت" : `باقي ${p.stock}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/store/settings" className="sa-settings-link">
            <Settings aria-hidden="true" /> إعدادات المتجر — رقم واتساب، التوصيل، نصوص الواجهة
          </Link>
        </section>
      </div>
    </div>
  );
}
