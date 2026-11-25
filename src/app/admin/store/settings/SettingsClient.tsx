"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { ImagePlus, Save, X } from "lucide-react";
import { formatIQD, type StoreSettings } from "@/lib/store/types";
import { uploadMediaWithProgress } from "@/lib/mediaUpload";
import { saveStoreSettings } from "../actions";

export default function SettingsClient({ initialSettings }: { initialSettings: StoreSettings }) {
  const [form, setForm] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => setForm((f) => ({ ...f, [key]: value }));
  const promoFileRef = useRef<HTMLInputElement>(null);
  const [promoUploading, setPromoUploading] = useState(false);

  const uploadPromoImage = async (file: File | undefined) => {
    if (promoFileRef.current) promoFileRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("اختر ملف صورة");
      return;
    }
    setPromoUploading(true);
    const url = await uploadMediaWithProgress(file, { maxEdge: 1200 });
    setPromoUploading(false);
    if (url) set("promo_img_url", url);
    else toast.error(`تعذّر رفع ${file.name}`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await saveStoreSettings(form);
    setSaving(false);
    if (res.success) {
      if (res.data) setForm(res.data);
      toast.success("تم حفظ الإعدادات");
    } else toast.error(res.error);
  };

  return (
    <form className="sa-page" onSubmit={submit}>
      <header className="sa-head">
        <div>
          <h1>إعدادات المتجر</h1>
          <p>تُطبَّق فوراً على صفحة المتجر.</p>
        </div>
        <button type="submit" className="btn-primary sa-btn" disabled={saving || promoUploading}>
          <Save aria-hidden="true" /> {saving ? "جارِ الحفظ…" : "حفظ"}
        </button>
      </header>

      <div className="sa-settings">
        <section className="admin-card sa-panel">
          <h2>الطلبات والتوصيل</h2>
          <label className="sa-field">
            <span>رقم واتساب الذي تصله الطلبات</span>
            <input dir="ltr" inputMode="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="9647XXXXXXXXX" />
            <small>بالصيغة الدولية بدون + أو أصفار في البداية.</small>
          </label>
          <div className="sa-grid-2">
            <label className="sa-field">
              <span>أجور التوصيل (د.ع)</span>
              <input type="number" min={0} step={500} dir="ltr" value={form.delivery_fee} onChange={(e) => set("delivery_fee", Number(e.target.value))} />
            </label>
            <label className="sa-field">
              <span>توصيل مجاني فوق (د.ع)</span>
              <input type="number" min={0} step={5000} dir="ltr" value={form.free_delivery_over} onChange={(e) => set("free_delivery_over", Number(e.target.value))} />
              <small>{form.free_delivery_over > 0 ? `الطلبات من ${formatIQD(form.free_delivery_over)} فأكثر توصيلها مجاني` : "0 = بدون توصيل مجاني"}</small>
            </label>
          </div>
          <label className="sa-check">
            <input type="checkbox" checked={form.store_open} onChange={(e) => set("store_open", e.target.checked)} />
            <span>المتجر يستقبل طلبات</span>
          </label>
        </section>

        <section className="admin-card sa-panel">
          <h2>نقاط الولاء</h2>
          <label className="sa-field">
            <span>النقاط لكل 1,000 د.ع من قيمة الطلب</span>
            <input type="number" min={0} max={100} step={0.5} dir="ltr" value={form.points_per_1000} onChange={(e) => set("points_per_1000", Number(e.target.value))} />
            <small>
              {form.points_per_1000 > 0
                ? `طلب بقيمة 100,000 د.ع يكسب ${Math.floor(100 * form.points_per_1000)} نقطة. تُضاف عند التسليم. 0 = إيقاف النقاط.`
                : "النقاط متوقفة."}
            </small>
          </label>
        </section>

        <section className="admin-card sa-panel">
          <h2>نصوص المتجر</h2>
          <label className="sa-field">
            <span>شريط الإعلان أعلى المتجر</span>
            <input value={form.announcement} onChange={(e) => set("announcement", e.target.value)} placeholder="اتركه فارغاً لإخفائه" />
          </label>
          <label className="sa-field">
            <span>ضمان المنتج في صفحة المنتج</span>
            <input value={form.perk_original} onChange={(e) => set("perk_original", e.target.value)} placeholder="اتركه فارغاً لإخفائه" />
          </label>
          <label className="sa-field">
            <span>طريقة الطلب والدفع في صفحة المنتج</span>
            <input value={form.perk_order} onChange={(e) => set("perk_order", e.target.value)} placeholder="اتركه فارغاً لإخفائه" />
          </label>
        </section>

        {/* The store's own pop-up. Independent of the gym page's window, which
            is edited and switched in the content manager. */}
        <section className="admin-card sa-panel">
          <h2>النافذة الترويجية للمتجر</h2>
          <label className="sa-check">
            <input type="checkbox" checked={form.promo_active} onChange={(e) => set("promo_active", e.target.checked)} />
            <span>{form.promo_active ? "النافذة فعّالة — تظهر عند فتح المتجر" : "النافذة موقفة"}</span>
          </label>
          <label className="sa-field">
            <span>عنوان العرض</span>
            <input value={form.promo_title} maxLength={120} onChange={(e) => set("promo_title", e.target.value)} />
          </label>
          <label className="sa-field">
            <span>وصف العرض</span>
            <textarea rows={3} value={form.promo_desc} onChange={(e) => set("promo_desc", e.target.value)} />
          </label>
          <div className="sa-grid-2">
            <label className="sa-field">
              <span>شارة الخصم</span>
              <input value={form.promo_discount} maxLength={40} onChange={(e) => set("promo_discount", e.target.value)} placeholder="مثال: خصم 20% — اتركه فارغاً لإخفائه" />
            </label>
            <label className="sa-field">
              <span>نص الزر</span>
              <input value={form.promo_cta} maxLength={60} onChange={(e) => set("promo_cta", e.target.value)} />
            </label>
          </div>
          <label className="sa-field">
            <span>ينتهي العرض في</span>
            <input type="datetime-local" dir="ltr" value={form.promo_end_date} onChange={(e) => set("promo_end_date", e.target.value)} />
            <small>{form.promo_end_date ? "يظهر عدّاد تنازلي في النافذة حتى هذا الموعد." : "اتركه فارغاً لإخفاء العدّاد."}</small>
          </label>
          <div className="sa-field">
            <span>صورة العرض</span>
            {form.promo_img_url && (
              /* A one-off preview; the panel has no image slot of its own. */
              <img
                src={form.promo_img_url}
                alt="صورة العرض"
                style={{ width: "100%", maxWidth: 240, aspectRatio: "3 / 4", objectFit: "cover", borderRadius: "var(--radius-md)" }}
              />
            )}
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <button type="button" className="btn-secondary sa-btn" onClick={() => promoFileRef.current?.click()} disabled={promoUploading}>
                <ImagePlus aria-hidden="true" /> {promoUploading ? "جارِ الرفع…" : form.promo_img_url ? "تغيير الصورة" : "رفع صورة"}
              </button>
              {form.promo_img_url && (
                <button type="button" className="btn-secondary sa-btn" onClick={() => set("promo_img_url", "")} disabled={promoUploading}>
                  <X aria-hidden="true" /> إزالة الصورة
                </button>
              )}
            </div>
            <small>المقاس المقترح 600×800 (عمودية). بدون صورة تظهر النافذة بالنص فقط.</small>
            <input ref={promoFileRef} type="file" accept="image/*" hidden onChange={(e) => uploadPromoImage(e.target.files?.[0])} />
          </div>
        </section>
      </div>
    </form>
  );
}
