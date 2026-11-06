import { requireAdminPage } from "@/lib/authGuard";
import { Icon } from "@/components/Icon";
import "./design.css";

/* The Lit Glass reference: every component of the design system at every
 * level, on one screen. The coach's alone — no permission is passed to the
 * guard, the same rule as Overview and Analytics.
 *
 * Nothing here reads data. It is the place to look before building a new
 * screen, and the place to check after a change to src/styles/lit/. */

export const dynamic = "force-dynamic";

function Swatch({ name, label }: { name: string; label: string }) {
  return (
    <div className="dsg-swatch">
      <span className="dsg-swatch-chip" style={{ background: `var(${name})` }} />
      <span className="dsg-swatch-name">{label}</span>
      <code>{name}</code>
    </div>
  );
}

export default async function DesignSystemPage() {
  await requireAdminPage();

  return (
    <div className="dsg-page" dir="rtl">
      <header className="ui-page-head">
        <div className="ui-page-head-text">
          <span className="ui-eyebrow">نظام التصميم</span>
          <h1 className="ui-page-title">الزجاج المضيء</h1>
          <p className="ui-page-sub">كل مكوّن بالموقع من نفس المادة: زجاج داكن وحافة ضوء. الفرق الوحيد هو مستوى الإضاءة.</p>
        </div>
        <div className="ui-page-actions">
          <button type="button" className="ui-btn ui-btn--secondary">مستند التصميم</button>
          <button type="button" className="ui-btn ui-btn--primary">
            <Icon name="add" />
            مكوّن جديد
          </button>
        </div>
      </header>

      {/* Levels */}
      <section className="ui-section">
        <h2 className="ui-section-title">المستويات الثلاثة</h2>
        <div className="dsg-grid dsg-grid--3">
          <div className="ui-card ui-card--featured dsg-level">
            <span className="ui-badge">المستوى ١ — مضيء</span>
            <p>حافة كاملة وتوهج داخلي، والضوء يدور مع المؤشر. للإجراء الرئيسي والعنصر النشط.</p>
            <button type="button" className="ui-btn ui-btn--primary">اختر الخطة</button>
          </div>
          <div className="ui-card dsg-level">
            <span className="ui-badge">المستوى ٢ — محدّد</span>
            <p>نفس الحافة بنسبة أقل، وتكتمل عند المرور. للإجراءات الثانوية.</p>
            <button type="button" className="ui-btn ui-btn--secondary">إلغاء</button>
          </div>
          <div className="ui-card dsg-level">
            <span className="ui-badge">المستوى ٣ — هادئ</span>
            <p>زجاج بدون حافة، تظهر الحافة عند المرور فقط. للأيقونات والفلاتر.</p>
            <div className="dsg-row">
              <button type="button" className="ui-btn ui-btn--icon" aria-label="تعديل"><Icon name="edit" /></button>
              <button type="button" className="ui-btn ui-btn--icon" aria-label="بحث"><Icon name="search" /></button>
              <button type="button" className="ui-btn ui-btn--ghost">عرض الكل</button>
            </div>
          </div>
        </div>
      </section>

      {/* Buttons */}
      <section className="ui-section">
        <h2 className="ui-section-title">الأزرار — الأحجام والألوان</h2>
        <div className="ui-card dsg-stack">
          <div className="dsg-row">
            <button type="button" className="ui-btn ui-btn--primary ui-btn--lg">كبير</button>
            <button type="button" className="ui-btn ui-btn--primary">متوسط</button>
            <button type="button" className="ui-btn ui-btn--primary ui-btn--sm">صغير</button>
            <button type="button" className="ui-btn ui-btn--primary" disabled>معطّل</button>
          </div>
          <div className="dsg-row">
            <button type="button" className="ui-btn ui-btn--primary ui-btn--danger"><Icon name="delete" />حذف</button>
            <button type="button" className="ui-btn ui-btn--primary ui-btn--success"><Icon name="check" />موافقة</button>
            <button type="button" className="ui-btn ui-btn--primary ui-btn--warning"><Icon name="warning" />تنبيه</button>
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--danger">رفض</button>
            <button type="button" className="ui-btn ui-btn--icon ui-btn--danger" aria-label="حذف"><Icon name="delete" /></button>
          </div>
        </div>
      </section>

      {/* Tabs, chips, fields */}
      <section className="ui-section">
        <h2 className="ui-section-title">التبويبات والفلاتر والحقول</h2>
        <div className="ui-card dsg-stack">
          <div className="ui-segment" role="tablist" aria-label="مثال تبويبات">
            <button type="button" role="tab" className="ui-tab" aria-selected="true">الكل</button>
            <button type="button" role="tab" className="ui-tab" aria-selected="false">النشطين</button>
            <button type="button" role="tab" className="ui-tab" aria-selected="false">المنتهية</button>
          </div>
          <div className="dsg-row">
            <button type="button" className="ui-chip is-active">بروتين</button>
            <button type="button" className="ui-chip">كرياتين</button>
            <button type="button" className="ui-chip">فيتامينات</button>
          </div>
          <div className="dsg-grid dsg-grid--2">
            <label className="ui-field">
              <span className="ui-field-label">اسم المشترك</span>
              <input className="ui-field-control" placeholder="محمد علي" />
              <span className="ui-field-hint">يظهر بالقائمة وبالتقارير.</span>
            </label>
            <label className="ui-field">
              <span className="ui-field-label">ملاحظات</span>
              <textarea className="ui-field-control" placeholder="اكتب ملاحظة للمدرب" />
            </label>
          </div>
        </div>
      </section>

      {/* Icons and badges */}
      <section className="ui-section">
        <h2 className="ui-section-title">الأيقونات والشارات</h2>
        <div className="ui-card dsg-stack">
          <div className="dsg-row">
            <span className="ui-icon-tile ui-icon-tile--sm"><Icon name="group" /></span>
            <span className="ui-icon-tile"><Icon name="monitoring" /></span>
            <span className="ui-icon-tile ui-icon-tile--lg ui-icon-tile--lit"><Icon name="emoji_events" /></span>
            <span className="ui-icon-tile ui-icon-tile--lit tone-success"><Icon name="check_circle" /></span>
            <span className="ui-icon-tile ui-icon-tile--lit tone-danger"><Icon name="error" /></span>
          </div>
          <div className="dsg-row">
            <span className="ui-badge">جديد</span>
            <span className="ui-badge tone-success">مكتمل</span>
            <span className="ui-badge tone-warning">بانتظار المراجعة</span>
            <span className="ui-badge tone-danger">منتهي</span>
            <span className="ui-count">3</span>
            <span className="ui-avatar is-active">م</span>
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <section className="ui-section">
        <h2 className="ui-section-title">بطاقات الأرقام</h2>
        <div className="dsg-grid dsg-grid--3">
          {[
            { icon: "group" as const, label: "المشتركين النشطين", value: "128", trend: "+12 هذا الشهر" },
            { icon: "inventory_2" as const, label: "طلبات المتجر", value: "34", trend: "+5 هذا الأسبوع" },
            { icon: "emoji_events" as const, label: "تحديات بانتظار المراجعة", value: "7", trend: "منذ أمس" },
          ].map((kpi) => (
            <div key={kpi.label} className="ui-card ui-card--featured dsg-kpi">
              <span className="ui-icon-tile ui-icon-tile--lit"><Icon name={kpi.icon} /></span>
              <div>
                <div className="dsg-kpi-value">{kpi.value}</div>
                <div className="dsg-kpi-label">{kpi.label}</div>
                <div className="dsg-kpi-trend"><Icon name="trending_up" /> {kpi.trend}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Table */}
      <section className="ui-section">
        <h2 className="ui-section-title">الجداول</h2>
        <div className="ui-table-wrap">
          <table className="ui-table ui-table--stack">
            <thead>
              <tr>
                <th>المشترك</th>
                <th>الخطة</th>
                <th>الحالة</th>
                <th className="is-num">الأيام المتبقية</th>
                <th aria-label="إجراءات" />
              </tr>
            </thead>
            <tbody>
              {[
                { name: "علي حسن", plan: "خطة شهرية", status: "نشط", tone: "tone-success", days: 21 },
                { name: "سارة محمد", plan: "خطة أسبوعية", status: "قارب الانتهاء", tone: "tone-warning", days: 3 },
                { name: "حيدر كريم", plan: "بدون متابعة", status: "منتهي", tone: "tone-danger", days: 0 },
              ].map((row, i) => (
                <tr key={row.name} className={i === 0 ? "is-selected" : undefined}>
                  <td data-label="المشترك">{row.name}</td>
                  <td data-label="الخطة">{row.plan}</td>
                  <td data-label="الحالة"><span className={`ui-badge ${row.tone}`}>{row.status}</span></td>
                  <td data-label="الأيام المتبقية" className="is-num">{row.days}</td>
                  <td data-label="إجراءات">
                    <button type="button" className="ui-btn ui-btn--icon ui-btn--sm" aria-label="تعديل"><Icon name="edit" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Window */}
      <section className="ui-section">
        <h2 className="ui-section-title">النوافذ</h2>
        <div className="dsg-window-stage">
          <div className="ui-window dsg-window" role="dialog" aria-label="مثال نافذة">
            <div className="ui-window-head">
              <span className="ui-icon-tile ui-icon-tile--sm ui-icon-tile--lit tone-danger"><Icon name="delete" /></span>
              <h3 className="ui-window-title">حذف المشترك؟</h3>
              <button type="button" className="ui-btn ui-btn--icon ui-btn--sm dsg-window-close" aria-label="إغلاق"><Icon name="close" /></button>
            </div>
            <div className="ui-window-body">سيتم حذف بيانات المشترك وسجل تمارينه نهائياً. لا يمكن التراجع عن هذا الإجراء.</div>
            <div className="ui-window-foot">
              <button type="button" className="ui-btn ui-btn--secondary">إلغاء</button>
              <button type="button" className="ui-btn ui-btn--primary ui-btn--danger">حذف نهائي</button>
            </div>
          </div>
        </div>
      </section>

      {/* States */}
      <section className="ui-section">
        <h2 className="ui-section-title">الحالات</h2>
        <div className="dsg-grid dsg-grid--2">
          <div className="ui-card dsg-stack">
            <div className="dsg-row"><span className="ui-spinner" /> <span className="ui-spinner--inline" /> جاري التحميل</div>
            <div className="ui-progress"><span className="ui-progress-fill" style={{ width: "64%" }} /></div>
            <div>
              <span className="ui-skeleton ui-skeleton--title" />
              <span className="ui-skeleton ui-skeleton--text" />
              <span className="ui-skeleton ui-skeleton--text" style={{ width: "70%" }} />
            </div>
          </div>
          <div className="ui-card">
            <div className="ui-empty">
              <Icon name="search_off" />
              <h3 className="ui-empty-title">ماكو نتائج</h3>
              <p className="ui-empty-text">جرّب كلمة بحث ثانية أو امسح الفلاتر.</p>
              <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm">مسح الفلاتر</button>
            </div>
          </div>
        </div>
        <div className="dsg-stack dsg-alerts">
          <div className="ui-alert"><Icon name="info" /> تم حفظ التغييرات وستظهر للمشترك فوراً.</div>
          <div className="ui-alert ui-alert--success"><Icon name="check_circle" /> تمت الموافقة على التحدي.</div>
          <div className="ui-alert ui-alert--warning"><Icon name="warning" /> اشتراك ٣ مشتركين ينتهي هذا الأسبوع.</div>
          <div className="ui-alert ui-alert--danger"><Icon name="error" /> تعذّر رفع الصورة. حاول مرة ثانية.</div>
        </div>
      </section>

      {/* Palette */}
      <section className="ui-section">
        <h2 className="ui-section-title">الألوان</h2>
        <div className="ui-card dsg-swatches">
          <Swatch name="--primary" label="الأساسي" />
          <Swatch name="--primary-light" label="الفاتح" />
          <Swatch name="--primary-active" label="العميق" />
          <Swatch name="--success" label="نجاح" />
          <Swatch name="--warning" label="تنبيه" />
          <Swatch name="--danger" label="خطر" />
          <Swatch name="--bg" label="الخلفية" />
          <Swatch name="--bg2" label="السطح" />
          <Swatch name="--bg3" label="السطح المرتفع" />
        </div>
      </section>
    </div>
  );
}
