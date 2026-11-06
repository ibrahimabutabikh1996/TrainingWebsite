"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { MapPin, MessageCircle, Phone, ReceiptText, Search, Star, Users } from "lucide-react";
import AdminModal from "../../components/AdminModal";
import { CustomSelect } from "@/components/CustomSelect";
import { formatIQD, mapsLink, orderStatusLabel, type StoreOrder } from "@/lib/store/types";
import { adjustCustomerPoints, loadCustomer, saveCustomerNotes } from "../actions";
import type { CustomerSummary, PointsEntry } from "../data";

const dateFmt = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", { dateStyle: "medium" });
const dateTimeFmt = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });

const POINT_REASONS: Record<string, string> = {
  order: "طلب تم تسليمه",
  order_reversed: "إرجاع نقاط طلب",
  manual: "تعديل يدوي",
};

type Sort = "recent" | "points" | "spent" | "orders";

export default function CustomersClient({ initialCustomers, tablesMissing }: { initialCustomers: CustomerSummary[]; tablesMissing: boolean }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [openId, setOpenId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = customers.filter((c) => !q || `${c.name} ${c.phone} ${c.city}`.toLowerCase().includes(q));
    const by: Record<Sort, (a: CustomerSummary, b: CustomerSummary) => number> = {
      recent: (a, b) => (b.last_order_at ?? b.created_at).localeCompare(a.last_order_at ?? a.created_at),
      points: (a, b) => b.points - a.points,
      spent: (a, b) => b.total_spent - a.total_spent,
      orders: (a, b) => b.orders_count - a.orders_count,
    };
    return [...list].sort(by[sort]);
  }, [customers, query, sort]);

  const totals = useMemo(
    () => ({
      count: customers.length,
      points: customers.reduce((n, c) => n + c.points, 0),
      repeat: customers.filter((c) => c.orders_count > 1).length,
    }),
    [customers]
  );

  const open = customers.find((c) => c.id === openId) ?? null;

  return (
    <div className="sa-page">
      <header className="sa-head">
        <div>
          <h1>الزبائن</h1>
          <p>كل زبون يُعرف برقم هاتفه. النقاط تُضاف لرصيده عند تسليم الطلب.</p>
        </div>
      </header>

      {tablesMissing ? (
        <div className="admin-card sa-empty">
          <Users aria-hidden="true" />
          <p>سجل الزبائن يبدأ بعد تشغيل ملفي قاعدة البيانات</p>
          <span className="sa-muted">prisma/manual/2026-11-04-store.sql ثم 2026-11-04-store-v2.sql</span>
        </div>
      ) : (
        <>
          <div className="sa-stats sa-stats--3">
            <div className="admin-card sa-stat sa-stat--primary">
              <span className="ui-icon-tile ui-icon-tile--lit sa-stat-icon"><Users aria-hidden="true" /></span>
              <span className="sa-stat-label">عدد الزبائن</span>
              <strong className="sa-stat-value">{totals.count}</strong>
            </div>
            <div className="admin-card sa-stat sa-stat--success">
              <span className="ui-icon-tile ui-icon-tile--lit sa-stat-icon"><ReceiptText aria-hidden="true" /></span>
              <span className="sa-stat-label">زبائن طلبوا أكثر من مرة</span>
              <strong className="sa-stat-value">{totals.repeat}</strong>
            </div>
            <div className="admin-card sa-stat sa-stat--warning">
              <span className="ui-icon-tile ui-icon-tile--lit sa-stat-icon"><Star aria-hidden="true" /></span>
              <span className="sa-stat-label">مجموع النقاط</span>
              <strong className="sa-stat-value">{totals.points}</strong>
            </div>
          </div>

          <div className="sa-toolbar">
            <label className="sa-search">
              <Search aria-hidden="true" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="الاسم، الهاتف، المحافظة…" />
            </label>
            <CustomSelect
              className="sa-custom-select"
              value={sort}
              onChange={(v) => setSort(v as Sort)}
              options={[
                { value: "recent", label: "الأحدث طلباً" },
                { value: "points", label: "الأكثر نقاطاً" },
                { value: "spent", label: "الأكثر شراءً" },
                { value: "orders", label: "الأكثر طلبات" },
              ]}
            />
          </div>

          {visible.length === 0 ? (
            <div className="admin-card sa-empty"><Users aria-hidden="true" /><p>لا يوجد زبائن بعد</p></div>
          ) : (
            <div className="admin-card sa-table-wrap">
              <table className="sa-table sa-table--click">
                <thead>
                  <tr>
                    <th>الزبون</th>
                    <th>المحافظة</th>
                    <th>الطلبات</th>
                    <th>المشتريات</th>
                    <th>النقاط</th>
                    <th>آخر طلب</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr key={c.id} onClick={() => setOpenId(c.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpenId(c.id)}>
                      <td>
                        <div className="sa-cell-person">
                          <strong>{c.name}</strong>
                          <span dir="ltr">{c.phone}</span>
                        </div>
                      </td>
                      <td>{c.city || "—"}</td>
                      <td className="sa-cell-num">{c.orders_count}</td>
                      <td>{formatIQD(c.total_spent)}</td>
                      <td><span className="sa-points"><Star aria-hidden="true" />{c.points}</span></td>
                      <td className="sa-muted">{c.last_order_at ? dateFmt.format(new Date(c.last_order_at)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {open && (
        <CustomerDialog
          customer={open}
          onClose={() => setOpenId(null)}
          onPoints={(points) => setCustomers((list) => list.map((c) => (c.id === open.id ? { ...c, points } : c)))}
          onNotes={(notes) => setCustomers((list) => list.map((c) => (c.id === open.id ? { ...c, notes } : c)))}
        />
      )}
    </div>
  );
}

function CustomerDialog({
  customer: c,
  onClose,
  onPoints,
  onNotes,
}: {
  customer: CustomerSummary;
  onClose: () => void;
  onPoints: (points: number) => void;
  onNotes: (notes: string) => void;
}) {
  const [detail, setDetail] = useState<{ orders: StoreOrder[]; points: PointsEntry[] } | null>(null);
  const [tab, setTab] = useState<"orders" | "points">("orders");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState(c.notes ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCustomer(c.id).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setDetail(res.data);
      else if (!res.success) toast.error(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [c.id]);

  const adjust = async (sign: 1 | -1) => {
    const n = Math.floor(Math.abs(Number(delta)));
    if (!n) return toast.error("اكتب عدد النقاط");
    setBusy(true);
    const res = await adjustCustomerPoints(c.id, sign * n, reason);
    setBusy(false);
    if (res.success && res.data) {
      const points = res.data.points;
      onPoints(points);
      setDetail((d) =>
        d && {
          ...d,
          points: [
            { id: `local-${Date.now()}`, change: points - c.points, balance_after: points, reason: "manual", order_reference: null, note: reason, created_at: new Date().toISOString() },
            ...d.points,
          ],
        }
      );
      setDelta("");
      setReason("");
      toast.success("تم تعديل النقاط");
    } else if (!res.success) toast.error(res.error);
  };

  const intl = c.phone.replace(/^0/, "964");

  return (
    <AdminModal isOpen onClose={onClose} title={c.name} icon="person" maxWidth={820}>
      <div className="sa-customer">
        <div className="sa-customer-top">
          <div className="sa-customer-info">
            <p><Phone aria-hidden="true" /><span dir="ltr">{c.phone}</span></p>
            <p><MapPin aria-hidden="true" />{[c.city, c.address].filter(Boolean).join(" — ") || "—"}</p>
            <p className="sa-muted">زبون منذ {dateFmt.format(new Date(c.created_at))}</p>
            <a href={`https://wa.me/${intl}`} target="_blank" rel="noopener noreferrer" className="btn-secondary sa-btn sa-btn--ghost sa-btn--sm">
              <MessageCircle aria-hidden="true" /> مراسلة على واتساب
            </a>
          </div>
          <div className="sa-customer-figures">
            <div><span>الطلبات</span><strong>{c.orders_count}</strong></div>
            <div><span>المشتريات</span><strong>{formatIQD(c.total_spent)}</strong></div>
            <div className="is-points"><span>رصيد النقاط</span><strong><Star aria-hidden="true" />{c.points}</strong></div>
          </div>
        </div>

        <label className="sa-field">
          <span>ملاحظات عن الزبون</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={async () => {
              if (notes === (c.notes ?? "")) return;
              const res = await saveCustomerNotes(c.id, notes);
              if (res.success) {
                onNotes(notes);
                toast.success("تم حفظ الملاحظة");
              } else toast.error(res.error);
            }}
            placeholder="تفضيلاته، ملاحظات التوصيل…"
          />
        </label>

        <div className="sa-segments" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "orders"} className={`sa-segment${tab === "orders" ? " is-active" : ""}`} onClick={() => setTab("orders")}>
            سجل الطلبات <span>{detail?.orders.length ?? "…"}</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === "points"} className={`sa-segment${tab === "points" ? " is-active" : ""}`} onClick={() => setTab("points")}>
            النقاط <span>{detail?.points.length ?? "…"}</span>
          </button>
        </div>

        {!detail ? (
          <p className="sa-muted">جارِ التحميل…</p>
        ) : tab === "orders" ? (
          detail.orders.length === 0 ? (
            <p className="sa-muted">لا توجد طلبات.</p>
          ) : (
            <ul className="sa-history">
              {detail.orders.map((o) => (
                <li key={o.id}>
                  <div className="sa-history-head">
                    <strong dir="ltr">{o.reference}</strong>
                    <span className={`sa-status sa-status--${o.status}`}>{orderStatusLabel(o.status)}</span>
                    <time>{dateTimeFmt.format(new Date(o.created_at))}</time>
                    <strong className="sa-history-total">{formatIQD(o.total)}</strong>
                  </div>
                  <p className="sa-history-items">
                    {o.items.map((it) => `${it.qty} × ${it.name}${it.flavor ? ` (${it.flavor})` : ""}`).join("، ")}
                  </p>
                  <div className="sa-history-foot">
                    {o.points_earned > 0 && (
                      <span className={`sa-points${o.points_awarded ? "" : " is-pending"}`}>
                        <Star aria-hidden="true" />
                        {o.points_earned} {o.points_awarded ? "أُضيفت" : "تُضاف عند التسليم"}
                      </span>
                    )}
                    {o.location_lat !== null && o.location_lng !== null && (
                      <a href={mapsLink({ lat: o.location_lat, lng: o.location_lng })} target="_blank" rel="noopener noreferrer" className="sa-more">
                        <MapPin aria-hidden="true" /> الموقع
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          <>
            <div className="sa-points-adjust">
              <input type="number" min={1} dir="ltr" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="عدد النقاط" aria-label="عدد النقاط" />
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="السبب (مطلوب): هدية، تصحيح…" aria-label="سبب التعديل" />
              <button type="button" className="btn-primary sa-btn sa-btn--sm" disabled={busy} onClick={() => adjust(1)}>إضافة</button>
              <button type="button" className="btn-secondary sa-btn sa-btn--ghost sa-btn--sm" disabled={busy} onClick={() => adjust(-1)}>خصم</button>
            </div>
            {detail.points.length === 0 ? (
              <p className="sa-muted">لا توجد حركة نقاط بعد.</p>
            ) : (
              <ul className="sa-log">
                {detail.points.map((p) => (
                  <li key={p.id}>
                    <span className={`sa-log-change ${p.change > 0 ? "is-in" : "is-out"}`} dir="ltr">{p.change > 0 ? `+${p.change}` : p.change}</span>
                    <div className="sa-log-body">
                      <strong>{POINT_REASONS[p.reason] ?? p.reason}</strong>
                      <span>
                        {p.order_reference && <span dir="ltr">{p.order_reference}</span>}
                        {p.order_reference && p.note && " · "}
                        {p.note}
                      </span>
                    </div>
                    <div className="sa-log-meta">
                      <span>الرصيد: {p.balance_after}</span>
                      <time>{dateTimeFmt.format(new Date(p.created_at))}</time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </AdminModal>
  );
}
