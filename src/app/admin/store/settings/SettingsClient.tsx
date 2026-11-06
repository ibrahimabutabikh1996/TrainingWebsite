"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Save } from "lucide-react";
import { formatIQD, type StoreSettings } from "@/lib/store/types";
import { saveStoreSettings } from "../actions";

export default function SettingsClient({ initialSettings }: { initialSettings: StoreSettings }) {
  const [form, setForm] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => setForm((f) => ({ ...f, [key]: value }));

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
        <button type="submit" className="btn-primary sa-btn" disabled={saving}>
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
            <span>العبارة الرئيسية (تظهر تحت المنتجات المتحركة)</span>
            <input value={form.hero_title} onChange={(e) => set("hero_title", e.target.value)} />
          </label>
          <label className="sa-field">
            <span>النص تحت العنوان</span>
            <textarea rows={3} value={form.hero_subtitle} onChange={(e) => set("hero_subtitle", e.target.value)} />
          </label>
        </section>
      </div>
    </form>
  );
}
