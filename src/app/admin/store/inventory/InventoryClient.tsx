"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, ArrowDownToLine, ClipboardCheck, History, Infinity as InfinityIcon, PackageCheck, PackageX, Search } from "lucide-react";
import AdminModal from "../../components/AdminModal";
import { CustomSelect } from "@/components/CustomSelect";
import { ProductVisual } from "@/app/store/ProductVisual";
import type { StoreProduct } from "@/lib/store/types";
import { changeStock, setLowStockThreshold, type StockAction } from "../actions";
import type { StockMovement } from "../data";

const dateFmt = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });

const REASONS: Record<string, string> = {
  restock: "استلام بضاعة",
  count: "جرد",
  order: "طلب مؤكد",
  order_reversed: "إرجاع طلب",
  tracking: "تتبع المخزون",
};

type Level = "untracked" | "out" | "low" | "ok";

function levelOf(p: StoreProduct): Level {
  if (p.stock === null) return "untracked";
  if (p.stock <= 0) return "out";
  if (p.stock <= p.low_stock_threshold) return "low";
  return "ok";
}

const LEVEL_LABEL: Record<Level, string> = { untracked: "غير متتبع", out: "نفد", low: "منخفض", ok: "متوفر" };

export default function InventoryClient({
  initialProducts,
  initialMovements,
  isSample,
}: {
  initialProducts: StoreProduct[];
  initialMovements: StockMovement[];
  isSample: boolean;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [movements, setMovements] = useState(initialMovements);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Level>("all");
  const [logProduct, setLogProduct] = useState("all");
  const [dialog, setDialog] = useState<{ product: StoreProduct; kind: "restock" | "count" } | null>(null);

  const stats = useMemo(() => {
    const tracked = products.filter((p) => p.stock !== null);
    return {
      units: tracked.reduce((n, p) => n + (p.stock ?? 0), 0),
      low: products.filter((p) => levelOf(p) === "low").length,
      out: products.filter((p) => levelOf(p) === "out").length,
      untracked: products.length - tracked.length,
    };
  }, [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const order: Record<Level, number> = { out: 0, low: 1, ok: 2, untracked: 3 };
    return products
      .filter((p) => (filter === "all" || levelOf(p) === filter) && (!q || p.name.toLowerCase().includes(q)))
      .sort((a, b) => order[levelOf(a)] - order[levelOf(b)]);
  }, [products, query, filter]);

  const shownMovements = logProduct === "all" ? movements : movements.filter((m) => m.product_id === logProduct);

  const guard = () => {
    if (isSample) {
      toast.error("شغّل ملفي قاعدة البيانات أولاً لتفعيل المخزن");
      return false;
    }
    return true;
  };

  const apply = async (product: StoreProduct, action: StockAction, note?: string) => {
    if (!guard()) return false;
    const res = await changeStock(product.id, action);
    if (!res.success || !res.data) {
      if (!res.success) toast.error(res.error);
      return false;
    }
    const after = res.data.stock;
    const before = product.stock;
    setProducts((list) => list.map((p) => (p.id === product.id ? { ...p, stock: after } : p)));
    if (after !== before) {
      setMovements((list) => [
        {
          id: `local-${Date.now()}`,
          product_id: product.id,
          product_name: product.name,
          change: (after ?? 0) - (before ?? 0),
          stock_after: after,
          reason: action.kind === "track" ? "tracking" : action.kind,
          order_reference: null,
          note: note || (action.kind === "track" ? (action.tracked ? "تفعيل تتبع المخزون" : "إيقاف تتبع المخزون") : null),
          created_at: new Date().toISOString(),
        },
        ...list,
      ]);
    }
    toast.success("تم تحديث المخزون");
    return true;
  };

  const saveThreshold = async (product: StoreProduct, value: number) => {
    if (value === product.low_stock_threshold || !guard()) return;
    setProducts((list) => list.map((p) => (p.id === product.id ? { ...p, low_stock_threshold: value } : p)));
    const res = await setLowStockThreshold(product.id, value);
    if (!res.success) toast.error(res.error);
  };

  const statCards = [
    { label: "إجمالي القطع بالمخزن", value: stats.units, icon: PackageCheck, tone: "primary", level: "all" as const },
    { label: "منخفض", value: stats.low, icon: AlertTriangle, tone: stats.low ? "warning" : "muted", level: "low" as const },
    { label: "نفد", value: stats.out, icon: PackageX, tone: stats.out ? "danger" : "muted", level: "out" as const },
    { label: "غير متتبع", value: stats.untracked, icon: InfinityIcon, tone: "muted", level: "untracked" as const },
  ];

  return (
    <div className="sa-page">
      <header className="sa-head">
        <div>
          <h1>المخزن</h1>
          <p>كميات المنتجات، استلام البضاعة والجرد. تأكيد أي طلب يخصم منه تلقائياً، وإلغاؤه يعيد الكمية.</p>
        </div>
      </header>

      <div className="sa-stats">
        {statCards.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setFilter(s.level)}
            className={`admin-card sa-stat sa-stat--${s.tone}${filter === s.level ? " is-selected" : ""}`}
          >
            <span className="sa-stat-icon"><s.icon aria-hidden="true" /></span>
            <span className="sa-stat-label">{s.label}</span>
            <strong className="sa-stat-value">{s.value}</strong>
          </button>
        ))}
      </div>

      <div className="sa-toolbar">
        <label className="sa-search">
          <Search aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم المنتج…" />
        </label>
        <CustomSelect
          className="sa-custom-select"
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          options={[
            { value: "all", label: "كل المنتجات" },
            { value: "out", label: "نفد" },
            { value: "low", label: "منخفض" },
            { value: "ok", label: "متوفر" },
            { value: "untracked", label: "غير متتبع" },
          ]}
        />
      </div>

      <div className="admin-card sa-table-wrap">
        <table className="sa-table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>الكمية</th>
              <th>الحالة</th>
              <th>تنبيه عند</th>
              <th aria-label="إجراءات" />
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const level = levelOf(p);
              return (
                <tr key={p.id} style={{ "--accent": p.accent } as React.CSSProperties}>
                  <td>
                    <div className="sa-cell-product">
                      <span className="sa-thumb">
                        <ProductVisual name={p.name} category={p.category} accent={p.accent} image_url={p.image_url} size={48} />
                      </span>
                      <span>{p.name}</span>
                    </div>
                  </td>
                  <td className="sa-cell-num">{p.stock === null ? "∞" : p.stock}</td>
                  <td><span className={`sa-level sa-level--${level}`}>{LEVEL_LABEL[level]}</span></td>
                  <td>
                    {p.stock === null ? (
                      <span className="sa-muted">—</span>
                    ) : (
                      <input
                        className="sa-inline-num"
                        type="number"
                        min={0}
                        dir="ltr"
                        defaultValue={p.low_stock_threshold}
                        aria-label={`حد التنبيه لـ ${p.name}`}
                        onBlur={(e) => saveThreshold(p, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      />
                    )}
                  </td>
                  <td>
                    <div className="sa-row-actions">
                      {p.stock === null ? (
                        <button type="button" className="btn-secondary sa-btn sa-btn--ghost sa-btn--sm" onClick={() => apply(p, { kind: "track", tracked: true })}>
                          تفعيل التتبع
                        </button>
                      ) : (
                        <>
                          <button type="button" className="btn-secondary sa-btn sa-btn--ghost sa-btn--sm" onClick={() => setDialog({ product: p, kind: "restock" })}>
                            <ArrowDownToLine aria-hidden="true" /> استلام
                          </button>
                          <button type="button" className="btn-secondary sa-btn sa-btn--ghost sa-btn--sm" onClick={() => setDialog({ product: p, kind: "count" })}>
                            <ClipboardCheck aria-hidden="true" /> جرد
                          </button>
                          <button
                            type="button"
                            className="sa-icon-btn"
                            title="إيقاف تتبع المخزون (متوفر دائماً)"
                            aria-label="إيقاف تتبع المخزون"
                            onClick={() => apply(p, { kind: "track", tracked: false })}
                          >
                            <InfinityIcon aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && <div className="sa-empty"><p>لا توجد منتجات</p></div>}
      </div>

      <section className="admin-card sa-panel">
        <div className="sa-panel-head">
          <h2><History aria-hidden="true" className="sa-h-icon" /> سجل حركة المخزن</h2>
          <CustomSelect
            className="sa-custom-select"
            value={logProduct}
            onChange={setLogProduct}
            searchable
            options={[{ value: "all", label: "كل المنتجات" }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
          />
        </div>
        {shownMovements.length === 0 ? (
          <p className="sa-muted">لا توجد حركات بعد.</p>
        ) : (
          <ul className="sa-log">
            {shownMovements.map((m) => (
              <li key={m.id}>
                <span className={`sa-log-change ${m.change > 0 ? "is-in" : m.change < 0 ? "is-out" : ""}`} dir="ltr">
                  {m.change > 0 ? `+${m.change}` : m.change}
                </span>
                <div className="sa-log-body">
                  <strong>{m.product_name}</strong>
                  <span>
                    {REASONS[m.reason] ?? m.reason}
                    {m.order_reference && <> · <span dir="ltr">{m.order_reference}</span></>}
                    {m.note && <> · {m.note}</>}
                  </span>
                </div>
                <div className="sa-log-meta">
                  <span>{m.stock_after === null ? "غير متتبع" : `الرصيد: ${m.stock_after}`}</span>
                  <time>{dateFmt.format(new Date(m.created_at))}</time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dialog && (
        <StockDialog
          product={dialog.product}
          kind={dialog.kind}
          onClose={() => setDialog(null)}
          onSubmit={async (value, note) => {
            const ok = await apply(
              dialog.product,
              dialog.kind === "restock" ? { kind: "restock", qty: value, note } : { kind: "count", stock: value, note },
              note
            );
            if (ok) setDialog(null);
          }}
        />
      )}
    </div>
  );
}

function StockDialog({
  product,
  kind,
  onClose,
  onSubmit,
}: {
  product: StoreProduct;
  kind: "restock" | "count";
  onClose: () => void;
  onSubmit: (value: number, note: string) => Promise<void>;
}) {
  const [value, setValue] = useState(kind === "count" ? String(product.stock ?? 0) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Math.floor(Number(value));
  const valid = value !== "" && Number.isFinite(n) && (kind === "restock" ? n > 0 : n >= 0);
  const after = kind === "restock" ? (product.stock ?? 0) + (valid ? n : 0) : valid ? n : product.stock ?? 0;

  return (
    <AdminModal
      isOpen
      onClose={onClose}
      title={kind === "restock" ? `استلام بضاعة: ${product.name}` : `جرد: ${product.name}`}
      icon="inventory_2"
      maxWidth={460}
      footer={
        <div className="sa-modal-foot">
          <button type="button" className="btn-secondary sa-btn sa-btn--ghost" onClick={onClose}>إلغاء</button>
          <button
            type="button"
            className="btn-primary sa-btn"
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true);
              await onSubmit(n, note);
              setBusy(false);
            }}
          >
            {busy ? "جارِ الحفظ…" : "حفظ"}
          </button>
        </div>
      }
    >
      <div className="sa-dialog-body">
        <label className="sa-field">
          <span>{kind === "restock" ? "الكمية المستلمة" : "الكمية الموجودة فعلياً"}</span>
          <input type="number" min={kind === "restock" ? 1 : 0} dir="ltr" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label className="sa-field">
          <span>ملاحظة (اختياري)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "restock" ? "اسم المورد، رقم الفاتورة…" : "سبب الفرق…"} />
        </label>
        <p className="sa-stock-preview">
          الحالي <strong>{product.stock ?? 0}</strong> ← بعد الحفظ <strong>{after}</strong>
        </p>
      </div>
    </AdminModal>
  );
}
