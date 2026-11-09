"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, Eye, EyeOff, ExternalLink, ImagePlus, Pencil, Plus, Search, Star, Trash2, X } from "lucide-react";
import { CustomSelect } from "@/components/CustomSelect";
import AdminModal from "../../components/AdminModal";
import { confirmDialog } from "@/lib/confirmDialog";
import { uploadMediaWithProgress } from "@/lib/mediaUpload";
import {
  STORE_CATEGORIES,
  categoryLabel,
  formatIQD,
  isSoldOut,
  priceFor,
  sumVariants,
  type ProductSize,
  type StoreProduct,
  type VariantStock,
} from "@/lib/store/types";
import { ProductVisual } from "@/app/store/ProductVisual";
import { deleteProduct, saveProduct, setProductFlag, type ProductInput } from "../actions";

const BLANK: ProductInput = {
  id: null,
  slug: "",
  name: "",
  tagline: "",
  category: "protein",
  brand: "Abutabikh Nutrition",
  description: "",
  price: 0,
  compare_at_price: null,
  image_url: null,
  images: [],
  accent: "#60A5FA",
  highlights: [],
  features: [],
  usage: [],
  nutrition: [],
  ingredients: "",
  flavors: [],
  flavor_images: [],
  sizes: [{ label: "", price: 0 }],
  stock: null,
  variant_stock: [],
  low_stock_threshold: 5,
  is_active: true,
  is_featured: false,
  sort_order: 0,
};

const MAX_IMAGES = 8;
const MAX_FLAVORS = 12;

/* A flavour while it is being edited. `key` stays put as the name is typed. */
interface FlavorRow {
  key: string;
  label: string;
  src: string;
  fit?: number;
}

export default function ProductsClient({ initialProducts, isSample }: { initialProducts: StoreProduct[]; isSample: boolean }) {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState<ProductInput | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) => (category === "all" || p.category === category) && (!q || p.name.toLowerCase().includes(q))
    );
  }, [products, query, category]);

  const toggle = async (p: StoreProduct, flag: "is_active" | "is_featured") => {
    if (isSample) return toast.error("شغّل ملف قاعدة البيانات أولاً لتتمكن من التعديل");
    const value = !p[flag];
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, [flag]: value } : x)));
    const res = await setProductFlag(p.id, flag, value);
    if (!res.success) {
      toast.error(res.error);
      setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, [flag]: !value } : x)));
    }
  };

  const remove = async (p: StoreProduct) => {
    if (isSample) return toast.error("شغّل ملف قاعدة البيانات أولاً لتتمكن من التعديل");
    const ok = await confirmDialog(`سيُحذف "${p.name}" نهائياً من المتجر.`, {
      title: "حذف المنتج",
      confirmLabel: "حذف",
      danger: true,
    });
    if (!ok) return;
    const res = await deleteProduct(p.id);
    if (res.success) {
      setProducts((list) => list.filter((x) => x.id !== p.id));
      toast.success("تم حذف المنتج");
    } else toast.error(res.error);
  };

  const onSaved = (saved: StoreProduct) => {
    setProducts((list) => {
      const exists = list.some((x) => x.id === saved.id);
      return exists ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved];
    });
    setEditing(null);
  };

  return (
    <div className="sa-page">
      <header className="sa-head">
        <div>
          <h1>المنتجات</h1>
          <p>{products.length} منتج · {products.filter((p) => p.is_active).length} معروض في المتجر</p>
        </div>
        <button type="button" className="btn-primary sa-btn" onClick={() => setEditing({ ...BLANK, sizes: [{ label: "", price: 0 }] })}>
          <Plus aria-hidden="true" /> منتج جديد
        </button>
      </header>

      <div className="sa-toolbar">
        <label className="sa-search">
          <Search aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم المنتج…" />
        </label>
        <CustomSelect
          className="sa-custom-select"
          value={category}
          onChange={setCategory}
          options={[{ value: "all", label: "كل الأقسام" }, ...STORE_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))]}
        />
      </div>

      {visible.length === 0 ? (
        <div className="admin-card sa-empty"><p>لا توجد منتجات</p></div>
      ) : (
        <div className="sa-products">
          {visible.map((p) => (
            <article key={p.id} className={`admin-card sa-product${p.is_active ? "" : " is-hidden"}`} style={{ "--accent": p.accent } as React.CSSProperties}>
              <div className="sa-product-visual">
                <ProductVisual name={p.name} category={p.category} accent={p.accent} image_url={p.image_url} size={140} />
              </div>
              <div className="sa-product-body">
                <div className="sa-product-top">
                  <span className="sa-tag">{categoryLabel(p.category)}</span>
                  {p.is_featured && <span className="sa-tag sa-tag--star"><Star aria-hidden="true" /> مميز</span>}
                  {!p.is_active && <span className="sa-tag sa-tag--muted">مخفي</span>}
                  {isSoldOut(p) && <span className="sa-tag sa-tag--warn">نفد</span>}
                </div>
                <h3>{p.name}</h3>
                <div className="sa-product-meta">
                  <strong>{formatIQD(priceFor(p))}</strong>
                  <span>المخزون: {p.stock === null ? "غير محدود" : p.stock}</span>
                  {p.images.length > 1 && <span>{p.images.length} صور</span>}
                </div>
              </div>
              <div className="sa-product-actions">
                <button type="button" className="sa-icon-btn" onClick={() => setEditing({ ...p })} title="تعديل" aria-label={`تعديل ${p.name}`}>
                  <Pencil aria-hidden="true" />
                </button>
                <button type="button" className={`sa-icon-btn${p.is_featured ? " is-on" : ""}`} onClick={() => toggle(p, "is_featured")} title={p.is_featured ? "إخفاء شارة «الأكثر طلباً»" : "إظهار شارة «الأكثر طلباً»"} aria-label="تمييز">
                  <Star aria-hidden="true" />
                </button>
                <button type="button" className="sa-icon-btn" onClick={() => toggle(p, "is_active")} title={p.is_active ? "إخفاء من المتجر" : "إظهار في المتجر"} aria-label={p.is_active ? "إخفاء" : "إظهار"}>
                  {p.is_active ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                </button>
                <Link href={`/store/${p.slug}`} target="_blank" className="sa-icon-btn" title="عرض في المتجر" aria-label="عرض في المتجر">
                  <ExternalLink aria-hidden="true" />
                </Link>
                <button type="button" className="sa-icon-btn sa-icon-btn--danger" onClick={() => remove(p)} title="حذف" aria-label={`حذف ${p.name}`}>
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <ProductEditor
          initial={editing}
          isSample={isSample}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Editor
 * ------------------------------------------------------------------ */

function ProductEditor({
  initial,
  isSample,
  onClose,
  onSaved,
}: {
  initial: ProductInput;
  isSample: boolean;
  onClose: () => void;
  onSaved: (p: StoreProduct) => void;
}) {
  const [form, setForm] = useState<ProductInput>(() => ({
    ...initial,
    id: initial.id && !String(initial.id).startsWith("seed-") ? initial.id : null,
    sizes: initial.sizes.length ? initial.sizes : [{ label: "", price: initial.price }],
    images: initial.images?.length ? initial.images : initial.image_url ? [initial.image_url] : [],
  }));
  const [flavorRows, setFlavorRows] = useState<FlavorRow[]>(() =>
    initial.flavors.map((label, i) => {
      const photo = initial.flavor_images.find((f) => f.label === label);
      return { key: `f${i}`, label, src: photo?.src ?? "", fit: photo?.fit };
    })
  );
  const [flavorUploading, setFlavorUploading] = useState(false);
  /* One record per size row, in the same order: flavour row key -> what is typed. */
  const [counts, setCounts] = useState<Record<string, string>[]>(() =>
    (initial.sizes.length ? initial.sizes : [{ label: "", price: initial.price }]).map((s) => {
      const cells: Record<string, string> = {};
      const qtyOf = (flavor: string | null) => initial.variant_stock.find((v) => v.size === s.label && v.flavor === flavor)?.qty;
      initial.flavors.forEach((label, i) => {
        const qty = qtyOf(label);
        if (qty !== undefined) cells[`f${i}`] = String(qty);
      });
      const whole = qtyOf(null);
      if (whole !== undefined) cells[""] = String(whole);
      return cells;
    })
  );
  const [activeImage, setActiveImage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  /* Several at once, one after another; each lands in the gallery as it
     finishes, so a failure part-way keeps the ones already up. */
  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_IMAGES - (form.images?.length ?? 0);
    if (room <= 0) {
      toast.error(`الحد الأقصى ${MAX_IMAGES} صور لكل منتج`);
      return;
    }
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (picked.length < files.length) toast(`سيتم رفع ${picked.length} صور فقط`);
    setUploading(true);
    for (const file of picked) {
      const url = await uploadMediaWithProgress(file, { maxEdge: 1600 });
      if (url) setForm((f) => ({ ...f, images: [...(f.images ?? []), url] }));
      else toast.error(`تعذّر رفع ${file.name}`);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const moveImage = (from: number, to: number) => {
    setForm((f) => {
      const images = [...(f.images ?? [])];
      if (to < 0 || to >= images.length) return f;
      [images[from], images[to]] = [images[to], images[from]];
      return { ...f, images };
    });
    setActiveImage(to);
  };

  const removeImage = (index: number) => {
    setForm((f) => ({ ...f, images: (f.images ?? []).filter((_, i) => i !== index) }));
    setActiveImage(0);
  };

  const images = form.images ?? [];
  const shownImage = images[Math.min(activeImage, images.length - 1)] ?? null;

  /* A size row removed takes its column of counts with it. */
  const changeSizes = (next: ProductSize[]) => {
    if (next.length < form.sizes.length) {
      const found = form.sizes.findIndex((s) => !next.includes(s));
      const gone = found >= 0 ? found : form.sizes.length - 1;
      setCounts((list) => list.filter((_, i) => i !== gone));
    } else if (next.length > form.sizes.length) {
      setCounts((list) => [...list, {}]);
    }
    set("sizes", next);
  };

  const gridFlavors = flavorRows.filter((r) => r.label.trim()).map((r) => ({ key: r.key, flavor: r.label.trim() as string | null }));
  const gridColumns = gridFlavors.length > 0 ? gridFlavors : [{ key: "", flavor: null as string | null }];
  const variants: VariantStock[] = form.sizes.flatMap((s, i) =>
    !s.label.trim()
      ? []
      : gridColumns.flatMap(({ key, flavor }) => {
          const typed = (counts[i]?.[key] ?? "").trim();
          return typed === "" ? [] : [{ size: s.label.trim(), flavor, qty: Math.max(0, Math.floor(Number(typed)) || 0) }];
        })
  );

  const submit = async () => {
    if (isSample) {
      toast.error("شغّل ملف قاعدة البيانات أولاً لتتمكن من الحفظ");
      return;
    }
    const named = flavorRows.map((r) => ({ ...r, label: r.label.trim() }));
    if (named.some((r) => r.src && !r.label)) {
      toast.error("اكتب اسم النكهة التي رفعت صورتها");
      return;
    }
    setSaving(true);
    const res = await saveProduct({
      ...form,
      image_url: images[0] ?? null,
      variant_stock: variants,
      flavors: named.filter((r) => r.label).map((r) => r.label),
      flavor_images: named.filter((r) => r.label && r.src).map(({ label, src, fit }) => ({ label, src, ...(fit ? { fit } : {}) })),
    });
    setSaving(false);
    if (res.success && res.data) {
      toast.success(form.id ? "تم حفظ التعديلات" : "تمت إضافة المنتج");
      onSaved(res.data);
    } else if (!res.success) toast.error(res.error);
  };

  return (
    <AdminModal
      isOpen
      onClose={onClose}
      title={form.id ? `تعديل: ${initial.name}` : "منتج جديد"}
      icon="inventory_2"
      maxWidth={960}
      footer={
        <div className="sa-modal-foot">
          <button type="button" className="btn-secondary sa-btn sa-btn--ghost" onClick={onClose}>إلغاء</button>
          <button type="button" className="btn-primary sa-btn" onClick={submit} disabled={saving || uploading || flavorUploading}>
            {saving ? "جارِ الحفظ…" : "حفظ المنتج"}
          </button>
        </div>
      }
    >
      <div className="sa-editor">
        <aside className="sa-editor-preview" style={{ "--accent": form.accent } as React.CSSProperties}>
          <div className="sa-editor-visual">
            <ProductVisual name={form.name || "اسم المنتج"} category={form.category} accent={form.accent} image_url={shownImage} size={260} />
          </div>

          {/* The gallery. The first picture is the main one — on the card, in
              the cart and at the top of the product page. */}
          <div className="sa-gallery">
            {images.map((url, i) => (
              <div key={url + i} className={`sa-gallery-item${i === activeImage ? " is-active" : ""}`}>
                <button type="button" className="sa-gallery-pick" onClick={() => setActiveImage(i)} aria-label={`عرض الصورة ${i + 1}`}>
                  <ProductVisual name={form.name} category={form.category} accent={form.accent} image_url={url} size={72} />
                </button>
                {i === 0 && <span className="sa-gallery-main">الرئيسية</span>}
                <div className="sa-gallery-tools">
                  <button type="button" onClick={() => moveImage(i, i - 1)} disabled={i === 0} aria-label="تقديم">
                    <ChevronRight aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => removeImage(i)} aria-label="حذف الصورة" className="is-danger">
                    <X aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => moveImage(i, i + 1)} disabled={i === images.length - 1} aria-label="تأخير">
                    <ChevronLeft aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button type="button" className="sa-gallery-add" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <ImagePlus aria-hidden="true" />
                <span>{uploading ? "جارِ الرفع…" : "إضافة صور"}</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
          <p className="sa-hint">
            حتى {MAX_IMAGES} صور، الأولى هي الرئيسية. يمكنك اختيار عدة صور مرة واحدة. بدون صور، يُرسم المنتج تلقائياً بلونه.
          </p>
          <label className="sa-field">
            <span>لون المنتج</span>
            <div className="sa-color">
              <input type="color" value={form.accent} onChange={(e) => set("accent", e.target.value)} />
              <input type="text" dir="ltr" value={form.accent} onChange={(e) => set("accent", e.target.value)} />
            </div>
          </label>
          <label className="sa-check">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
            <span>معروض في المتجر</span>
          </label>
          <label className="sa-check">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} />
            <span>إظهار شارة «الأكثر طلباً» على بطاقة المنتج</span>
          </label>
        </aside>

        <div className="sa-editor-form">
          <fieldset className="sa-fieldset">
            <legend>المعلومات الأساسية</legend>
            <div className="sa-grid-2">
              <label className="sa-field">
                <span>اسم المنتج *</span>
                <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="واي بروتين جولد" />
              </label>
              <div className="sa-field">
                <span>القسم *</span>
                <CustomSelect
                  className="sa-custom-select"
                  value={form.category}
                  onChange={(v) => set("category", v)}
                  options={STORE_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
                />
              </div>
              <label className="sa-field">
                <span>الشعار المختصر</span>
                <input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="بروتين يبني. طعم يُقنع." />
              </label>
              <label className="sa-field">
                <span>العلامة التجارية</span>
                <input value={form.brand} onChange={(e) => set("brand", e.target.value)} />
              </label>
            </div>
            <label className="sa-field">
              <span>الوصف</span>
              <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </label>
            <label className="sa-field">
              <span>رابط الصفحة (بالإنجليزي)</span>
              <input dir="ltr" value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="whey-gold" />
            </label>
          </fieldset>

          <fieldset className="sa-fieldset">
            <legend>السعر والمخزون</legend>
            <Rows
              label="الأحجام والأسعار (أول حجم هو السعر الافتراضي)"
              items={form.sizes}
              onChange={changeSizes}
              blank={{ label: "", price: 0 }}
              render={(item, update) => (
                <>
                  <input value={item.label} onChange={(e) => update({ ...item, label: e.target.value })} placeholder="2 كغ" />
                  <input type="number" min={0} step={500} dir="ltr" value={item.price || ""} onChange={(e) => update({ ...item, price: Number(e.target.value) })} placeholder="السعر د.ع" />
                </>
              )}
            />
            <div className="sa-grid-2">
              <label className="sa-field">
                <span>السعر قبل الخصم (اختياري)</span>
                <input type="number" min={0} step={500} dir="ltr" value={form.compare_at_price ?? ""} onChange={(e) => set("compare_at_price", e.target.value === "" ? null : Number(e.target.value))} />
              </label>
              <label className="sa-field">
                <span>{variants.length > 0 ? "المخزون (مجموع الجدول بالأسفل)" : "المخزون (فارغ = غير محدود)"}</span>
                <input type="number" min={0} dir="ltr" disabled={variants.length > 0} value={variants.length > 0 ? sumVariants(variants) : (form.stock ?? "")} onChange={(e) => set("stock", e.target.value === "" ? null : Number(e.target.value))} />
              </label>
              <label className="sa-field">
                <span>تنبيه عند انخفاض المخزون إلى</span>
                <input type="number" min={0} dir="ltr" value={form.low_stock_threshold} onChange={(e) => set("low_stock_threshold", Number(e.target.value))} />
              </label>
            </div>
            <FlavorRows rows={flavorRows} setRows={setFlavorRows} onBusy={setFlavorUploading} category={form.category} accent={form.accent} />
            <VariantGrid
              sizes={form.sizes}
              columns={gridColumns}
              counts={counts}
              onChange={(sizeIndex, key, value) =>
                setCounts((list) => list.map((cells, i) => (i === sizeIndex ? { ...cells, [key]: value } : cells)))
              }
            />
          </fieldset>

          <fieldset className="sa-fieldset">
            <legend>محتوى صفحة العرض</legend>
            <Rows
              label="المميزات (تظهر كنقاط داخل الوصف)"
              items={form.features}
              max={6}
              onChange={(v) => set("features", v)}
              blank={{ title: "", text: "" }}
              stacked
              render={(item, update) => (
                <>
                  <input value={item.title} onChange={(e) => update({ ...item, title: e.target.value })} placeholder="العنوان" />
                  <textarea rows={2} value={item.text} onChange={(e) => update({ ...item, text: e.target.value })} placeholder="الشرح" />
                </>
              )}
            />
            <Rows
              label="طريقة الاستخدام (خطوات)"
              items={form.usage}
              max={8}
              onChange={(v) => set("usage", v)}
              blank=""
              render={(item, update) => (
                <input value={item} onChange={(e) => update(e.target.value)} placeholder="أضف سكوب واحد إلى 250 مل ماء" />
              )}
            />
            <Rows
              label="القيم الغذائية"
              items={form.nutrition}
              max={24}
              onChange={(v) => set("nutrition", v)}
              blank={{ label: "", value: "" }}
              render={(item, update) => (
                <>
                  <input value={item.label} onChange={(e) => update({ ...item, label: e.target.value })} placeholder="البروتين" />
                  <input value={item.value} onChange={(e) => update({ ...item, value: e.target.value })} placeholder="24 غرام" />
                </>
              )}
            />
            <label className="sa-field">
              <span>المكونات</span>
              <textarea rows={2} value={form.ingredients} onChange={(e) => set("ingredients", e.target.value)} />
            </label>
          </fieldset>
        </div>
      </div>
    </AdminModal>
  );
}

function Rows<T>({
  label,
  items,
  onChange,
  blank,
  render,
  max = 10,
  stacked,
}: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  blank: T;
  render: (item: T, update: (next: T) => void) => React.ReactNode;
  max?: number;
  stacked?: boolean;
}) {
  return (
    <div className="sa-rows">
      <span className="sa-rows-label">{label}</span>
      {items.map((item, i) => (
        <div key={i} className={`sa-row${stacked ? " sa-row--stacked" : ""}`}>
          <div className="sa-row-fields">{render(item, (next) => onChange(items.map((x, j) => (j === i ? next : x))))}</div>
          <button type="button" className="sa-icon-btn sa-icon-btn--danger" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="حذف السطر">
            <X aria-hidden="true" />
          </button>
        </div>
      ))}
      {items.length < max && (
        <button type="button" className="sa-add-row" onClick={() => onChange([...items, blank])}>
          <Plus aria-hidden="true" /> إضافة
        </button>
      )}
    </div>
  );
}

/* The count for each size and flavour. An empty cell is a combination that is
   not sold; a 0 is one that has sold out. */
function VariantGrid({
  sizes,
  columns,
  counts,
  onChange,
}: {
  sizes: ProductSize[];
  columns: { key: string; flavor: string | null }[];
  counts: Record<string, string>[];
  onChange: (sizeIndex: number, key: string, value: string) => void;
}) {
  const named = sizes.map((s, index) => ({ label: s.label.trim(), index })).filter((s) => s.label);
  if (named.length === 0) return null;
  return (
    <div className="sa-rows">
      <span className="sa-rows-label">المخزون لكل نكهة وحجم (فارغ = غير متوفر بهذا الحجم، 0 = نفدت)</span>
      <div className="sa-variants">
        <table>
          <thead>
            <tr>
              <th scope="col">النكهة</th>
              {named.map((s) => (
                <th key={s.index} scope="col">{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {columns.map(({ key, flavor }) => (
              <tr key={key}>
                <th scope="row">{flavor ?? "الكمية"}</th>
                {named.map((s) => (
                  <td key={s.index}>
                    <input
                      type="number"
                      min={0}
                      dir="ltr"
                      value={counts[s.index]?.[key] ?? ""}
                      onChange={(e) => onChange(s.index, key, e.target.value)}
                      aria-label={[flavor, s.label].filter(Boolean).join(" · ")}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* One row per flavour: its photo, its name. The first is the one a visitor
   lands on, and with two or more photos they become the product's gallery. */
function FlavorRows({
  rows,
  setRows,
  onBusy,
  category,
  accent,
}: {
  rows: FlavorRow[];
  setRows: React.Dispatch<React.SetStateAction<FlavorRow[]>>;
  onBusy: (busy: boolean) => void;
  category: string;
  accent: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<string | null>(null);
  const nextKey = useRef(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const patch = (key: string, change: Partial<FlavorRow>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...change } : r)));

  const pick = (key: string) => {
    targetRef.current = key;
    fileRef.current?.click();
  };

  const upload = async (file: File | undefined) => {
    const key = targetRef.current;
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !key) return;
    if (!file.type.startsWith("image/")) {
      toast.error("اختر ملف صورة");
      return;
    }
    setBusyKey(key);
    onBusy(true);
    const url = await uploadMediaWithProgress(file, { maxEdge: 1600 });
    /* A new photo has its own framing, so an old scale no longer applies. */
    if (url) patch(key, { src: url, fit: undefined });
    else toast.error(`تعذّر رفع ${file.name}`);
    setBusyKey(null);
    onBusy(false);
  };

  return (
    <div className="sa-rows">
      <span className="sa-rows-label">النكهات (الأولى تظهر افتراضياً، ولكل نكهة صورتها)</span>
      {rows.map((r) => (
        <div key={r.key} className="sa-row sa-flavor-row">
          <button
            type="button"
            className="sa-flavor-photo"
            onClick={() => pick(r.key)}
            disabled={busyKey !== null}
            title={r.src ? "تغيير الصورة" : "رفع صورة"}
            aria-label={`${r.src ? "تغيير صورة" : "رفع صورة"} ${r.label || "النكهة"}`}
          >
            {r.src ? <ProductVisual name={r.label} category={category} accent={accent} image_url={r.src} size={56} /> : <ImagePlus aria-hidden="true" />}
          </button>
          <div className="sa-row-fields">
            <input value={r.label} maxLength={40} onChange={(e) => patch(r.key, { label: e.target.value })} placeholder="اسم النكهة" aria-label="اسم النكهة" />
          </div>
          <button
            type="button"
            className="sa-icon-btn sa-icon-btn--danger"
            onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
            disabled={busyKey === r.key}
            aria-label={`حذف ${r.label || "النكهة"}`}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      ))}
      {rows.length < MAX_FLAVORS && (
        <button
          type="button"
          className="sa-add-row"
          onClick={() => setRows((list) => [...list, { key: `n${nextKey.current++}`, label: "", src: "" }])}
        >
          <Plus aria-hidden="true" /> إضافة نكهة
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
    </div>
  );
}

function TagInput({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="sa-field">
      <span>{label}</span>
      <div className="sa-tags">
        {values.map((v) => (
          <span key={v} className="sa-tag sa-tag--chip">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`حذف ${v}`}>
              <X aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
