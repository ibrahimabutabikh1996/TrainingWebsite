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

const InputField = ({ label, fieldKey, isTextarea = false, forceDir }: { label: string, fieldKey: string, isTextarea?: boolean, forceDir?: "rtl" | "ltr" }) => {
  const { currentContent, setContent } = React.useContext(CMSContext);
  const defaultText = DEFAULT_TEXTS[fieldKey] || "";

  return (
    <div className="cms-form-group">
      <label className="cms-label">{label}</label>
      {isTextarea ? (
        <textarea
          value={currentContent[fieldKey] || ""}
          onChange={(e) => setContent(fieldKey, e.target.value)}
          placeholder={defaultText}
          rows={4}
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
      <div 
        style={{ 
          display: "flex", 
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          background: "var(--bg3)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-md)",
          direction: "ltr",
          /* Without this the fixed-width segments push the row past the card. */
          minWidth: 0,
          overflow: "hidden",
          transition: "all 0.25s ease"
        }} 
      >
        <input 
          type="text" 
          value={code}
          onChange={(e) => update(e.target.value, p1, p2, p3)}
          style={{ width: "55px", textAlign: "center", border: "none", background: "transparent", color: "var(--text)", outline: "none", fontSize: "0.95rem", padding: 0 }}
          placeholder="+964"
        />
        <div style={{ width: "1px", height: "20px", background: "var(--border)" }}></div>
        <input 
          type="text" 
          value={p1}
          onChange={(e) => update(code, e.target.value.replace(/\D/g, ''), p2, p3)}
          style={{ width: "40px", textAlign: "center", border: "none", background: "transparent", color: "var(--text)", outline: "none", fontSize: "0.95rem", padding: 0 }}
          maxLength={3}
          placeholder="787"
        />
        <div style={{ width: "1px", height: "20px", background: "var(--border)" }}></div>
        <input 
          type="text" 
          value={p2}
          onChange={(e) => update(code, p1, e.target.value.replace(/\D/g, ''), p3)}
          style={{ width: "45px", textAlign: "center", border: "none", background: "transparent", color: "var(--text)", outline: "none", fontSize: "0.95rem", borderLeft: "1px solid var(--border)" }}
          maxLength={3}
          placeholder="751"
        />
        <input 
          type="text" 
          value={p3}
          onChange={(e) => update(code, p1, p2, e.target.value.replace(/\D/g, ''))}
          style={{ flex: 1, minWidth: 0, width: 0, border: "none", background: "transparent", color: "var(--text)", outline: "none", fontSize: "0.95rem", padding: "0 8px", borderLeft: "1px solid var(--border)" }}
          maxLength={4}
          placeholder="1605"
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
    <div style={{ marginTop: 24, marginBottom: 16 }}>
      <label className="cms-label" style={{ marginBottom: 12 }}>{label}</label>
      
      {/* Upload Zone */}
      <div className="cms-upload-zone" style={{ position: "relative", overflow: "hidden" }}>
        <div className="cms-upload-content">
          <span className="cms-upload-text">{isUploading ? "جاري معالجة ورفع الصورة..." : "اسحب الصورة هنا أو انقر لاختيار ملف"}</span>
          {!isUploading && (
            <>
              <span className="cms-upload-hint">PNG, JPG, WEBP أو GIF (الحد الأقصى 2 ميجابايت)</span>
              {recommendedSize && <span className="cms-upload-hint" style={{ color: "var(--primary)", marginTop: 2, fontWeight: 600 }}>الأبعاد الموصى بها: {recommendedSize}</span>}
            </>
          )}
        </div>
        <input 
          type="file" 
          accept="image/*" 
          onChange={(e) => handleImageUpload(e, fieldKey)} 
          disabled={isUploading} 
          className="cms-file-input" 
        />
      </div>

      <button
        type="button"
        onClick={() => openMediaSelector(fieldKey)}
        className="cms-btn-secondary"
        style={{ width: "100%", justifyContent: "center", gap: 8, padding: "10px", fontSize: "0.875rem", marginBottom: 16 }}
      >
        اختيار من مكتبة الوسائط
      </button>

      {/* Preview block if image exists */}
      {hasImage && (
        <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 8 }}>
          <div className="cms-image-preview-card">
            <img src={imageUrl} alt={label} className="cms-preview-img" onClick={() => setPreviewImageUrl(imageUrl)} style={{ cursor: "zoom-in" }} />
            <div className="cms-preview-overlay" style={{ display: 'flex', gap: '8px' }}>
              {/* "View" is not a destructive action — it was borrowing the
                  delete button's class and overriding the fill inline, which
                  left dark text on a translucent white wash (1.7:1). */}
              <button
                onClick={() => setPreviewImageUrl(imageUrl)}
                className="cms-preview-btn-view"
                title="عرض الصورة"
              >
                عرض
              </button>
              <button 
                onClick={() => handleDeleteImage(fieldKey)} 
                disabled={isUploading || isSaving}
                className="cms-preview-btn-delete"
                title="حذف الصورة"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h3 className="cms-card-title" style={{ margin: 0, marginBottom: 4 }}>أراء المشتركين</h3>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>إدارة التقييمات وقصص النجاح التي تظهر في الصفحة الرئيسية.</p>
        </div>
        <button type="button" onClick={addTestimonial} className="cms-btn-primary" style={{ padding: "8px 16px", fontSize: "0.9rem" }}>
          + إضافة رأي جديد
        </button>
      </div>

      {testimonials.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: 12 }}>
          لا توجد آراء مضافة حالياً. سيتم عرض الأمثلة الافتراضية في الموقع.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {testimonials.map((t, idx) => {
            const isExpanded = expandedIndex === idx;
            
            return (
              <div key={idx} style={{ border: isExpanded ? "1px solid var(--primary)" : "1px solid var(--border)", borderRadius: 12, background: isExpanded ? "var(--bg2)" : "var(--bg3)", overflow: "hidden", transition: "all 0.2s ease", boxShadow: isExpanded ? "var(--elev-2)" : "none" }}>
                
                {/* Accordion Header */}
                <div 
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", borderBottom: isExpanded ? "1px solid var(--border)" : "none" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: isExpanded ? "var(--primary)" : "var(--primary-dim)", color: isExpanded ? "var(--text-inverse)" : "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", transition: "all 0.2s" }}>
                      {idx + 1}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--text)", fontSize: "1.05rem" }}>{t.author_name || "رأي جديد (بدون اسم)"}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <span>النوع: {t.type === 'text' ? 'نص فقط' : t.type === 'image' ? 'صورة' : t.type === 'video' ? 'فيديو' : 'صوت'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }} onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={() => moveTestimonial(idx, -1)} disabled={idx === 0} style={{ background: "transparent", border: "1px solid var(--border-strong)", color: idx === 0 ? "var(--muted)" : "var(--text)", width: 32, height: 32, borderRadius: 6, cursor: idx === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="تحريك لأعلى">↑</button>
                    <button type="button" onClick={() => moveTestimonial(idx, 1)} disabled={idx === testimonials.length - 1} style={{ background: "transparent", border: "1px solid var(--border-strong)", color: idx === testimonials.length - 1 ? "var(--muted)" : "var(--text)", width: 32, height: 32, borderRadius: 6, cursor: idx === testimonials.length - 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="تحريك لأسفل">↓</button>
                    <button type="button" onClick={() => removeTestimonial(idx)} style={{ background: "rgba(var(--error-rgb), 0.1)", border: "1px solid rgba(var(--error-rgb), 0.2)", color: "var(--error-text)", padding: "0 12px", height: 32, borderRadius: 6, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, marginRight: 8 }}>حذف</button>
                    <Icon name={isExpanded ? "expand_less" : "expand_more"} style={{ color: "var(--muted)", marginLeft: 8 }} />
                  </div>
                </div>

                {/* Accordion Body */}
                {isExpanded && (
                  <div style={{ padding: "24px 20px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
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

                    <div className="cms-form-group" style={{ marginBottom: 16 }}>
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
                      <div className="cms-form-group" style={{ marginBottom: 16, background: "var(--bg)", padding: 16, borderRadius: 8, border: "1px dashed var(--border)" }}>
                        <label className="cms-label">الوسائط (صورة، فيديو، أو مقطع صوتي)</label>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                          <input type="text" value={t.media_url || ""} onChange={(e) => updateTestimonial(idx, "media_url", e.target.value)} className="cms-input" style={{ flex: 1, minWidth: 200 }} placeholder="رابط الملف المباشر..." dir="ltr" />
                          <div style={{ position: "relative", overflow: "hidden", display: "inline-block", flexShrink: 0 }}>
                            <input 
                              type="file" 
                              accept={t.type === "image" ? "image/*" : t.type === "video" ? "video/*" : "audio/*"} 
                              onChange={(e) => handleMediaUpload(e, idx)} 
                              style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%" }} 
                            />
                            <button type="button" className="cms-btn-secondary" style={{ pointerEvents: "none", height: "42px", padding: "0 20px" }}>
                              <Icon name="upload" style={{ marginLeft: 8 }} />
                              رفع ملف
                            </button>
                          </div>
                        </div>
                        {t.media_url && (
                          <div style={{ marginTop: 16, padding: 12, background: "var(--bg3)", borderRadius: 8, border: "1px solid var(--border)" }}>
                            {t.type === "image" && <img src={t.media_url} alt={t.author_name ? `صورة رأي ${t.author_name}` : "معاينة الصورة المرفقة"} style={{ maxHeight: 200, maxWidth: "100%", borderRadius: 6, display: "block", objectFit: "contain", margin: "0 auto" }} />}
                            {t.type === "video" && <video src={t.media_url} controls style={{ maxHeight: 240, width: "100%", borderRadius: 6 }} />}
                            {t.type === "audio" && <audio src={t.media_url} controls style={{ width: "100%", height: 44 }} />}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="cms-form-group">
                      <label className="cms-label">نص الرأي</label>
                      <textarea 
                        value={t.text || ""} 
                        onChange={(e) => updateTestimonial(idx, "text", e.target.value)} 
                        className="cms-textarea"
                        rows={4}
                        placeholder="اكتب قصة نجاح أو رأي المشترك هنا..."
                        style={{ resize: "vertical" }}
                      />
                    </div>

                    <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                      <button type="button" onClick={handleSave} disabled={isSaving} className="cms-btn-primary" style={{ padding: "10px 24px", borderRadius: 8, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 8 }}>
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
   * The sign-in screen is still previewed on the real `/login`, because that
   * page has no separate preview route — its own copy comes from the same
   * draft. */
  const handleOpenPreview = () => {
    let url = "/cms-preview";
    if (activeTab === "login") {
      url = "/login?preview=true";
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
            border: '1px solid var(--admin-primary, var(--primary))', 
            padding: '16px 24px', 
            borderRadius: "var(--radius-lg)",
            boxShadow: '0 20px 40px rgba(0,0,0,0.7), 0 0 20px rgba(var(--primary-rgb), 0.15)',
            direction: 'rtl',
            fontSize: '0.95rem',
            fontWeight: '600'
          } 
        }} 
      />

      <div className="cms-header-row">
        <div>
          <h2 className="cms-header-title">
              محتوى الموقع
          </h2>
        </div>
      </div>

      {previewImageUrl && (
        <div 
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", cursor: "zoom-out" }}
          onClick={() => setPreviewImageUrl(null)}
        >
          <img src={previewImageUrl} style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: "var(--radius-sm)", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }} alt="معاينة" />
          <button style={{ position: "absolute", top: 24, right: 24, background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }}>
            <Icon name="close" />
          </button>
        </div>
      )}

      {cropModalOpen && cropImageSrc && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.9)", display: "flex", flexDirection: "column" }}>
          <div style={{ position: "relative", flex: 1 }}>
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
          <div style={{ padding: "24px", background: "var(--bg2)", display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: "var(--muted2)", fontSize: "0.9rem", flex: "1 1 250px", lineHeight: "1.5" }}>قم بتحريك وتكبير الصورة لاقتطاع الجزء المناسب. المربع مقيد بالأبعاد الصحيحة.</div>
            <div style={{ display: "flex", gap: "12px", flexShrink: 0, flexWrap: "wrap" }}>
              <button onClick={() => setCropModalOpen(false)} className="cms-btn-secondary" style={{ padding: "8px 24px" }}>
                إلغاء
              </button>
              <button onClick={handleConfirmCrop} className="cms-btn-primary" style={{ padding: "8px 24px" }}>
                تأكيد وقص الصورة
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="cms-layout">
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
              { id: "testimonials", label: "آراء المشتركين" },
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
          
          <div className="cms-content-pane">
            {activeTab === "visibility" && (
              <div className="cms-section-card">
                <h3 className="cms-card-title">
                  إدارة ظهور الأقسام
                </h3>
                <p style={{ color: "var(--text-secondary)", marginBottom: "24px", fontSize: "0.95rem" }}>
                  قم بتفعيل أو إيقاف الأقسام التي تود عرضها في الصفحة الرئيسية.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none", padding: "16px", background: "var(--bg3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)" }}>
                    <input
                      type="checkbox"
                      checked={currentContent.section_coach_active !== "false"}
                      onChange={(e) => setContentAr((prev: JsonRecord) => ({ ...prev, section_coach_active: e.target.checked ? "true" : "false" }))}
                      style={{ width: 20, height: 20, accentColor: "var(--primary)" }}
                    />
                    <span style={{ fontSize: "1rem", fontWeight: "var(--weight-semibold)", color: "var(--text)" }}>قسم المدرب</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none", padding: "16px", background: "var(--bg3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)" }}>
                    <input
                      type="checkbox"
                      checked={currentContent.section_membership_active !== "false"}
                      onChange={(e) => setContentAr((prev: JsonRecord) => ({ ...prev, section_membership_active: e.target.checked ? "true" : "false" }))}
                      style={{ width: 20, height: 20, accentColor: "var(--primary)" }}
                    />
                    <span style={{ fontSize: "1rem", fontWeight: "var(--weight-semibold)", color: "var(--text)" }}>الباقات والاشتراكات</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none", padding: "16px", background: "var(--bg3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)" }}>
                    <input
                      type="checkbox"
                      checked={currentContent.section_testimonials_active !== "false"}
                      onChange={(e) => setContentAr((prev: JsonRecord) => ({ ...prev, section_testimonials_active: e.target.checked ? "true" : "false" }))}
                      style={{ width: 20, height: 20, accentColor: "var(--primary)" }}
                    />
                    <span style={{ fontSize: "1rem", fontWeight: "var(--weight-semibold)", color: "var(--text)" }}>آراء المشتركين</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none", padding: "16px", background: "var(--bg3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)" }}>
                    <input
                      type="checkbox"
                      checked={currentContent.section_offers_active !== "false"}
                      onChange={(e) => setContentAr((prev: JsonRecord) => ({ ...prev, section_offers_active: e.target.checked ? "true" : "false" }))}
                      style={{ width: 20, height: 20, accentColor: "var(--primary)" }}
                    />
                    <span style={{ fontSize: "1rem", fontWeight: "var(--weight-semibold)", color: "var(--text)" }}>العروض الخاصة</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none", padding: "16px", background: "var(--bg3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)" }}>
                    <input
                      type="checkbox"
                      checked={currentContent.section_contact_active !== "false"}
                      onChange={(e) => setContentAr((prev: JsonRecord) => ({ ...prev, section_contact_active: e.target.checked ? "true" : "false" }))}
                      style={{ width: 20, height: 20, accentColor: "var(--primary)" }}
                    />
                    <span style={{ fontSize: "1rem", fontWeight: "var(--weight-semibold)", color: "var(--text)" }}>معلومات التواصل</span>
                  </label>
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
                <p style={{ color: "var(--text-secondary)", marginBottom: 20, fontSize: "0.95rem" }}>
                  البطاقات الثلاث التي تظهر في قسم «العروض الخاصة» على الصفحة الرئيسية.
                  لإظهار القسم أو إخفائه بالكامل استخدم تبويب «اخفاء واظهار الاقسام».
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
                  <InputField label="العنوان العلوي للقسم" fieldKey="off_eyebrow" />
                  <InputField label="عنوان القسم" fieldKey="off_title" />
                </div>
                <InputField label="نص زر البطاقات" fieldKey="off_card_btn" />

                <div className="cms-pricing-grid" style={{ marginTop: 24 }}>
                  {([
                    { n: 1, title: "العرض الأول", prices: 3, note: false },
                    { n: 2, title: "العرض الثاني", prices: 3, note: false },
                    { n: 3, title: "العرض الثالث", prices: 2, note: true },
                  ] as const).map(({ n, title, prices, note }) => {
                    const activeKey = `off_card${n}_active`;
                    const isActive = currentContent[activeKey] !== "false";
                    return (
                      <div className="cms-pricing-card" key={n}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", borderBottom: "1px dashed var(--border)", paddingBottom: 10, marginBottom: 16 }}>
                          <div className="cms-pricing-header" style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>
                            {title}
                          </div>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
                            <input
                              type="checkbox"
                              checked={isActive}
                              onChange={(e) => {
                                const val = e.target.checked ? "true" : "false";
                                setContentAr((prev: JsonRecord) => ({ ...prev, [activeKey]: val }));
                              }}
                              style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                            />
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: isActive ? "var(--primary)" : "var(--muted)" }}>
                              {isActive ? "نشط" : "إيقاف مؤقت"}
                            </span>
                          </label>
                        </div>

                        <InputField label="العنوان الفرعي للعرض" fieldKey={`off_card${n}_badge`} />
                        <InputField label="وصف العرض" fieldKey={`off_card${n}_desc`} isTextarea />

                        {Array.from({ length: prices }, (_, i) => i + 1).map((p) => (
                          <div key={p} style={{ marginBottom: p === prices ? 12 : 8 }}>
                            <InputField label={`تسمية السعر ${["الأول", "الثاني", "الثالث"][p - 1]}`} fieldKey={`off_card${n}_p${p}_label`} />
                            {/* Before and after, side by side, in the order they
                                appear on the card. The "before" figure is
                                optional — leaving it empty simply shows the
                                price with nothing struck through. */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <InputField label="السعر قبل الخصم (اختياري)" fieldKey={`off_card${n}_p${p}_was`} />
                              <InputField label="السعر بعد الخصم" fieldKey={`off_card${n}_p${p}_val`} />
                            </div>
                          </div>
                        ))}

                        {note && <InputField label="ملاحظة أسفل الأسعار" fieldKey={`off_card${n}_note`} isTextarea />}

                        <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 12, marginTop: 12, marginBottom: 16 }}>
                          <label className="cms-label">مزايا العرض:</label>
                          <InputField label="الميزة الأولى" fieldKey={`off_card${n}_f1`} />
                          <InputField label="الميزة الثانية" fieldKey={`off_card${n}_f2`} />
                          <InputField label="الميزة الثالثة" fieldKey={`off_card${n}_f3`} />
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 20 }}>
                  <h3 className="cms-card-title" style={{ margin: 0, border: "none", padding: 0 }}>
                    العروض الخاصة (النافذة المنبثقة)
                  </h3>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none", padding: "8px 14px", background: "var(--bg3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)" }}>
                    <input
                      type="checkbox"
                      checked={currentContent.promo_popup_active !== "false"}
                      onChange={(e) => setContentAr((prev: JsonRecord) => ({ ...prev, promo_popup_active: e.target.checked ? "true" : "false" }))}
                      style={{ width: 18, height: 18, accentColor: "var(--primary)" }}
                    />
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: currentContent.promo_popup_active !== "false" ? "var(--primary)" : "var(--muted)" }}>
                      {currentContent.promo_popup_active !== "false" ? "النافذة فعّالة" : "النافذة موقفة"}
                    </span>
                  </label>
                </div>
                <p style={{ color: "var(--text-secondary)", marginBottom: "24px", fontSize: "0.95rem" }}>
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
                    <InputField label="العنوان الرئيسي" fieldKey="hero_title" />
                    <InputField label="العنوان الفرعي" fieldKey="hero_sub" isTextarea />
                    <InputField label="اقتباس أو نص قصير" fieldKey="hero_quote" />
                    <InputField label="نص الزر" fieldKey="hero_btn" />
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
                    <InputField label="عنوان القسم" fieldKey="coach_title" />
                    <InputField label="اسم المدرب" fieldKey="coach_name" />
                    <InputField label="الشهادة الرئيسية" fieldKey="coach_cert" />
                    <InputField label="النبذة الأولى" fieldKey="coach_bio1" isTextarea />
                    <InputField label="النبذة الثانية" fieldKey="coach_bio2" isTextarea />
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
                <InputField label="عنوان قسم الخطط الرئيسي" fieldKey="mem_title" />
                
                <div className="cms-pricing-grid" style={{ marginTop: 24 }}>
                  {/* Card 1 */}
                  <div className="cms-pricing-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", borderBottom: "1px dashed var(--border)", paddingBottom: 10, marginBottom: 16 }}>
                      <div className="cms-pricing-header" style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>
                        الخطة الأولى (بدون متابعة)
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
                        <input 
                          type="checkbox" 
                          checked={currentContent.card1_active !== "false"}
                          onChange={(e) => {
                            const val = e.target.checked ? "true" : "false";
                            setContentAr((prev: JsonRecord) => ({ ...prev, card1_active: val }));
                          }}
                          style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                        />
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: (currentContent.card1_active !== "false") ? "var(--primary)" : "var(--muted)" }}>
                          {(currentContent.card1_active !== "false") ? "نشطة" : "إيقاف مؤقت"}
                        </span>
                      </label>
                    </div>
                    <InputField label="العنوان الفرعي للخطة" fieldKey="card1_badge" />
                    <InputField label="وصف الخطة" fieldKey="card1_desc" isTextarea />
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <InputField label="تسمية السعر الأول" fieldKey="card1_p1_label" />
                      <InputField label="قيمة السعر الأول" fieldKey="card1_p1_val" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <InputField label="تسمية السعر الثاني" fieldKey="card1_p2_label" />
                      <InputField label="قيمة السعر الثاني" fieldKey="card1_p2_val" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <InputField label="تسمية السعر الثالث" fieldKey="card1_p3_label" />
                      <InputField label="قيمة السعر الثالث" fieldKey="card1_p3_val" />
                    </div>

                    <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 12, marginTop: 12, marginBottom: 16 }}>
                      <label className="cms-label">ميزات الخطة:</label>
                      <InputField label="الميزة الأولى" fieldKey="card1_f1" />
                      <InputField label="الميزة الثانية" fieldKey="card1_f2" />
                      <InputField label="الميزة الثالثة" fieldKey="card1_f3" />
                    </div>
                    
                    <ImageUploadField label="صورة الخطة الأولى" fieldKey="card1_img_url" recommendedSize="600x600 (مربعة)" />
                  </div>
                  
                  {/* Card 2 */}
                  <div className="cms-pricing-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", borderBottom: "1px dashed var(--border)", paddingBottom: 10, marginBottom: 16 }}>
                      <div className="cms-pricing-header" style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>
                        الخطة الثانية (خطة المتابعة الأسبوعية)
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
                        <input 
                          type="checkbox" 
                          checked={currentContent.card2_active !== "false"}
                          onChange={(e) => {
                            const val = e.target.checked ? "true" : "false";
                            setContentAr((prev: JsonRecord) => ({ ...prev, card2_active: val }));
                          }}
                          style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                        />
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: (currentContent.card2_active !== "false") ? "var(--primary)" : "var(--muted)" }}>
                          {(currentContent.card2_active !== "false") ? "نشطة" : "إيقاف مؤقت"}
                        </span>
                      </label>
                    </div>
                    <InputField label="العنوان الفرعي للخطة" fieldKey="card2_badge" />
                    <InputField label="وصف الخطة" fieldKey="card2_desc" isTextarea />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <InputField label="تسمية السعر الأول" fieldKey="card2_p1_label" />
                      <InputField label="قيمة السعر الأول" fieldKey="card2_p1_val" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <InputField label="تسمية السعر الثاني" fieldKey="card2_p2_label" />
                      <InputField label="قيمة السعر الثاني" fieldKey="card2_p2_val" />
                    </div>

                    <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 12, marginTop: 12, marginBottom: 16 }}>
                      <label className="cms-label">ميزات الخطة:</label>
                      <InputField label="الميزة الأولى" fieldKey="card2_f1" />
                      <InputField label="الميزة الثانية" fieldKey="card2_f2" />
                      <InputField label="الميزة الثالثة" fieldKey="card2_f3" />
                    </div>
                    
                    <ImageUploadField label="صورة الخطة الثانية" fieldKey="card2_img_url" recommendedSize="600x600 (مربعة)" />
                  </div>
                  
                  {/* Card 3 */}
                  <div className="cms-pricing-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", borderBottom: "1px dashed var(--border)", paddingBottom: 10, marginBottom: 16 }}>
                      <div className="cms-pricing-header" style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>
                        الخطة الثالثة (خطة المتابعة اليومية)
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
                        <input 
                          type="checkbox" 
                          checked={currentContent.card3_active !== "false"}
                          onChange={(e) => {
                            const val = e.target.checked ? "true" : "false";
                            setContentAr((prev: JsonRecord) => ({ ...prev, card3_active: val }));
                          }}
                          style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                        />
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: (currentContent.card3_active !== "false") ? "var(--primary)" : "var(--muted)" }}>
                          {(currentContent.card3_active !== "false") ? "نشطة" : "إيقاف مؤقت"}
                        </span>
                      </label>
                    </div>
                    <InputField label="العنوان الفرعي للخطة" fieldKey="card3_badge" />
                    <InputField label="وصف الخطة" fieldKey="card3_desc" isTextarea />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <InputField label="تسمية السعر الأول" fieldKey="card3_p1_label" />
                      <InputField label="قيمة السعر الأول" fieldKey="card3_p1_val" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <InputField label="تسمية السعر الثاني" fieldKey="card3_p2_label" />
                      <InputField label="قيمة السعر الثاني" fieldKey="card3_p2_val" />
                    </div>

                    <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 12, marginTop: 12, marginBottom: 16 }}>
                      <label className="cms-label">ميزات الخطة:</label>
                      <InputField label="الميزة الأولى" fieldKey="card3_f1" />
                      <InputField label="الميزة الثانية" fieldKey="card3_f2" />
                      <InputField label="الميزة الثالثة" fieldKey="card3_f3" />
                    </div>
                    
                    <ImageUploadField label="صورة الخطة الثالثة" fieldKey="card3_img_url" recommendedSize="600x600 (مربعة)" />
                  </div>
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
                    <InputField label="عنوان قسم التواصل (العنوان الصغير)" fieldKey="contact_eyebrow" />
                    <InputField label="العنوان الرئيسي للتواصل" fieldKey="contact_title" />
                    
                    {/* 260px floor: the phone field's own segments, icon,
                        separators and padding need ~265px, so the previous
                        180px minimum clipped its last group. */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 16 }}>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <h3 className="cms-card-title">
                      مكتبة الوسائط
                    </h3>
                    <p className="cms-media-info">
                      تظهر هنا جميع الصور التي قمت برفعها مسبقاً إلى مساحة التخزين الخاصة بك. يمكنك تصفح الصور، نسخ روابطها المباشرة لاستخدامها، أو حذف غير المستخدم منها لتحرير المساحة.
                    </p>
                  </div>
                  <div style={{ position: "relative", overflow: "hidden", display: "inline-block", flexShrink: 0 }}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleImageUpload(e)} 
                      disabled={isUploading} 
                      style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                      title="رفع صورة جديدة"
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
                  <p style={{ padding: 48, textAlign: "center", background: "var(--bg3)", borderRadius: "var(--radius-lg)", color: "var(--muted)" }}>لا توجد صور مرفوعة حالياً في المكتبة.</p>
                ) : (
                  <div className="cms-media-grid">
                    {mediaLibrary.map((img, idx) => (
                      <div key={idx} className="cms-media-card">
                        <img src={img.url} alt={img.name} className="cms-media-img" onClick={() => setPreviewImageUrl(img.url)} style={{ cursor: "zoom-in" }} />
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
                  <p style={{ marginTop: "var(--space-4)", padding: "var(--space-3) var(--space-4)", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "var(--text-sm)", textAlign: "center" }}>
                    تُعرض أحدث {mediaLibrary.length} صورة فقط. المكتبة تحتوي على المزيد — احذف ما لم يعد مستخدماً لتظهر الصور الأقدم.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

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

      {showConfirmModal && (
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
      )}

      {activeMediaSelectField && (
        <div className="cms-modal-overlay">
          <div className="cms-modal-card" style={{ maxWidth: 600, width: "95%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--text)" }}>اختر صورة من مكتبة الوسائط</h3>
              <button 
                onClick={() => setActiveMediaSelectField(null)}
                style={{ background: "transparent", border: "none", color: "var(--muted2)", cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                <Icon name="close" />
              </button>
            </div>

            {isLoadingMedia ? (
              <div className="cms-loading-media" style={{ padding: "60px 0" }}>
                <div className="cms-spinner"></div>
                <p>جاري تحميل مكتبة الصور...</p>
              </div>
            ) : mediaLibrary.length === 0 ? (
              <div style={{ padding: "60px 0", color: "var(--muted)" }}>
                <p>لا توجد صور مرفوعة حالياً.</p>
                <p style={{ fontSize: "0.85rem", marginTop: 8 }}>يمكنك رفع صور جديدة أولاً من خلال سحب وإفلات الملفات.</p>
              </div>
            ) : (
              <div style={{ maxHeight: "400px", overflowY: "auto", paddingLeft: 6 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 12 }}>
                  {mediaLibrary.map((img, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => handleSelectFromLibrary(img.url)}
                      style={{ 
                        position: "relative", 
                        border: "1px solid var(--border)", 
                        borderRadius: "var(--radius-sm)", 
                        overflow: "hidden", 
                        aspectRatio: "1/1", 
                        background: "var(--bg3)",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                      className="cms-selector-img-card"
                    >
                      <img src={img.url} alt={img.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div className="cms-selector-hover-overlay" style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(var(--primary-rgb), 0.15)",
                        opacity: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "opacity 0.2s"
                      }}>
                        <Icon name="check_circle" style={{ color: "var(--primary)", fontSize: 28 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
              <button 
                onClick={() => setActiveMediaSelectField(null)} 
                className="cms-modal-btn-cancel"
                style={{ flex: "none", padding: "10px 24px" }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </CMSContext.Provider>
  );
}


