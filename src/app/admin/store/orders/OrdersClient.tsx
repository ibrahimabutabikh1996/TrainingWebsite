"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, MapPin, MessageCircle, Navigation, Phone, ReceiptText, Search, Star, Trash2 } from "lucide-react";
import { CustomSelect } from "@/components/CustomSelect";
import { confirmDialog } from "@/lib/confirmDialog";
import { ORDER_STATUSES, formatIQD, mapsLink, orderStatusLabel, type StoreOrder } from "@/lib/store/types";
import { deleteOrder, updateOrderStatus } from "../actions";

const dateFmt = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });

export default function OrdersClient({ initialOrders, tablesMissing }: { initialOrders: StoreOrder[]; tablesMissing: boolean }) {
  const [orders, setOrders] = useState(initialOrders);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (status === "all" || o.status === status) &&
        (!q || `${o.reference} ${o.customer_name} ${o.customer_phone} ${o.city}`.toLowerCase().includes(q))
    );
  }, [orders, status, query]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: orders.length };
    for (const o of orders) map[o.status] = (map[o.status] ?? 0) + 1;
    return map;
  }, [orders]);

  const changeStatus = async (o: StoreOrder, next: string) => {
    const prev = o.status;
    setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, status: next } : x)));
    const res = await updateOrderStatus(o.id, next);
    if (res.success) toast.success(`الطلب ${o.reference}: ${orderStatusLabel(next)}`);
    else {
      toast.error(res.error);
      setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, status: prev } : x)));
    }
  };

  const remove = async (o: StoreOrder) => {
    const ok = await confirmDialog(`سيُحذف الطلب ${o.reference} من السجل. لن يتغير المخزون.`, {
      title: "حذف الطلب",
      confirmLabel: "حذف",
      danger: true,
    });
    if (!ok) return;
    const res = await deleteOrder(o.id);
    if (res.success) {
      setOrders((list) => list.filter((x) => x.id !== o.id));
      toast.success("تم حذف الطلب");
    } else toast.error(res.error);
  };

  const waCustomer = (o: StoreOrder) => {
    const intl = o.customer_phone.replace(/^0/, "964");
    const text = `مرحباً ${o.customer_name}، بخصوص طلبك ${o.reference} من متجر المكملات (${formatIQD(o.total)}).`;
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="sa-page">
      <header className="sa-head">
        <div>
          <h1>الطلبات</h1>
          <p>كل طلب يُرسل للواتساب يُسجَّل هنا. التأكيد يخصم الكمية من المخزن والإلغاء يعيدها، و«تم التسليم» يضيف النقاط لرصيد الزبون.</p>
        </div>
      </header>

      {tablesMissing ? (
        <div className="admin-card sa-empty">
          <ReceiptText aria-hidden="true" />
          <p>سجل الطلبات يبدأ بعد تشغيل ملف قاعدة البيانات</p>
          <span className="sa-muted">الطلبات تصلك على واتساب بشكل طبيعي حتى الآن.</span>
        </div>
      ) : (
        <>
          <div className="sa-toolbar">
            <div className="sa-segments" role="tablist">
              {[{ key: "all", label: "الكل" }, ...ORDER_STATUSES].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={status === s.key}
                  className={`sa-segment${status === s.key ? " is-active" : ""}`}
                  onClick={() => setStatus(s.key)}
                >
                  {s.label} <span>{counts[s.key] ?? 0}</span>
                </button>
              ))}
            </div>
            <label className="sa-search">
              <Search aria-hidden="true" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="رقم الطلب، الاسم، الهاتف…" />
            </label>
          </div>

          {visible.length === 0 ? (
            <div className="admin-card sa-empty"><ReceiptText aria-hidden="true" /><p>لا توجد طلبات</p></div>
          ) : (
            <div className="sa-orders">
              {visible.map((o) => {
                const isOpen = openId === o.id;
                return (
                  <article key={o.id} className={`admin-card sa-order${isOpen ? " is-open" : ""}`}>
                    <button type="button" className="sa-order-head" onClick={() => setOpenId(isOpen ? null : o.id)} aria-expanded={isOpen}>
                      <div className="sa-order-who">
                        <strong>{o.customer_name}</strong>
                        <span dir="ltr">{o.reference}</span>
                      </div>
                      <span className="sa-order-date">{dateFmt.format(new Date(o.created_at))}</span>
                      <span className={`sa-status sa-status--${o.status}`}>{orderStatusLabel(o.status)}</span>
                      <strong className="sa-order-total">{formatIQD(o.total)}</strong>
                      <ChevronDown aria-hidden="true" className="sa-order-chevron" />
                    </button>

                    {isOpen && (
                      <div className="sa-order-body">
                        <div className="sa-order-info">
                          <p><Phone aria-hidden="true" /><span dir="ltr">{o.customer_phone}</span></p>
                          <p><MapPin aria-hidden="true" />{o.city} — {o.address}</p>
                          {o.location_lat !== null && o.location_lng !== null && (
                            <p>
                              <Navigation aria-hidden="true" />
                              <a href={mapsLink({ lat: o.location_lat, lng: o.location_lng })} target="_blank" rel="noopener noreferrer" className="sa-more">
                                فتح موقع التوصيل على الخريطة
                              </a>
                            </p>
                          )}
                          {o.points_earned > 0 && (
                            <p>
                              <Star aria-hidden="true" />
                              {o.points_earned} نقطة {o.points_awarded ? "— أُضيفت لرصيد الزبون" : "— تُضاف عند تغيير الحالة إلى «تم التسليم»"}
                            </p>
                          )}
                          {o.notes && <p className="sa-order-notes">ملاحظات: {o.notes}</p>}
                        </div>
                        <table className="sa-order-items">
                          <thead>
                            <tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr>
                          </thead>
                          <tbody>
                            {o.items.map((it, i) => (
                              <tr key={i}>
                                <td>
                                  {it.name}
                                  {(it.size || it.flavor) && <small>{[it.size, it.flavor].filter(Boolean).join(" · ")}</small>}
                                </td>
                                <td>{it.qty}</td>
                                <td>{formatIQD(it.unitPrice)}</td>
                                <td>{formatIQD(it.unitPrice * it.qty)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr><td colSpan={3}>التوصيل</td><td>{o.delivery_fee ? formatIQD(o.delivery_fee) : "مجاني"}</td></tr>
                            <tr className="is-grand"><td colSpan={3}>الإجمالي</td><td>{formatIQD(o.total)}</td></tr>
                          </tfoot>
                        </table>
                        <div className="sa-order-actions">
                          <div className="sa-field sa-field--inline">
                            <span>الحالة</span>
                            <CustomSelect
                              className="sa-custom-select"
                              value={o.status}
                              onChange={(v) => v !== o.status && changeStatus(o, v)}
                              options={ORDER_STATUSES.map((s) => ({ value: s.key, label: s.label }))}
                            />
                          </div>
                          <a href={waCustomer(o)} target="_blank" rel="noopener noreferrer" className="btn-secondary sa-btn sa-btn--ghost sa-btn--sm">
                            <MessageCircle aria-hidden="true" /> مراسلة الزبون
                          </a>
                          <button type="button" className="sa-icon-btn sa-icon-btn--danger" onClick={() => remove(o)} aria-label="حذف الطلب" title="حذف الطلب">
                            <Trash2 aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
