"use client";

import { hasRealImage, PLACEHOLDER_IMAGE } from "@/lib/placeholderImage";
import type { JsonRecord, Testimonial } from "@/types";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { saveLandingContent, listImagesServer, deleteImageServer } from "./actions";
import { uploadMediaWithProgress } from '@/lib/mediaUpload';
import { Toaster, toast } from 'react-hot-toast';
import Cropper from 'react-easy-crop';
import getCroppedImg, { DEFAULT_MAX_EDGE } from '@/lib/cropUtils';
import { Icon } from "@/components/Icon";
import { previewSrc } from "@/lib/imageOptim";
import { Overlay } from "@/components/ui/Overlay";
import { CustomSelect } from "@/components/CustomSelect";
import "./cms.css";

const DEFAULT_TEXTS: Record<string, string> = {
  hero_title: "تدرب بقوة\\nتدرب بذكاء",
  hero_sub: "برامج لياقة بدنية نخبوية مصممة للمنجزين الجادين",
  hero_quote: "قاعدتي في الدايت: لا تدعه يستمر لأكثر من 3 أشهر",
  hero_btn: "تسجيل الدخول",
  login_title: "مرحباً بك مجدداً",
  login_subtitle: "الرجاء إدخال بياناتك لتسجيل الدخول.",
  coach_title: "تعرف على المدرب",
  coach_name: "إبراهيم أبو طبيخ",
  coach_cert: "مدرب شخصي وخبير تغذية معتمد",
  coach_bio1: "بخبرة تزيد عن 10 سنوات في تحويل الأجسام...",
  coach_bio2: "أنا لا أعطيك خطة فقط؛ أنا أعطيك أسلوب حياة جديد.",
  mem_title: "الخطط والاشتراكات",
  card1_badge: "خطة ذاتية التوجيه",
  card1_desc: "مناسبة للأشخاص الملتزمين الذين يحتاجون فقط إلى التوجيه الصحيح في التدريب والنظام الغذائي.",
  card1_p1_label: "عرض جدول تدريب + نظام غذائي",
  card1_p1_val: "25,000 دينار",
  card1_p2_label: "جدول تدريب فقط",
  card1_p2_val: "15,000 دينار",
  card1_p3_label: "نظام غذائي فقط",
  card1_p3_val: "15,000 دينار",
  card1_f1: "جدول تدريب ممتاز",
  card1_f2: "نظام غذائي ممتاز",
  card1_f3: "اعتمد على نفسك",
  card2_badge: "خطة المتابعة الأسبوعية",
  card2_desc: "مناسبة للأشخاص الذين يجدون صعوبة في الالتزام ويحتاجون إلى خطة منظمة وخطة المتابعة الأسبوعية للوصول إلى أهدافهم.",
  card2_p1_label: "الشهر الأول",
  card2_p1_val: "50,000 دينار",
  card2_p2_label: "الشهر الثاني (تجديد)",
  card2_p2_val: "30,000 دينار",
  card2_f1: "قواعد غذائية خاصة",
  card2_f2: "خطة المتابعة الأسبوعية",
  card2_f3: "تنظيم أسلوب حياتك",
  card3_badge: "خطة المتابعة اليومية",
  card3_desc: "هذه هي الطريقة الأكثر ضماناً للوصول إلى هدفك. المتابعة اليومية ستساعدك على الالتزام. مثالية للأشخاص الذين جربوا كل شيء ولم يستطيعوا الالتزام.",
  card3_p1_label: "خطة نظام غذائي كاملة لمدة 3 أشهر",
  card3_p1_val: "300,000 دينار",
  card3_p2_label: "دفع شهري (شهر واحد)",
  card3_p2_val: "120,000 دينار",
  card3_f1: "خطة المتابعة اليومية",
  card3_f2: "التزام مضمون",
  card3_f3: "أضمن طريق للوصول لهدفك",
  contact_eyebrow: "ابق على تواصل",
  contact_title: "معلومات التواصل",
  contact_phone: "+964 770 000 0000",
  contact_email: "info@ibrahiemgym.com",
  contact_ig: "@ibrahiem_gym",
};

interface CropArea { x: number; y: number; width: number; height: number }

const CMSContext = React.createContext<JsonRecord>({});

/** The content key that says whether a field's element is shown to visitors.
 *  Same shape and same reading as the section switches — absent means shown, so
 *  every field that has never been touched keeps behaving exactly as it did. */
export const visibilityKey = (fieldKey: string) => `${fieldKey}_active`;

const InputField = ({ label, fieldKey, isTextarea = false, forceDir, hideable = false }: { label: string, fieldKey: string, isTextarea?: boolean, forceDir?: "rtl" | "ltr", hideable?: boolean }) => {
  const { currentContent, setContent } = React.useContext(CMSContext);
  const defaultText = DEFAULT_TEXTS[fieldKey] || "";
  const shown = currentContent[visibilityKey(fieldKey)] !== "false";

  return (
    <div className="cms-form-group">
      {/* The label and, where the field may be turned off, the eye beside it.
          `hideable` is opt-in rather than the default: this is one shared
          component behind all 39 text fields, and switching them all on at once
          would put a control on rows where hiding the element makes no sense —
          a price with no figure, a card left with an empty body. The four Hero
          rows carry it now; adding a fifth is one word on that row. */}
      <div className="cms-label-row">
        <label className="cms-label">{label}</label>
        {hideable && (
          <button
            type="button"
            className={`cms-visibility-toggle${shown ? "" : " is-hidden"}`}
            onClick={() => setContent(visibilityKey(fieldKey), shown ? "false" : "true")}
            aria-pressed={!shown}
            title={shown ? "إخفاء هذا العنصر من الصفحة" : "إظهار هذا العنصر في الصفحة"}
          >
            <Icon name={shown ? "visibility" : "visibility_off"} />
            <span>{shown ? "ظاهر" : "مخفي"}</span>
          </button>
        )}
      </div>
      {isTextarea ? (
        <textarea
          value={currentContent[fieldKey] || ""}
          onChange={(e) => setContent(fieldKey, e.target.value)}
          placeholder={defaultText}
          /* Two rows, not four. Every description on this screen is one or two
             sentences, and the box stays resizable for the ones that aren't. */
          rows={2}
          dir={forceDir ?? "rtl"}
          className="cms-textarea"
        />
      ) : (
        <input
          type="text"
          value={currentContent[fieldKey] || ""}
          onChange={(e) => setContent(fieldKey, e.target.value)}
          placeholder={defaultText}
          dir={forceDir ?? "rtl"}
          className="cms-input"
        />
      )}
    </div>
  );
};

/* One switch, everywhere on this screen.
   It was ten hand-written checkboxes tinted with an inline `accentColor`, at
   three different sizes (16px, 18px, 20px) depending on the call site, each
   wrapped in its own inline flex row. The visual is `.ui-switch` in
   globals.css; the `<input type="checkbox">` itself is untouched and only
   moved off-screen, so label association, the tab order and keyboard toggling
   are still the browser's, not ours. */
const Switch = ({ checked, onChange, label, disabled = false }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
}) => (
  <label className="ui-switch">
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="ui-switch-track" aria-hidden="true" />
    {label != null && <span className="ui-switch-label">{label}</span>}
  </label>
);

const PhoneInputField = ({ label, fieldKey }: { label: string, fieldKey: string }) => {
  const { currentContent, setContent } = React.useContext(CMSContext);

  const val = currentContent[fieldKey] || "";
  let code = "+964", p1 = "", p2 = "", p3 = "";

  const parts = val.split(" ");
  if (parts.length >= 4) {
    code = parts[0]; p1 = parts[1]; p2 = parts[2]; p3 = parts.slice(3).join(" ");
  } else {
    const digits = val.replace(/\D/g, '');
    if (digits.startsWith('+964') && digits.length >= 14) {
      code = '+964'; p1 = digits.slice(4, 7); p2 = digits.slice(7, 10); p3 = digits.slice(10);
    } else if (digits.startsWith('0') && digits.length >= 11) {
      code = '+964'; p1 = digits.slice(1, 4); p2 = digits.slice(4, 7); p3 = digits.slice(7);
    } else {
      code = val;
    }
  }

  const update = (c: string, x1: string, x2: string, x3: string) => {
    setContent(fieldKey, `${c} ${x1} ${x2} ${x3}`.trim());
  };

  return (
    <div className="cms-form-group">
      <label className="cms-label">{label}</label>
      {/* The four segments are one control, so they share one border and one
          focus ring rather than each drawing its own separator. Geometry is in
          `.cms-phone`; the parsing above is unchanged. */}
      <div className="cms-phone">
        <input
          type="text"
          value={code}
          onChange={(e) => update(e.target.value, p1, p2, p3)}
          className="cms-phone-code"
          placeholder="+964"
          aria-label="مفتاح الدولة"
        />
        <span className="cms-phone-sep" />
        <input
          type="text"
          value={p1}
          onChange={(e) => update(code, e.target.value.replace(/\D/g, ''), p2, p3)}
          className="cms-phone-p1"
          maxLength={3}
          placeholder="787"
          aria-label="مقدمة الرقم"
        />
        <span className="cms-phone-sep" />
        <input
          type="text"
          value={p2}
          onChange={(e) => update(code, p1, e.target.value.replace(/\D/g, ''), p3)}
          className="cms-phone-p2"
          maxLength={3}
          placeholder="751"
          aria-label="وسط الرقم"
        />
        <span className="cms-phone-sep" />
        <input
          type="text"
          value={p3}
          onChange={(e) => update(code, p1, p2, e.target.value.replace(/\D/g, ''))}
          className="cms-phone-p3"
          maxLength={4}
          placeholder="1605"
          aria-label="نهاية الرقم"
        />
      </div>
    </div>
  );
};

const ImageUploadField = ({ label, fieldKey, recommendedSize }: { label: string, fieldKey: string, recommendedSize?: string }) => {
  const { currentContent, handleImageUpload, isUploading, openMediaSelector, handleDeleteImage, isSaving, setPreviewImageUrl } = React.useContext(CMSContext);
  const imageUrl = currentContent[fieldKey];
  const hasImage = hasRealImage(imageUrl);

  return (
    <div className="cms-form-group">
      <label className="cms-label">{label}</label>

      {/* One row: the thumbnail and the three things you can do to it.
          It used to be a 76px drop zone, then a full-width "choose from
          library" button, then a preview card up to 320px tall — ~500px per
          image, on a screen that has nine of them.
          The file input still covers the whole row, so dragging a file onto it
          works exactly as it did; the action buttons sit above it in the stack
          so their own clicks are not swallowed. */}
      <div className="ui-media-field">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleImageUpload(e, fieldKey)}
          disabled={isUploading}
          className="cms-media-dropzone"
          title="اسحب صورة هنا أو انقر للاختيار"
          aria-label={`رفع ${label}`}
        />

        <div className={`ui-media-thumb${hasImage ? "" : " is-empty"}`}>
          {hasImage ? (
            <img
              /* 76x76 on screen; ask for twice that and no more. This box is
                 where the fifty-megapixel original used to land. */
              src={previewSrc(imageUrl, 152)}
              alt={label}
              decoding="async"
              onClick={() => setPreviewImageUrl(imageUrl)}
              style={{ cursor: "zoom-in" }}
            />
          ) : (
            <Icon name="image" />
          )}
        </div>

        <div className="ui-media-body">
          <span className="ui-media-hint">
            {isUploading
              ? "جاري معالجة ورفع الصورة..."
              : hasImage
                ? "اسحب صورة جديدة هنا لاستبدالها."
                : "اسحب الصورة هنا أو استخدم الأزرار أدناه."}
          </span>
          {recommendedSize && !isUploading && (
            <span className="cms-media-rec">الأبعاد الموصى بها: {recommendedSize}</span>
          )}

          <div className="ui-media-actions">
            <span className="ui-media-btn is-upload">
              <Icon name="upload" />
              <span>رفع</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, fieldKey)}
                disabled={isUploading}
                className="ui-media-file"
                aria-label={`رفع ${label}`}
              />
            </span>

            <button
              type="button"
              onClick={() => openMediaSelector(fieldKey)}
              disabled={isUploading}
              className="ui-media-btn"
            >
              <Icon name="photo_library" />
              <span>من المكتبة</span>
            </button>

            {hasImage && (
              <>
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(imageUrl)}
                  className="ui-media-btn"
                  title="عرض الصورة بالحجم الكامل"
                >
                  <Icon name="visibility" />
                  <span>عرض</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteImage(fieldKey)}
                  disabled={isUploading || isSaving}
                  className="ui-media-btn is-danger"
                  title="حذف الصورة"
                >
                  <Icon name="delete" />
                  <span>حذف</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const TestimonialsEditor = () => {
  const { currentContent, setContent, processAndUploadImage, handleSave, isSaving } = React.useContext(CMSContext);
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  const testimonials: Testimonial[] = Array.isArray(currentContent.testimonials) ? currentContent.testimonials : [];

  const updateTestimonial = (index: number, key: keyof Testimonial, value: string) => {
    const updated = [...testimonials];
    updated[index] = { ...updated[index], [key]: value };
    setContent("testimonials", updated);
  };

  const addTestimonial = () => {
    setContent("testimonials", [...testimonials, { type: "text", text: "", author_name: "", author_role: "", media_url: "" }]);
    setExpandedIndex(testimonials.length);
  };

  const removeTestimonial = (index: number) => {
    const updated = testimonials.filter((_, i) => i !== index);
    setContent("testimonials", updated);
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const moveTestimonial = (index: number, dir: 1 | -1) => {
    if (index + dir < 0 || index + dir >= testimonials.length) return;
    const updated = [...testimonials];
    const temp = updated[index];
    updated[index] = updated[index + dir];
    updated[index + dir] = temp;
    setContent("testimonials", updated);

    if (expandedIndex === index) setExpandedIndex(index + dir);
    else if (expandedIndex === index + dir) setExpandedIndex(index);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (processAndUploadImage) {
      const url = await processAndUploadImage(file);
      if (url) {
        updateTestimonial(index, "media_url", url);
      }
    }
    e.target.value = '';
  };

  return (
    <div className="cms-section-card">
      <div className="cms-media-head">
        <div className="cms-media-head-text">
          <h3 className="cms-card-title">نتائج المشتركين</h3>
          <p className="cms-media-info">إدارة النتائج وقصص النجاح التي تظهر في الصفحة الرئيسية.</p>
        </div>
        <button type="button" onClick={addTestimonial} className="cms-btn-primary">
          <Icon name="add" />
          <span>إضافة نتيجة جديدة</span>
        </button>
      </div>

      {testimonials.length === 0 ? (
        <p className="cms-empty">لا توجد نتائج مضافة حالياً. سيتم عرض الأمثلة الافتراضية في الموقع.</p>
      ) : (
        <div className="cms-testimonial-list">
          {testimonials.map((t, idx) => {
            const isExpanded = expandedIndex === idx;

            return (
              <div key={idx} className={`cms-testimonial${isExpanded ? " is-open" : ""}`}>

                {/* Accordion Header */}
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className="cms-testimonial-head"
                >
                  <div className="cms-testimonial-id">
                    <div className="cms-testimonial-num">{idx + 1}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="cms-testimonial-name">{t.author_name || "نتيجة جديدة (بدون اسم)"}</div>
                      <div className="cms-testimonial-meta">
                        النوع: {t.type === 'text' ? 'نص فقط' : t.type === 'image' ? 'صورة' : t.type === 'video' ? 'فيديو' : 'صوت'}
                      </div>
                    </div>
                  </div>

                  <div className="cms-testimonial-actions" onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={() => moveTestimonial(idx, -1)} disabled={idx === 0} className="cms-row-btn" title="تحريك لأعلى" aria-label="تحريك لأعلى">↑</button>
                    <button type="button" onClick={() => moveTestimonial(idx, 1)} disabled={idx === testimonials.length - 1} className="cms-row-btn" title="تحريك لأسفل" aria-label="تحريك لأسفل">↓</button>
                    <button type="button" onClick={() => removeTestimonial(idx)} className="cms-row-btn is-danger">حذف</button>
                    <Icon name={isExpanded ? "expand_less" : "expand_more"} style={{ color: "var(--text-muted)" }} />
                  </div>
                </div>

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="cms-testimonial-body">
                    <div className="ui-grid-2">
                      <div className="cms-form-group">
                        <label className="cms-label">النوع</label>
                        <CustomSelect
                          value={t.type || "text"}
                          onChange={(v) => updateTestimonial(idx, "type", v)}
                          options={[
                            { value: "text", label: "نص فقط" },
                            { value: "image", label: "صورة + نص" },
                            { value: "audio", label: "مقطع صوتي + نص" },
                            { value: "video", label: "مقطع فيديو + نص" },
                          ]}
                        />
                      </div>
                      <div className="cms-form-group">
                        <label className="cms-label">اسم المشترك</label>
                        <input type="text" value={t.author_name || ""} onChange={(e) => updateTestimonial(idx, "author_name", e.target.value)} className="cms-input" placeholder="مثال: أحمد علي" />
                      </div>
                    </div>

                    <div className="cms-form-group" style={{ marginBottom: 0 }}>
                      <label className="cms-label">الخطة المشترك بها</label>
                      <CustomSelect
                        value={t.author_role || ""}
                        onChange={(v) => updateTestimonial(idx, "author_role", v)}
                        placeholder="-- اختر الخطة --"
                        options={[
                          /* The empty row is kept as a real option, not just as
                             the placeholder, so the coach can clear a plan they
                             set by mistake — which the native <select> allowed. */
                          { value: "", label: "-- اختر الخطة --" },
                          ...[
                            currentContent.card1_badge || "خطة ذاتية التوجيه",
                            currentContent.card2_badge || "خطة المتابعة الأسبوعية",
                            currentContent.card3_badge || "خطة المتابعة اليومية",
                          ].map((badge) => ({
                            value: `مشترك في ${badge}`,
                            label: `مشترك في ${badge}`,
                          })),
                        ]}
                      />
                    </div>

                    {t.type !== "text" && (
                      <div className="cms-testimonial-media">
                        <label className="cms-label">الوسائط (صورة، فيديو، أو مقطع صوتي)</label>
                        <div className="cms-media-url-row">
                          <input type="text" value={t.media_url || ""} onChange={(e) => updateTestimonial(idx, "media_url", e.target.value)} className="cms-input" placeholder="رابط الملف المباشر..." dir="ltr" />
                          <span className="ui-media-btn is-upload">
                            <Icon name="upload" />
                            <span>رفع ملف</span>
                            <input
                              type="file"
                              accept={t.type === "image" ? "image/*" : t.type === "video" ? "video/*" : "audio/*"}
                              onChange={(e) => handleMediaUpload(e, idx)}
                              className="ui-media-file"
                              aria-label="رفع ملف الوسائط"
                            />
                          </span>
                        </div>
                        {t.media_url && (
                          <div className="cms-media-preview">
                            {t.type === "image" && <img src={previewSrc(t.media_url, 384)} alt={t.author_name ? `صورة نتيجة ${t.author_name}` : "معاينة الصورة المرفقة"} loading="lazy" decoding="async" />}
                            {t.type === "video" && <video src={t.media_url} controls />}
                            {t.type === "audio" && <audio src={t.media_url} controls />}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="cms-form-group" style={{ marginBottom: 0 }}>
                      <label className="cms-label">نص النتيجة</label>
                      <textarea
                        value={t.text || ""}
                        onChange={(e) => updateTestimonial(idx, "text", e.target.value)}
                        className="cms-textarea"
                        rows={3}
                        placeholder="اكتب قصة نجاح أو نتيجة المشترك هنا..."
                      />
                    </div>

                    <div className="cms-testimonial-save">
                      <button type="button" onClick={handleSave} disabled={isSaving} className="cms-btn-primary">
                        {isSaving ? (
                          <>
                            <div className="cms-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                            <span>جاري الحفظ...</span>
                          </>
                        ) : (
                          <>
                            <Icon name="save" />
                            <span>حفظ التعديلات والنشر</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function AdminCMSClient({ initialAr }: { initialAr: JsonRecord }) {
  const [contentAr, setContentAr] = useState(initialAr);
  /* Snapshot of what is actually stored, so edits can be compared against it.
     Nothing tracked unsaved state before: switching tab or closing the tab
     discarded every pending edit without a word. */
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialAr));
  /* Compared as a whole rather than with a per-field flag: edits land in
     several nested shapes, and one snapshot cannot drift out of step with them
     the way a scattered set of flags would. */
  const isDirty = JSON.stringify(contentAr) !== savedSnapshot;
  const [activeTab, setActiveTab] = useState("hero");

  /* The tab strip scrolls sideways with its scrollbar hidden, and it overflows
     on every screen narrower than 1920px — two of the ten tabs are off the end
     at 1366px, five at 768px, with nothing on screen saying so. These drive the
     arrows that make the hidden ones reachable, and go flat at each end so the
     strip says where it is. */
  const tabStripRef = useRef<HTMLDivElement>(null);
  const [tabScroll, setTabScroll] = useState({ start: false, end: false });

  const readTabScroll = useCallback(() => {
    const el = tabStripRef.current;
    if (!el) return;
    /* `scrollLeft` is negative in a right-to-left strip, so distance from each
       edge is taken as an absolute — the sign is the direction, not the amount. */
    const offset = Math.abs(el.scrollLeft);
    const max = el.scrollWidth - el.clientWidth;
    setTabScroll({ start: offset > 1, end: offset < max - 1 });
  }, []);

  useEffect(() => {
    readTabScroll();
    const el = tabStripRef.current;
    if (!el) return;
    el.addEventListener("scroll", readTabScroll, { passive: true });
    window.addEventListener("resize", readTabScroll);
    return () => {
      el.removeEventListener("scroll", readTabScroll);
      window.removeEventListener("resize", readTabScroll);
    };
  }, [readTabScroll]);

  const scrollTabs = (direction: 1 | -1) => {
    tabStripRef.current?.scrollBy({ left: direction * 240, behavior: "smooth" });
  };
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [mediaLibrary, setMediaLibrary] = useState<{name: string, url: string}[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  /* The bucket holds more than one page. Shown, rather than letting the grid
     just stop — an image that exists and is not listed reads as a lost image. */
  const [mediaHasMore, setMediaHasMore] = useState(false);
  const previewWindowRef = React.useRef<Window | null>(null);
  /* A `tabsRef` and a `scrollTabs` helper sat here to scroll the tab strip by
     250px at a time. Nothing held the ref and nothing called the helper — the
     arrow buttons they belonged to are not in this file — so both are removed.
     If the arrows come back, they come back with their own handler. */

  // Crop Modal States
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  /* The pixel rectangle the cropper reports back, and what the crop helper needs. */
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [cropFieldKey, setCropFieldKey] = useState<string | undefined>(undefined);
  const [cropAspect, setCropAspect] = useState<number | undefined>(undefined);

  // Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [activeMediaSelectField, setActiveMediaSelectField] = useState<string | null>(null);

  /* Opens the home page as it will look once this draft is published.
   *
   * `/cms-preview` rather than `/?preview=true`: the preview is the coach's
   * screen and is gated as one, and giving it its own route is what lets it
   * render with the landing page's stylesheet alone and with the navigation a
   * signed-out visitor sees. See the page's own note.
   *
   * The sign-in screen has its own route now, `/cms-preview/login`, gated and
   * dressed the same way. It used to open the working `/login?preview=true` —
   * a live sign-in form with nothing to say it was a preview. */
  const handleOpenPreview = () => {
    let url = "/cms-preview";
    if (activeTab === "login") {
      url = "/cms-preview/login";
    } else if (activeTab === "contact") {
      url = "/cms-preview#contact";
    } else if (activeTab === "membership") {
      url = "/cms-preview#membership";
    } else if (activeTab === "coach") {
      url = "/cms-preview#coach";
    }

    /* Written before the window opens so the draft is already there when the
       preview reads it on mount. Guarded for the same reason as the effect
       above: a full quota must not stop the preview from opening. */
    try {
      localStorage.setItem("cms_preview_data", JSON.stringify({ payload: contentAr }));
    } catch (error) {
      console.warn("Could not store the preview draft:", error);
    }

    previewWindowRef.current = window.open(url, "cms_preview");
    if (previewWindowRef.current) {
      previewWindowRef.current.focus();
    }
  };

  const loadMedia = async () => {
    setIsLoadingMedia(true);
    const { images, hasMore } = await listImagesServer();
    setMediaLibrary(images);
    setMediaHasMore(hasMore);
    setIsLoadingMedia(false);
  };

  useEffect(() => {
    if (activeTab === "media") {
      loadMedia();
    }
  }, [activeTab]);

  /* Last line of defence: the browser's own confirmation when closing or
     reloading with edits that were never published. */
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  /* Publishing the draft to the preview, on a timer rather than on every change.
   *
   * `contentAr` changes on each keystroke, and this used to serialise the whole
   * document and write it to localStorage every time — a synchronous stringify
   * and a synchronous disk-backed write per character typed, which is exactly
   * the work that makes a long form feel like it is lagging behind the keyboard.
   * A quarter second of quiet is imperceptible to someone typing and collapses a
   * sentence's worth of writes into one.
   *
   * The write is also guarded now. localStorage throws when the origin's quota
   * is full, and an exception thrown from inside an effect with no handler takes
   * the editor down with it — losing the unsaved draft, which is the one thing
   * this feature exists to protect. */
  useEffect(() => {
    const timer = setTimeout(() => {
      const payload = JSON.stringify({ payload: contentAr });

      try {
        localStorage.setItem("cms_preview_data", payload);
      } catch (error) {
        console.warn("Could not store the preview draft:", error);
      }

      /* Addressed to this origin rather than "*". The preview is a window this
         page opened, but a window handle outlives what is loaded in it: if it
         is navigated elsewhere, a wildcard target hands the whole draft to
         whatever is there now. */
      if (previewWindowRef.current && !previewWindowRef.current.closed) {
        previewWindowRef.current.postMessage(
          { type: "CMS_PREVIEW", payload: contentAr },
          window.location.origin
        );
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [contentAr]);

  const currentContent = contentAr;
  /* Most fields are text, but `testimonials` is a list of records. The
     parameter said `string`, so every testimonial write cast itself to `any` to
     get past it — six casts to work around one signature that was too narrow
     for what the function already did. */
  const setContent = (key: string, value: string | Testimonial[]) => {
    setContentAr({ ...contentAr, [key]: value });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const attempt = JSON.stringify(contentAr);
    const result = await saveLandingContent(contentAr);
    setIsSaving(false);
    if (result.success) {
      /* Marks exactly what was sent, so edits made while the request was in
         flight stay flagged as unsaved. */
      setSavedSnapshot(attempt);
      toast.success("تم حفظ المحتوى بنجاح!");
    } else {
      toast.error("حدث خطأ أثناء الحفظ.");
    }
  };

  /* Preparation and transfer both go through `uploadMediaWithProgress`, which
     reports into the upload window — the same window the trainees' attachments
     use. What stood here was a progress toast that counted from 50 to 90 on a
     300ms timer with no connection to the request: it read as a measurement and
     was not one, and it stopped at 90 however long the upload actually took.
     The compression rule itself is shared with the nutrition library, in
     `@/lib/imageUpload`. */
  const processAndUploadImage = async (imageFile: File, fieldKey?: string) => {
    setIsUploading(true);

    try {
      const url = await uploadMediaWithProgress(imageFile, { maxEdge: maxEdgeForField(fieldKey) });

      /* A refusal has already been named in the window, which stays open on a
         failure with the reason on the file it belongs to. */
      if (!url) return null;

      if (fieldKey) {
        setContentAr((prev: JsonRecord) => ({ ...prev, [fieldKey]: url }));
      }
      setMediaLibrary((prev) => [{ name: imageFile.name, url }, ...prev]);
      toast.success("تم رفع الملف بنجاح!");
      return url;
    } finally {
      setIsUploading(false);
    }
  };

  const getAspectForField = (key?: string) => {
    switch(key) {
      case "hero_bg_url": return 16 / 9;
      case "coach_img_url":
      case "contact_img_url": return 4 / 5;
      case "card1_img_url":
      case "card2_img_url":
      case "card3_img_url": return 1 / 1;
      case "login_bg_url": return 9 / 16;
      default: return undefined;
    }
  };

  /**
   * Longest edge to store for a field, in pixels.
   *
   * Sized from what each surface actually paints, doubled so it stays sharp on
   * a high-density screen, then rounded up to a round number:
   *
   *   hero_bg_url / login_bg_url  full-bleed behind the page — the one place a
   *                               wide desktop really can use the pixels.
   *   everything else             the widest of these is the membership card at
   *                               460 CSS pixels; the coach's portrait is 462.
   *
   * A field not named here is a media-library upload with no known home, so it
   * takes the shared default. */
  const maxEdgeForField = (key?: string) => {
    switch (key) {
      case "hero_bg_url":
      case "login_bg_url":
        return 1920;
      default:
        return DEFAULT_MAX_EDGE;
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldKey?: string) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const imageFile = e.target.files[0];

    // If uploading directly to media library (no fieldKey), skip crop
    if (!fieldKey) {
      await processAndUploadImage(imageFile);
      e.target.value = '';
      return;
    }

    // Otherwise, open crop modal
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setCropImageSrc(reader.result?.toString() || null);
      setCropFieldKey(fieldKey);
      setCropAspect(getAspectForField(fieldKey));
      setCropModalOpen(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    });
    reader.readAsDataURL(imageFile);
    e.target.value = '';
  };

  const onCropComplete = (_croppedArea: CropArea, croppedAreaPixels: CropArea) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleConfirmCrop = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return;
    try {
      setCropModalOpen(false);
      /* Resized here as well as during compression, and on purpose. The crop
         canvas is where the source photograph's own pixel scale enters; leaving
         it uncapped means building a 4000×4000 bitmap in memory and handing it
         to the compressor only to be thrown away — on a phone that alone is
         enough to end the tab. */
      const croppedImageFile = await getCroppedImg(
        cropImageSrc,
        croppedAreaPixels,
        0,
        { horizontal: false, vertical: false },
        maxEdgeForField(cropFieldKey)
      );
      if (croppedImageFile) {
        await processAndUploadImage(croppedImageFile, cropFieldKey);
      }
    } catch (e) {
      console.error(e);
      toast.error("حدث خطأ أثناء قص الصورة.");
    }
  };

  const handleDeleteImage = async (fieldKey: string) => {
    const urlToDelete = currentContent[fieldKey];
    if (!urlToDelete) return;

    setConfirmMessage("هل أنت متأكد من حذف هذه الصورة؟ سيتم إزالتها نهائياً من مساحة التخزين.");
    setConfirmAction(() => async () => {
      setIsUploading(true);
      const toastId = toast.loading("جاري حذف الصورة...");
      const success = await deleteImageServer(urlToDelete);
      setIsUploading(false);

      if (success) {
        if (fieldKey) {
          setContentAr((prev: JsonRecord) => ({ ...prev, [fieldKey]: PLACEHOLDER_IMAGE }));
        }
        if (activeTab === "media") {
          setMediaLibrary(mediaLibrary.filter(img => img.url !== urlToDelete));
        }
        toast.success("تم حذف الصورة بنجاح!", { id: toastId });
      } else {
        if (fieldKey) {
          setContentAr((prev: JsonRecord) => ({ ...prev, [fieldKey]: PLACEHOLDER_IMAGE }));
        }
        if (activeTab === "media") {
          setMediaLibrary(mediaLibrary.filter(img => img.url !== urlToDelete));
        }
        toast.error("تمت الإزالة من الواجهة. ملاحظة: قد تحتاج لمراجعة صلاحيات الحذف (DELETE) في Supabase.", { id: toastId, duration: 5000 });
      }
    });
    setShowConfirmModal(true);
  };

  const handleDeleteFromLibrary = async (url: string) => {
    setConfirmMessage("هل أنت متأكد من حذف هذه الصورة نهائياً؟ ستختفي من أي مكان تستخدم فيه.");
    setConfirmAction(() => async () => {
      setIsUploading(true);
      const toastId = toast.loading("جاري الحذف من المكتبة...");
      const success = await deleteImageServer(url);
      setIsUploading(false);

      if (success) {
        setMediaLibrary(mediaLibrary.filter(img => img.url !== url));

        // Clean up references in React state
        setContentAr((prev: JsonRecord) => {
          const updated = { ...prev };
          let changed = false;
          for (const key in updated) {
            if (updated[key] === url) {
              updated[key] = PLACEHOLDER_IMAGE;
              changed = true;
            }
          }
          return changed ? updated : prev;
        });

        toast.success("تم حذف الصورة من مساحة التخزين بنجاح!", { id: toastId });
      } else {
        toast.error("فشل الحذف. يرجى التأكد من صلاحيات DELETE في Supabase.", { id: toastId });
      }
    });
    setShowConfirmModal(true);
  };

  const openMediaSelector = (fieldKey: string) => {
    setActiveMediaSelectField(fieldKey);
    if (mediaLibrary.length === 0) {
      loadMedia();
    }
  };

  const handleSelectFromLibrary = async (url: string) => {
    if (activeMediaSelectField) {
      try {
        const toastId = toast.loading("جاري تجهيز الصورة...");
        const response = await fetch(url);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        toast.dismiss(toastId);

        setCropImageSrc(objectUrl);
        setCropFieldKey(activeMediaSelectField);
        setCropAspect(getAspectForField(activeMediaSelectField));
        setCropModalOpen(true);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setActiveMediaSelectField(null);
      } catch (error) {
        console.error("Error loading image from library:", error);
        toast.error("فشل في تحميل الصورة، سيتم استخدامها مباشرة دون قص");
        setContentAr((prev: JsonRecord) => ({ ...prev, [activeMediaSelectField]: url }));
        setActiveMediaSelectField(null);
      }
    }
  };

  /* Two things were wrong with the one-liner this replaces.
   *
   * `navigator.clipboard` only exists in a secure context — HTTPS or localhost.
   * Over plain HTTP it is undefined, so the call threw a TypeError and the
   * button did nothing at all. In production the site is served over HTTPS and
   * this holds; it is not something to rely on without saying so.
   *
   * And `writeText` returns a promise. The success toast fired before it
   * settled, so a copy the browser refused — permission denied, or the document
   * not focused, which Safari does — still told the coach it had worked, and
   * they pasted whatever was in the clipboard before. */
  const handleCopyUrl = async (url: string) => {
    if (!navigator.clipboard?.writeText) {
      toast.error("النسخ غير متاح في هذا المتصفح — انسخ الرابط يدوياً");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ رابط الصورة بنجاح!");
    } catch {
      toast.error("تعذّر النسخ — انسخ الرابط يدوياً");
    }
  };

  return (
    <CMSContext.Provider value={{ currentContent, setContent, isUploading, handleImageUpload, openMediaSelector, handleDeleteImage, isSaving, setPreviewImageUrl, processAndUploadImage, handleSave }}>
    <div className="cms-container">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#141414',
            color: 'var(--text)',
            border: '1px solid var(--admin-primary)',
            padding: '16px 24px',
            borderRadius: "var(--radius-lg)",
            boxShadow: '0 20px 40px rgba(0,0,0,0.7), 0 0 20px rgba(var(--primary-rgb), 0.15)',
            direction: 'rtl',
            fontSize: '0.95rem',
            fontWeight: '600'
          }
        }}
      />

      {previewImageUrl && (
        <Overlay>
          <div className="cms-viewer" onClick={() => setPreviewImageUrl(null)}>
            <img src={previewSrc(previewImageUrl, 1200)} alt="معاينة" decoding="async" />
            <button type="button" className="cms-viewer-close" aria-label="إغلاق المعاينة">
              <Icon name="close" />
            </button>
          </div>
        </Overlay>
      )}

      {cropModalOpen && cropImageSrc && (
        <Overlay>
          <div className="cms-crop-overlay">
            <div className="cms-crop-stage">
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={cropAspect}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="cms-crop-bar">
              <div className="cms-crop-hint">قم بتحريك وتكبير الصورة لاقتطاع الجزء المناسب. المربع مقيد بالأبعاد الصحيحة.</div>
              <div className="cms-crop-actions">
                <button type="button" onClick={() => setCropModalOpen(false)} className="cms-btn-secondary">
                  إلغاء
                </button>
                <button type="button" onClick={handleConfirmCrop} className="cms-btn-primary">
                  تأكيد وقص الصورة
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      <div className="cms-layout">
          {/* The page title and the tab strip pin as one block.
              The strip was already `position: sticky`, and it did stick — but it
              travelled 33px first, measured the same on every tab. That 33px was
              the title above it scrolling away while the strip chased it up to its
              own `top: 16px`. A sticky element cannot stop before it reaches its
              offset, so the only way to spend zero pixels is for the strip to be
              resting on that offset already — which means the title has to be
              inside the sticky box rather than above it.
          
              Hence `top: 0` on the wrapper: it opens exactly at the top of the
              scrollport's content, so it is pinned from the first pixel. Raising
              the strip's own `top` to the title's height would have done it too,
              and would have drifted — the title is clamp(22px, 2.6vw, 28px), so
              that number is only correct at one window width. */}
          <div className="cms-head">
            <div className="cms-header-row">
              <div>
                <h2 className="cms-header-title">
                    محتوى الموقع
                </h2>
              </div>
            </div>
          
            {/* The strip and its two arrows travel together — the wrapper is what
                the sticky offset now applies to, so the buttons stay beside the
                tabs rather than scrolling away from them. */}
            <div className="cms-tabs">
              <button
                type="button"
                className="cms-tab-nav"
                onClick={() => scrollTabs(1)}
                disabled={!tabScroll.start}
                aria-label="تمرير لليمين"
              >
                <Icon name="chevron_right" />
              </button>

            <div className="cms-sidebar" ref={tabStripRef}>
              {([
                { id: "hero", label: "الرئيسية (Hero)" },
                { id: "coach", label: "قسم المدرب" },
                { id: "membership", label: "الخطط والاشتراكات" },
                { id: "testimonials", label: "نتائج المشتركين" },
                { id: "contact", label: "معلومات التواصل" },
                { id: "login", label: "صفحة الدخول" },
                /* Two different things used to answer to "العروض": this tab, which
                   edits the promotional pop-up, and the offers *section* on the
                   landing page — thirty-eight fields with no editor at all. The
                   label now says which is which, and the section has its own. */
                { id: "offercards", label: "بطاقات العروض الخاصة" },
                { id: "offers", label: "النافذة الترويجية" },
                { id: "visibility", label: "اخفاء واظهار الاقسام" },
                { id: "media", label: "مكتبة الوسائط" }
              ] satisfies { id: string; label: string }[]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`cms-tab-btn ${activeTab === tab.id ? "active" : ""}`}
                >
                    <span>{tab.label}</span>
                </button>
              ))}
            </div>

              <button
                type="button"
                className="cms-tab-nav"
                onClick={() => scrollTabs(-1)}
                disabled={!tabScroll.end}
                aria-label="تمرير لليسار"
              >
                <Icon name="chevron_left" />
              </button>
            </div>
          </div>

          <div className="cms-content-pane">
            {activeTab === "visibility" && (
              <div className="cms-section-card">
                <h3 className="cms-card-title">
                  إدارة ظهور الأقسام
                </h3>
                <p className="cms-card-note">
                  قم بتفعيل أو إيقاف الأقسام التي تود عرضها في الصفحة الرئيسية.
                </p>
                {/* Five switches in two columns of 40px rows. As a single column
                    of 16px-padded blocks they held ~360px to say five words
                    each. The keys and their `!== "false"` reading are
                    unchanged — only the row is. */}
                <div className="cms-switch-grid">
                  {([
                    { key: "section_coach_active", label: "قسم المدرب" },
                    { key: "section_membership_active", label: "الباقات والاشتراكات" },
                    { key: "section_testimonials_active", label: "نتائج المشتركين" },
                    { key: "section_offers_active", label: "العروض الخاصة" },
                    { key: "section_contact_active", label: "معلومات التواصل" },
                  ] satisfies { key: string; label: string }[]).map(({ key, label }) => (
                    <div className="ui-switch-row" key={key}>
                      <Switch
                        checked={currentContent[key] !== "false"}
                        onChange={(checked) =>
                          setContentAr((prev: JsonRecord) => ({ ...prev, [key]: checked ? "true" : "false" }))
                        }
                        label={label}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* The offers section on the landing page.
                Mirrors the subscriptions tab field for field, because the section
                itself is a copy of the subscriptions section — same markup, same
                classes, key names prefixed `off_`. Everything it renders was
                editable nowhere until now; the values came from literals in the
                page and could only be changed by editing the source. */}
            {activeTab === "offercards" && (
              <div className="cms-section-card">
                <h3 className="cms-card-title">
                  قسم العروض الخاصة
                </h3>
                <p className="cms-card-note">
                  البطاقات الثلاث التي تظهر في قسم «العروض الخاصة» على الصفحة الرئيسية.
                  لإظهار القسم أو إخفائه بالكامل استخدم تبويب «اخفاء واظهار الاقسام».
                </p>

                <div className="ui-grid-2">
                  <InputField label="العنوان العلوي للقسم" fieldKey="off_eyebrow" hideable />
                  <InputField label="عنوان القسم" fieldKey="off_title" hideable />
                  <InputField label="نص زر البطاقات" fieldKey="off_card_btn" hideable />
                </div>

                <div className="cms-pricing-grid" style={{ marginTop: 16 }}>
                  {([
                    { n: 1, title: "العرض الأول", prices: 3, note: false },
                    { n: 2, title: "العرض الثاني", prices: 3, note: false },
                    { n: 3, title: "العرض الثالث", prices: 2, note: true },
                  ] as const).map(({ n, title, prices, note }) => {
                    const activeKey = `off_card${n}_active`;
                    const isActive = currentContent[activeKey] !== "false";
                    return (
                      <div className="cms-pricing-card" key={n}>
                        <div className="cms-pricing-head">
                          <div className="cms-pricing-header">{title}</div>
                          <Switch
                            checked={isActive}
                            onChange={(checked) =>
                              setContentAr((prev: JsonRecord) => ({ ...prev, [activeKey]: checked ? "true" : "false" }))
                            }
                            label={isActive ? "نشط" : "موقف"}
                          />
                        </div>

                        <InputField label="العنوان الفرعي للعرض" fieldKey={`off_card${n}_badge`} hideable />
                        <InputField label="وصف العرض" fieldKey={`off_card${n}_desc`} isTextarea hideable />

                        {/* Label, before, after — one price on one line. The
                            "before" figure is optional; leaving it empty simply
                            shows the price with nothing struck through. */}
                        {Array.from({ length: prices }, (_, i) => i + 1).map((p) => (
                          <div key={p} className="cms-price-row is-triple">
                            <InputField label={`تسمية السعر ${["الأول", "الثاني", "الثالث"][p - 1]}`} fieldKey={`off_card${n}_p${p}_label`} />
                            <InputField label="قبل الخصم (اختياري)" fieldKey={`off_card${n}_p${p}_was`} />
                            <InputField label="بعد الخصم" fieldKey={`off_card${n}_p${p}_val`} />
                          </div>
                        ))}

                        {note && <InputField label="ملاحظة أسفل الأسعار" fieldKey={`off_card${n}_note`} isTextarea hideable />}

                        <div className="cms-card-divider">
                          <label className="cms-label">مزايا العرض</label>
                          <div className="cms-feature-list">
                            <InputField label="الميزة الأولى" fieldKey={`off_card${n}_f1`} hideable />
                            <InputField label="الميزة الثانية" fieldKey={`off_card${n}_f2`} hideable />
                            <InputField label="الميزة الثالثة" fieldKey={`off_card${n}_f3`} hideable />
                          </div>
                        </div>

                        <InputField label="النص البديل للصورة" fieldKey={`off_card${n}_alt`} />
                        <ImageUploadField label={`صورة ${title}`} fieldKey={`off_card${n}_img_url`} recommendedSize="600x600 (مربعة)" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "offers" && (
              <div className="cms-section-card">
                {/* The pop-up's own switch.
                    It had none: the "العروض الخاصة" box in the visibility tab
                    turned the offers *section* on, and this window came with it —
                    so a coach who wanted the section without a modal covering the
                    page on arrival had no way to say so, despite this whole tab
                    existing to write its text.
                    Still subordinate to that switch on the page: the window's
                    button points at #offers, and sending a visitor to a hidden
                    section is worse than not showing the window at all. */}
                <div className="cms-card-head">
                  <h3 className="cms-card-title">
                    العروض الخاصة (النافذة المنبثقة)
                  </h3>
                  <div className="ui-switch-row">
                    <Switch
                      checked={currentContent.promo_popup_active !== "false"}
                      onChange={(checked) => setContentAr((prev: JsonRecord) => ({ ...prev, promo_popup_active: checked ? "true" : "false" }))}
                      label={currentContent.promo_popup_active !== "false" ? "النافذة فعّالة" : "النافذة موقفة"}
                    />
                  </div>
                </div>
                <p className="cms-card-note">
                  {currentContent.section_offers_active === "false"
                    ? "قسم العروض موقف حالياً من تبويب (اخفاء واظهار الاقسام)، ولن تظهر النافذة قبل تفعيله."
                    : "تظهر النافذة للزائر بعد ثوانٍ من فتح الصفحة الرئيسية. أوقفها من هنا إن أردت عرض قسم العروض دون نافذة تعترض الزائر."}
                </p>
                <div className="cms-section-split">
                  <div className="cms-split-main">
                    <InputField label="عنوان العرض" fieldKey="promo_title" />
                    <InputField label="وصف العرض" fieldKey="promo_desc" isTextarea />
                    <InputField label="نص الزر" fieldKey="promo_cta" />
                  </div>
                  <div className="cms-split-side">
                    <ImageUploadField label="صورة العرض" fieldKey="promo_img_url" recommendedSize="600x800 (عمودية)" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "hero" && (
              <div className="cms-section-card">
                <h3 className="cms-card-title">
                    القسم الرئيسي (Hero Section)
                </h3>
                <div className="cms-section-split">
                  <div className="cms-split-main">
                    <InputField label="العنوان الرئيسي" fieldKey="hero_title" hideable />
                    <InputField label="العنوان الفرعي" fieldKey="hero_sub" isTextarea hideable />
                    <InputField label="اقتباس أو نص قصير" fieldKey="hero_quote" hideable />
                    <InputField label="نص الزر" fieldKey="hero_btn" hideable />
                  </div>
                  <div className="cms-split-side">
                    <ImageUploadField label="صورة خلفية القسم" fieldKey="hero_bg_url" recommendedSize="1920x1080 (أفقية)" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "coach" && (
              <div className="cms-section-card">
                <h3 className="cms-card-title">
                  قسم المدرب (Coach Section)
                </h3>
                <div className="cms-section-split">
                  <div className="cms-split-main">
                    <InputField label="عنوان القسم" fieldKey="coach_title" hideable />
                    <InputField label="اسم المدرب" fieldKey="coach_name" hideable />
                    <InputField label="الشهادة الرئيسية" fieldKey="coach_cert" hideable />
                    <InputField label="النبذة الأولى" fieldKey="coach_bio1" isTextarea hideable />
                    <InputField label="النبذة الثانية" fieldKey="coach_bio2" isTextarea hideable />
                  </div>
                  <div className="cms-split-side">
                    <ImageUploadField label="صورة المدرب" fieldKey="coach_img_url" recommendedSize="800x1000 (عمودية)" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "membership" && (
              <div className="cms-section-card">
                {/* The three switches below write `cardN_active`, which is what
                    `handleCardActivation` in LandingClient reads. They used to
                    write `off_cardN_active` — the offers section's key — while
                    sitting in this tab, beside this tab's `cardN_badge` and
                    `cardN_desc` fields. So the switch saved, and the plan it was
                    labelled for was never affected: the landing page was reading
                    `cardN_active`, which nothing on this screen ever set. */}
                <h3 className="cms-card-title">
                  إدارة خطط العضوية والاشتراكات
                </h3>
                <InputField label="عنوان قسم الخطط الرئيسي" fieldKey="mem_title" hideable />

                <div className="cms-pricing-grid" style={{ marginTop: 16 }}>
                  {/* Three cards that differed only in their title, their key
                      prefix and how many prices they carry. They were written
                      out three times, which is how card 2 and card 3 ended up
                      with the same 12px gap where card 1 had 8px. Same keys,
                      same `!== "false"` reading, same fields — one shape. */}
                  {([
                    { n: 1, title: "الخطة الأولى (بدون متابعة)", label: "الأولى", prices: 3 },
                    { n: 2, title: "الخطة الثانية (خطة المتابعة الأسبوعية)", label: "الثانية", prices: 2 },
                    { n: 3, title: "الخطة الثالثة (خطة المتابعة اليومية)", label: "الثالثة", prices: 2 },
                  ] as const).map(({ n, title, label, prices }) => {
                    const activeKey = `card${n}_active`;
                    const isActive = currentContent[activeKey] !== "false";
                    return (
                      <div className="cms-pricing-card" key={n}>
                        <div className="cms-pricing-head">
                          <div className="cms-pricing-header">{title}</div>
                          <Switch
                            checked={isActive}
                            onChange={(checked) =>
                              setContentAr((prev: JsonRecord) => ({ ...prev, [activeKey]: checked ? "true" : "false" }))
                            }
                            label={isActive ? "نشطة" : "موقفة"}
                          />
                        </div>

                        <InputField label="العنوان الفرعي للخطة" fieldKey={`card${n}_badge`} hideable />
                        <InputField label="وصف الخطة" fieldKey={`card${n}_desc`} isTextarea hideable />

                        {Array.from({ length: prices }, (_, i) => i + 1).map((p) => (
                          <div key={p} className="cms-price-row">
                            <InputField label={`تسمية السعر ${["الأول", "الثاني", "الثالث"][p - 1]}`} fieldKey={`card${n}_p${p}_label`} />
                            <InputField label={`قيمة السعر ${["الأول", "الثاني", "الثالث"][p - 1]}`} fieldKey={`card${n}_p${p}_val`} />
                          </div>
                        ))}

                        <div className="cms-card-divider">
                          <label className="cms-label">ميزات الخطة</label>
                          <div className="cms-feature-list">
                            <InputField label="الميزة الأولى" fieldKey={`card${n}_f1`} hideable />
                            <InputField label="الميزة الثانية" fieldKey={`card${n}_f2`} hideable />
                            <InputField label="الميزة الثالثة" fieldKey={`card${n}_f3`} hideable />
                          </div>
                        </div>

                        <ImageUploadField label={`صورة الخطة ${label}`} fieldKey={`card${n}_img_url`} recommendedSize="600x600 (مربعة)" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "testimonials" && <TestimonialsEditor />}

            {activeTab === "login" && (
              <div className="cms-section-card">
                <h3 className="cms-card-title">
                  إعدادات صفحة تسجيل الدخول
                </h3>
                <div className="cms-section-split">
                  <div className="cms-split-main">
                    <InputField label="العنوان الترحيبي الرئيسي" fieldKey="login_title" />
                    <InputField label="النص الفرعي للترحيب" fieldKey="login_subtitle" isTextarea />
                  </div>
                  <div className="cms-split-side">
                    <ImageUploadField label="صورة الخلفية (القسم الأيسر)" fieldKey="login_bg_url" recommendedSize="1080x1920 (عمودية)" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "contact" && (
              <div className="cms-section-card">
                <h3 className="cms-card-title">
                  معلومات التواصل والدعم
                </h3>
                <div className="cms-section-split">
                  <div className="cms-split-main">
                    <InputField label="عنوان قسم التواصل (العنوان الصغير)" fieldKey="contact_eyebrow" hideable />
                    <InputField label="العنوان الرئيسي للتواصل" fieldKey="contact_title" hideable />

                    {/* 260px floor: the phone field's own segments, icon,
                        separators and padding need ~265px, so the previous
                        180px minimum clipped its last group. */}
                    <div className="ui-grid-2" style={{ marginTop: 4 }}>
                      <PhoneInputField label="رقم الهاتف" fieldKey="contact_phone" />
                      <InputField label="البريد الإلكتروني" fieldKey="contact_email" forceDir="ltr" />
                      <InputField label="رابط/حساب الإنستغرام" fieldKey="contact_ig" forceDir="ltr" />
                    </div>
                  </div>
                  <div className="cms-split-side">
                    <ImageUploadField label="صورة قسم التواصل" fieldKey="contact_img_url" recommendedSize="800x1000 (عمودية)" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "media" && (
              <div className="cms-section-card">
                {/* The text block had no shrink constraint, so it consumed the
                    row and pushed the upload button outside the card. */}
                <div className="cms-media-head">
                  <div className="cms-media-head-text">
                    <h3 className="cms-card-title">
                      مكتبة الوسائط
                    </h3>
                    <p className="cms-media-info">
                      تظهر هنا جميع الصور التي قمت برفعها مسبقاً إلى مساحة التخزين الخاصة بك. يمكنك تصفح الصور، نسخ روابطها المباشرة لاستخدامها، أو حذف غير المستخدم منها لتحرير المساحة.
                    </p>
                  </div>
                  <div className="cms-upload-wrap">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e)}
                      disabled={isUploading}
                      className="ui-media-file"
                      title="رفع صورة جديدة"
                      aria-label="رفع صورة جديدة إلى المكتبة"
                    />
                    {/* Was `crm-badge primary` — a class with no definition
                        anywhere, so this rendered as a default grey button that
                        spilled outside the card. */}
                    <button className="cms-btn-primary" style={{ whiteSpace: "nowrap", pointerEvents: "none" }}>
                      <span>{isUploading ? "جاري الرفع..." : "رفع صورة"}</span>
                    </button>
                  </div>
                </div>

                {isLoadingMedia ? (
                  <div className="cms-loading-media">
                    <div className="cms-spinner"></div>
                    <p>جاري تحميل مكتبة الصور...</p>
                  </div>
                ) : mediaLibrary.length === 0 ? (
                  <p className="cms-empty">لا توجد صور مرفوعة حالياً في المكتبة.</p>
                ) : (
                  <div className="cms-media-grid">
                    {mediaLibrary.map((img, idx) => (
                      <div key={idx} className="cms-media-card">
                        <img src={previewSrc(img.url, 264)} alt={img.name} className="cms-media-img" loading="lazy" decoding="async" onClick={() => setPreviewImageUrl(img.url)} style={{ cursor: "zoom-in" }} />
                        <div className="cms-media-overlay">
                          <span className="cms-media-name" title={img.name}>{img.name}</span>
                          <div className="cms-media-actions">
                            <button onClick={() => setPreviewImageUrl(img.url)} className="cms-media-btn copy" title="عرض الصورة">
                              <Icon name="visibility" style={{ fontSize: 20 }} />
                            </button>
                            <button onClick={() => handleCopyUrl(img.url)} className="cms-media-btn copy" title="نسخ الرابط">
                              <Icon name="content_copy" style={{ fontSize: 20 }} />
                            </button>
                            <button onClick={() => handleDeleteFromLibrary(img.url)} disabled={isUploading} className="cms-media-btn delete" title="حذف الصورة">
                              <Icon name="delete" style={{ fontSize: 20 }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* The listing is capped. Saying so is the difference between a
                    library that ends and a library that looks like it lost the
                    older half. */}
                {!isLoadingMedia && mediaHasMore && (
                  <p className="cms-list-end">
                    تُعرض أحدث {mediaLibrary.length} صورة فقط. المكتبة تحتوي على المزيد — احذف ما لم يعد مستخدماً لتظهر الصور الأقدم.
                  </p>
                )}
              </div>
            )}

          {/* Lifts and follows only while there is something to save. At rest the
              bar says "كل التغييرات محفوظة" with its save button disabled, and held
              89px of a screen that already gives 72px to the nav bar and 58px to
              the tabs — a fifth of a 1080px screen, near a third of a 768px one.
              Sticky and static occupy the same box in flow, so this toggles
              nothing about the layout; it only decides whether the bar detaches
              when the page scrolls past it. */}
          <div className={`cms-footer ${isDirty ? "is-pinned" : ""}`}>
            {isDirty ? (
              <span className="cms-dirty">تغييرات غير محفوظة</span>
            ) : (
              <span className="cms-saved">
                كل التغييرات محفوظة
              </span>
            )}

            {activeTab !== "media" && (
              <button
                onClick={handleOpenPreview}
                disabled={isSaving || isUploading}
                className="cms-btn-secondary"
              >
                معاينة قبل النشر
              </button>
            )}


            <button
              onClick={handleSave}
              /* Nothing to publish when the content matches what is stored. */
              disabled={isSaving || isUploading || !isDirty}
              className="cms-btn-primary"
            >
              {isSaving ? (
                <>
                  <div className="cms-spinner" style={{ width: 16, height: 16, border: "2px solid var(--text-inverse)", borderTopColor: "transparent" }}></div>
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <span>حفظ التغييرات ونشرها</span>
                </>
              )}
            </button>
          </div>
          </div>
        </div>

      {showConfirmModal && (
        <Overlay>
          <div className="cms-modal-overlay">
            <div className="cms-modal-card">
              <div className="cms-modal-icon-wrapper">
                <div className="cms-modal-icon">
                </div>
              </div>
              <h3 className="cms-modal-title">تأكيد الحذف نهائياً</h3>
              <p className="cms-modal-desc">{confirmMessage}</p>
              <div className="cms-modal-actions">
                <button
                  onClick={() => {
                    if (confirmAction) confirmAction();
                    setShowConfirmModal(false);
                  }}
                  className="cms-modal-btn-confirm"
                >
                  نعم، احذف
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="cms-modal-btn-cancel"
                >
                  تراجع
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {activeMediaSelectField && (
        <Overlay>
          <div className="cms-modal-overlay">
            <div className="cms-modal-card is-wide">
              <div className="cms-selector-head">
                <h3 className="cms-selector-title">اختر صورة من مكتبة الوسائط</h3>
                <button
                  type="button"
                  onClick={() => setActiveMediaSelectField(null)}
                  className="cms-selector-close"
                  aria-label="إغلاق"
                >
                  <Icon name="close" />
                </button>
              </div>

              {isLoadingMedia ? (
                <div className="cms-loading-media">
                  <div className="cms-spinner"></div>
                  <p>جاري تحميل مكتبة الصور...</p>
                </div>
              ) : mediaLibrary.length === 0 ? (
                <p className="cms-empty">
                  لا توجد صور مرفوعة حالياً. ارفع صورة من تبويب «مكتبة الوسائط» أولاً.
                </p>
              ) : (
                <div className="cms-selector-scroll">
                  <div className="cms-selector-grid">
                    {mediaLibrary.map((img, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => handleSelectFromLibrary(img.url)}
                        className="cms-selector-img-card"
                        title={img.name}
                      >
                        <img src={previewSrc(img.url, 192)} alt={img.name} loading="lazy" decoding="async" />
                        <span className="cms-selector-hover-overlay">
                          <Icon name="check_circle" style={{ fontSize: 26 }} />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="cms-selector-foot">
                <button
                  type="button"
                  onClick={() => setActiveMediaSelectField(null)}
                  className="cms-modal-btn-cancel"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      )}
    </div>
    </CMSContext.Provider>
  );
}


