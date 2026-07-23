"use client";

import React, { useState, useEffect } from "react";
import { saveLandingContent, listImagesServer, deleteImageServer } from "./actions";
import { uploadImage } from "@/lib/supabase";
import imageCompression from 'browser-image-compression';
import { Toaster, toast } from 'react-hot-toast';
import "./cms.css";

const FIELD_ICONS: Record<string, string> = {
  hero_title: "title",
  hero_sub: "subtitles",
  hero_quote: "format_quote",
  hero_btn: "smart_button",
  coach_title: "label",
  coach_name: "badge",
  coach_cert: "workspace_premium",
  coach_bio1: "description",
  coach_bio2: "description",
  mem_title: "title",
  card1_badge: "badge",
  card1_desc: "description",
  card1_p1_label: "label",
  card1_p1_val: "payments",
  card1_p2_label: "label",
  card1_p2_val: "payments",
  card1_p3_label: "label",
  card1_p3_val: "payments",
  card1_f1: "done",
  card1_f2: "done",
  card1_f3: "done",
  card2_badge: "badge",
  card2_desc: "description",
  card2_p1_label: "label",
  card2_p1_val: "payments",
  card2_p2_label: "label",
  card2_p2_val: "payments",
  card2_f1: "done",
  card2_f2: "done",
  card2_f3: "done",
  card3_badge: "badge",
  card3_desc: "description",
  card3_p1_label: "label",
  card3_p1_val: "payments",
  card3_p2_label: "label",
  card3_p2_val: "payments",
  card3_f1: "done",
  card3_f2: "done",
  card3_f3: "done",
  contact_eyebrow: "label",
  contact_title: "title",
  contact_phone: "phone",
  contact_email: "mail",
  contact_ig: "alternate_email",
  login_title: "title",
  login_subtitle: "subtitles",
};

export default function AdminCMSClient({ initialEn, initialAr }: { initialEn: any; initialAr: any }) {
  const [contentEn, setContentEn] = useState(initialEn);
  const [contentAr, setContentAr] = useState(initialAr);
  const [activeLang, setActiveLang] = useState<"ar" | "en">("ar");
  const [activeTab, setActiveTab] = useState("hero");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaLibrary, setMediaLibrary] = useState<{name: string, url: string}[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const previewWindowRef = React.useRef<Window | null>(null);

  // Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [activeMediaSelectField, setActiveMediaSelectField] = useState<string | null>(null);

  const handleOpenPreview = () => {
    const url = "/?preview=true";
    const payload = activeLang === "ar" ? contentAr : contentEn;
    localStorage.setItem("cms_preview_data", JSON.stringify({
      lang: activeLang,
      payload
    }));

    if (previewWindowRef.current && !previewWindowRef.current.closed) {
      previewWindowRef.current.focus();
    } else {
      previewWindowRef.current = window.open(url, "_blank");
    }
  };

  useEffect(() => {
    if (activeTab === "media") {
      loadMedia();
    }
  }, [activeTab]);

  useEffect(() => {
    // Broadcast live preview to localStorage
    const payload = activeLang === "ar" ? contentAr : contentEn;
    localStorage.setItem("cms_preview_data", JSON.stringify({
      lang: activeLang,
      payload
    }));

    // Broadcast live preview to preview tab/window if active
    if (previewWindowRef.current && !previewWindowRef.current.closed) {
      previewWindowRef.current.postMessage({
        type: "CMS_PREVIEW",
        lang: activeLang,
        payload
      }, "*");
    }
  }, [contentAr, contentEn, activeLang]);

  const loadMedia = async () => {
    setIsLoadingMedia(true);
    const images = await listImagesServer();
    setMediaLibrary(images);
    setIsLoadingMedia(false);
  };

  const currentContent = activeLang === "ar" ? contentAr : contentEn;
  const setContent = (key: string, value: string) => {
    if (activeLang === "ar") {
      setContentAr({ ...contentAr, [key]: value });
    } else {
      setContentEn({ ...contentEn, [key]: value });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const result = await saveLandingContent(contentEn, contentAr);
    setIsSaving(false);
    if (result.success) {
      toast.success("تم حفظ المحتوى بنجاح!");
    } else {
      toast.error("حدث خطأ أثناء الحفظ.");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldKey: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    
    try {
      const imageFile = e.target.files[0];
      
      const options = {
        maxSizeMB: 2, 
        useWebWorker: true,
        alwaysKeepResolution: true, 
        initialQuality: 0.95 
      };
      
      const toastId = toast.loading("جاري رفع الصورة...");
      
      const compressedFile = await imageCompression(imageFile, options);
      const url = await uploadImage(compressedFile as File);
      
      if (url) {
        setContentAr((prev: any) => ({ ...prev, [fieldKey]: url }));
        setContentEn((prev: any) => ({ ...prev, [fieldKey]: url }));
        toast.success("تم ضغط ورفع الصورة بنجاح!", { id: toastId });
      } else {
        toast.error("فشل رفع الصورة.", { id: toastId });
      }
    } catch (error) {
      console.error("Error compressing image:", error);
      toast.error("حدث خطأ أثناء معالجة الصورة.");
    } finally {
      setIsUploading(false);
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
          setContentAr((prev: any) => ({ ...prev, [fieldKey]: "/photos/loading.jpg" }));
          setContentEn((prev: any) => ({ ...prev, [fieldKey]: "/photos/loading.jpg" }));
        }
        if (activeTab === "media") {
          setMediaLibrary(mediaLibrary.filter(img => img.url !== urlToDelete));
        }
        toast.success("تم حذف الصورة بنجاح!", { id: toastId });
      } else {
        if (fieldKey) {
          setContentAr((prev: any) => ({ ...prev, [fieldKey]: "/photos/loading.jpg" }));
          setContentEn((prev: any) => ({ ...prev, [fieldKey]: "/photos/loading.jpg" }));
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
        setContentAr((prev: any) => {
          const updated = { ...prev };
          let changed = false;
          for (const key in updated) {
            if (updated[key] === url) {
              updated[key] = "/photos/loading.jpg";
              changed = true;
            }
          }
          return changed ? updated : prev;
        });

        setContentEn((prev: any) => {
          const updated = { ...prev };
          let changed = false;
          for (const key in updated) {
            if (updated[key] === url) {
              updated[key] = "/photos/loading.jpg";
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

  const DEFAULT_TEXTS: Record<string, { ar: string, en: string }> = {
    hero_title: { en: "Train Hard\\nTrain Smart", ar: "تدرب بقوة\\nتدرب بذكاء" },
    hero_sub: { en: "Elite fitness programs built for serious achievers", ar: "برامج لياقة بدنية نخبوية مصممة للمنجزين الجادين" },
    hero_quote: { en: "My diet rule is to never let it last for more than 3 months", ar: "قاعدتي في الدايت: لا تدعه يستمر لأكثر من 3 أشهر" },
    hero_btn: { en: "Join Now", ar: "اشترك الآن" },
    login_title: { en: "Welcome Back", ar: "مرحباً بك مجدداً" },
    login_subtitle: { en: "Please enter your details to sign in.", ar: "الرجاء إدخال بياناتك لتسجيل الدخول." },
    coach_title: { en: "MEET THE COACH", ar: "تعرف على المدرب" },
    coach_name: { en: "Ibrahim Abutabikh", ar: "إبراهيم أبو طبيخ" },
    coach_cert: { en: "Certified Elite Personal Trainer & Nutritionist", ar: "مدرب شخصي وخبير تغذية معتمد" },
    coach_bio1: { en: "With over 10 years of experience in transforming bodies...", ar: "بخبرة تزيد عن 10 سنوات في تحويل الأجسام..." },
    coach_bio2: { en: "I don't just give you a plan; I give you a new lifestyle.", ar: "أنا لا أعطيك خطة فقط؛ أنا أعطيك أسلوب حياة جديد." },
    mem_title: { en: "MEMBERSHIP", ar: "الباقات والاشتراكات" },
    card1_badge: { en: "Self-Guided Plans", ar: "خطط التوجيه الذاتي" },
    card1_desc: { en: "Good for people who are committed and just need the right workout and diet guide.", ar: "مناسبة للأشخاص الملتزمين الذين يحتاجون فقط إلى التوجيه الصحيح في التدريب والنظام الغذائي." },
    card1_p1_label: { en: "Workout + Diet Plan Offer", ar: "عرض جدول تدريب + نظام غذائي" },
    card1_p1_val: { en: "25,000 IQD", ar: "25,000 دينار" },
    card1_p2_label: { en: "Workout Plan Only", ar: "جدول تدريب فقط" },
    card1_p2_val: { en: "15,000 IQD", ar: "15,000 دينار" },
    card1_p3_label: { en: "Diet Plan Only", ar: "نظام غذائي فقط" },
    card1_p3_val: { en: "15,000 IQD", ar: "15,000 دينار" },
    card1_f1: { en: "Good workout guide", ar: "جدول تدريب ممتاز" },
    card1_f2: { en: "Good diet guide", ar: "نظام غذائي ممتاز" },
    card1_f3: { en: "Do it yourself", ar: "اعتمد على نفسك" },
    card2_badge: { en: "Monthly Plan (Weekly Check-ins)", ar: "خطة شهرية (متابعة أسبوعية)" },
    card2_desc: { en: "Good for people who struggle to stay committed and need a structured plan, special rules, and weekly checks to reach their goals.", ar: "مناسبة للأشخاص الذين يجدون صعوبة في الالتزام ويحتاجون إلى خطة منظمة ومتابعة أسبوعية للوصول إلى أهدافهم." },
    card2_p1_label: { en: "First Month", ar: "الشهر الأول" },
    card2_p1_val: { en: "50,000 IQD", ar: "50,000 دينار" },
    card2_p2_label: { en: "Second Month (Renewal)", ar: "الشهر الثاني (تجديد)" },
    card2_p2_val: { en: "30,000 IQD", ar: "30,000 دينار" },
    card2_f1: { en: "Special diet rules", ar: "قواعد غذائية خاصة" },
    card2_f2: { en: "Weekly check-ins", ar: "متابعة أسبوعية" },
    card2_f3: { en: "Organize your lifestyle", ar: "تنظيم أسلوب حياتك" },
    card3_badge: { en: "Monthly Plan (Daily Check-ins)", ar: "خطة شهرية (متابعة يومية)" },
    card3_desc: { en: "This is the surest way to reach your goal. Daily check-ins will help you stick to the plan. Good for people who tried everything but couldn't stay committed.", ar: "هذه هي الطريقة الأكثر ضماناً للوصول إلى هدفك. المتابعة اليومية ستساعدك على الالتزام. مثالية للأشخاص الذين جربوا كل شيء ولم يستطيعوا الالتزام." },
    card3_p1_label: { en: "Full 3-Month Diet Plan", ar: "خطة نظام غذائي كاملة لمدة ٣ أشهر" },
    card3_p1_val: { en: "300,000 IQD", ar: "300,000 دينار" },
    card3_p2_label: { en: "Monthly Payment (1 Month)", ar: "دفع شهري (شهر واحد)" },
    card3_p2_val: { en: "120,000 IQD", ar: "120,000 دينار" },
    card3_f1: { en: "Daily check-ins", ar: "متابعة يومية" },
    card3_f2: { en: "Guaranteed commitment", ar: "التزام مضمون" },
    card3_f3: { en: "Sure way to reach your goal", ar: "أضمن طريق للوصول لهدفك" },
    contact_eyebrow: { en: "Get In Touch", ar: "ابق على تواصل" },
    contact_title: { en: "CONTACT INFO", ar: "معلومات التواصل" },
    contact_phone: { en: "+964 770 000 0000", ar: "+964 770 000 0000" },
    contact_email: { en: "info@ibrahiemgym.com", ar: "info@ibrahiemgym.com" },
    contact_ig: { en: "@ibrahiem_gym", ar: "@ibrahiem_gym" },
  };

  const openMediaSelector = (fieldKey: string) => {
    setActiveMediaSelectField(fieldKey);
    if (mediaLibrary.length === 0) {
      loadMedia();
    }
  };

  const handleSelectFromLibrary = (url: string) => {
    if (activeMediaSelectField) {
      setContentAr((prev: any) => ({ ...prev, [activeMediaSelectField]: url }));
      setContentEn((prev: any) => ({ ...prev, [activeMediaSelectField]: url }));
      toast.success("تم اختيار الصورة من المكتبة بنجاح!");
      setActiveMediaSelectField(null);
    }
  };

  const InputField = ({ label, fieldKey, isTextarea = false }: { label: string, fieldKey: string, isTextarea?: boolean }) => {
    const defaultText = DEFAULT_TEXTS[fieldKey]?.[activeLang] || "";
    const icon = FIELD_ICONS[fieldKey] || "edit";
    
    return (
      <div className="cms-form-group">
        <label className="cms-label">{label}</label>
        {isTextarea ? (
          <textarea 
            value={currentContent[fieldKey] || ""}
            onChange={(e) => setContent(fieldKey, e.target.value)}
            placeholder={defaultText}
            rows={4}
            dir={activeLang === "ar" ? "rtl" : "ltr"}
            className="cms-textarea"
          />
        ) : (
          <div className="cms-input-wrapper">
            <span className="material-symbols-outlined">{icon}</span>
            <input 
              type="text" 
              value={currentContent[fieldKey] || ""}
              onChange={(e) => setContent(fieldKey, e.target.value)}
              placeholder={defaultText}
              dir={activeLang === "ar" ? "rtl" : "ltr"}
              className="cms-input"
            />
          </div>
        )}
      </div>
    );
  };

  const ImageUploadField = ({ label, fieldKey }: { label: string, fieldKey: string }) => {
    const imageUrl = currentContent[fieldKey];
    const hasImage = imageUrl && imageUrl !== "/photos/loading.jpg";

    return (
      <div style={{ marginTop: 24, marginBottom: 16 }}>
        <label className="cms-label" style={{ marginBottom: 12 }}>{label}</label>
        
        {/* Upload Zone */}
        <div className="cms-upload-zone">
          <div className="cms-upload-content">
            <span className="material-symbols-outlined cms-upload-icon">cloud_upload</span>
            <span className="cms-upload-text">اسحب الصورة هنا أو انقر لاختيار ملف</span>
            <span className="cms-upload-hint">PNG, JPG, WEBP أو GIF (الحد الأقصى 2 ميجابايت)</span>
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
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>photo_library</span>
          اختيار من مكتبة الوسائط
        </button>

        {/* Preview block if image exists */}
        {hasImage && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 8 }}>
            <div className="cms-image-preview-card">
              <img src={imageUrl} alt={label} className="cms-preview-img" />
              <div className="cms-preview-overlay">
                <button 
                  onClick={() => handleDeleteImage(fieldKey)} 
                  disabled={isUploading || isSaving}
                  className="cms-preview-btn-delete"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  حذف الصورة
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("تم نسخ رابط الصورة بنجاح!");
  };

  return (
    <div className="cms-container">
      <Toaster 
        position="top-center" 
        toastOptions={{ 
          style: { 
            background: '#141414', 
            color: '#F0EDE8', 
            border: '1px solid var(--admin-primary, var(--primary))', 
            padding: '16px 24px', 
            borderRadius: '12px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.7), 0 0 20px rgba(var(--primary-rgb), 0.15)',
            direction: 'rtl',
            fontSize: '0.95rem',
            fontWeight: '600'
          } 
        }} 
      />

      <div className="cms-header-row">
        <div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0 0 8px 0", color: "var(--text)" }}>محتوى الموقع</h2>
          <p style={{ color: "var(--admin-outline)", margin: 0, fontSize: "0.95rem" }}>قم بتعديل نصوص وصور الصفحة الرئيسية (العربية والإنجليزية).</p>
        </div>
        <div className="cms-lang-toggle">
          <button 
            onClick={() => setActiveLang("ar")} 
            className={`cms-lang-btn ${activeLang === "ar" ? "active" : ""}`}
          >
            عربي
          </button>
          <button 
            onClick={() => setActiveLang("en")} 
            className={`cms-lang-btn ${activeLang === "en" ? "active" : ""}`}
          >
            English
          </button>
        </div>
      </div>

      <div className="cms-layout">
          <div className="cms-sidebar">
            {[
              { id: "hero", label: "الرئيسية (Hero)", icon: "home" },
              { id: "coach", label: "قسم المدرب", icon: "person" },
              { id: "membership", label: "الباقات والاشتراكات", icon: "card_membership" },
              { id: "contact", label: "معلومات التواصل", icon: "contact_support" },
              { id: "login", label: "صفحة الدخول", icon: "login" },
              { id: "media", label: "مكتبة الوسائط", icon: "photo_library" }
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id)} 
                className={`cms-tab-btn ${activeTab === tab.id ? "active" : ""}`}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          
          <div className="cms-content-pane">
            {activeTab === "hero" && (
              <div className="cms-section-card">
                <h3 className="cms-card-title">
                  <span className="material-symbols-outlined">home</span>
                  القسم الرئيسي (Hero Section)
                </h3>
                <div className="cms-section-split">
                  <div className="cms-split-main">
                    <InputField label="العنوان الرئيسي (Hero Title)" fieldKey="hero_title" />
                    <InputField label="العنوان الفرعي (Hero Subtitle)" fieldKey="hero_sub" isTextarea />
                    <InputField label="اقتباس أو نص قصير (Hero Quote)" fieldKey="hero_quote" />
                    <InputField label="نص الزر (Hero Button)" fieldKey="hero_btn" />
                  </div>
                  <div className="cms-split-side">
                    <ImageUploadField label="صورة خلفية القسم (Hero Background)" fieldKey="hero_bg_url" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "coach" && (
              <div className="cms-section-card">
                <h3 className="cms-card-title">
                  <span className="material-symbols-outlined">person</span>
                  قسم المدرب (Coach Section)
                </h3>
                <div className="cms-section-split">
                  <div className="cms-split-main">
                    <InputField label="عنوان القسم (Coach Section Title)" fieldKey="coach_title" />
                    <InputField label="اسم المدرب" fieldKey="coach_name" />
                    <InputField label="الشهادة الرئيسية (Certificate)" fieldKey="coach_cert" />
                    <InputField label="النبذة الأولى (Bio 1)" fieldKey="coach_bio1" isTextarea />
                    <InputField label="النبذة الثانية (Bio 2)" fieldKey="coach_bio2" isTextarea />
                  </div>
                  <div className="cms-split-side">
                    <ImageUploadField label="صورة المدرب (Coach Image)" fieldKey="coach_img_url" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "membership" && (
              <div className="cms-section-card">
                <h3 className="cms-card-title">
                  <span className="material-symbols-outlined">card_membership</span>
                  إدارة باقات العضوية والاشتراكات
                </h3>
                <InputField label="عنوان قسم الباقات الرئيسي" fieldKey="mem_title" />
                
                <div className="cms-pricing-grid" style={{ marginTop: 24 }}>
                  {/* Card 1 */}
                  <div className="cms-pricing-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", borderBottom: "1px dashed var(--border)", paddingBottom: 10, marginBottom: 16 }}>
                      <div className="cms-pricing-header" style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>
                        <span className="material-symbols-outlined">looks_one</span>
                        الباقة الأولى (بدون متابعة)
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
                        <input 
                          type="checkbox" 
                          checked={currentContent.card1_active !== "false"}
                          onChange={(e) => {
                            const val = e.target.checked ? "true" : "false";
                            setContentAr((prev: any) => ({ ...prev, card1_active: val }));
                            setContentEn((prev: any) => ({ ...prev, card1_active: val }));
                          }}
                          style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                        />
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: (currentContent.card1_active !== "false") ? "var(--primary)" : "var(--muted)" }}>
                          {(currentContent.card1_active !== "false") ? "نشطة" : "إيقاف مؤقت"}
                        </span>
                      </label>
                    </div>
                    <InputField label="العنوان الفرعي للباقة" fieldKey="card1_badge" />
                    <InputField label="وصف الباقة" fieldKey="card1_desc" isTextarea />
                    
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
                      <label className="cms-label">ميزات الباقة:</label>
                      <InputField label="الميزة الأولى" fieldKey="card1_f1" />
                      <InputField label="الميزة الثانية" fieldKey="card1_f2" />
                      <InputField label="الميزة الثالثة" fieldKey="card1_f3" />
                    </div>
                    
                    <ImageUploadField label="صورة الباقة الأولى" fieldKey="card1_img_url" />
                  </div>
                  
                  {/* Card 2 */}
                  <div className="cms-pricing-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", borderBottom: "1px dashed var(--border)", paddingBottom: 10, marginBottom: 16 }}>
                      <div className="cms-pricing-header" style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>
                        <span className="material-symbols-outlined">looks_two</span>
                        الباقة الثانية (متابعة أسبوعية)
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
                        <input 
                          type="checkbox" 
                          checked={currentContent.card2_active !== "false"}
                          onChange={(e) => {
                            const val = e.target.checked ? "true" : "false";
                            setContentAr((prev: any) => ({ ...prev, card2_active: val }));
                            setContentEn((prev: any) => ({ ...prev, card2_active: val }));
                          }}
                          style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                        />
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: (currentContent.card2_active !== "false") ? "var(--primary)" : "var(--muted)" }}>
                          {(currentContent.card2_active !== "false") ? "نشطة" : "إيقاف مؤقت"}
                        </span>
                      </label>
                    </div>
                    <InputField label="العنوان الفرعي للباقة" fieldKey="card2_badge" />
                    <InputField label="وصف الباقة" fieldKey="card2_desc" isTextarea />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <InputField label="تسمية السعر الأول" fieldKey="card2_p1_label" />
                      <InputField label="قيمة السعر الأول" fieldKey="card2_p1_val" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <InputField label="تسمية السعر الثاني" fieldKey="card2_p2_label" />
                      <InputField label="قيمة السعر الثاني" fieldKey="card2_p2_val" />
                    </div>

                    <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 12, marginTop: 12, marginBottom: 16 }}>
                      <label className="cms-label">ميزات الباقة:</label>
                      <InputField label="الميزة الأولى" fieldKey="card2_f1" />
                      <InputField label="الميزة الثانية" fieldKey="card2_f2" />
                      <InputField label="الميزة الثالثة" fieldKey="card2_f3" />
                    </div>
                    
                    <ImageUploadField label="صورة الباقة الثانية" fieldKey="card2_img_url" />
                  </div>
                  
                  {/* Card 3 */}
                  <div className="cms-pricing-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", borderBottom: "1px dashed var(--border)", paddingBottom: 10, marginBottom: 16 }}>
                      <div className="cms-pricing-header" style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>
                        <span className="material-symbols-outlined">looks_3</span>
                        الباقة الثالثة (متابعة يومية)
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
                        <input 
                          type="checkbox" 
                          checked={currentContent.card3_active !== "false"}
                          onChange={(e) => {
                            const val = e.target.checked ? "true" : "false";
                            setContentAr((prev: any) => ({ ...prev, card3_active: val }));
                            setContentEn((prev: any) => ({ ...prev, card3_active: val }));
                          }}
                          style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                        />
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: (currentContent.card3_active !== "false") ? "var(--primary)" : "var(--muted)" }}>
                          {(currentContent.card3_active !== "false") ? "نشطة" : "إيقاف مؤقت"}
                        </span>
                      </label>
                    </div>
                    <InputField label="العنوان الفرعي للباقة" fieldKey="card3_badge" />
                    <InputField label="وصف الباقة" fieldKey="card3_desc" isTextarea />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <InputField label="تسمية السعر الأول" fieldKey="card3_p1_label" />
                      <InputField label="قيمة السعر الأول" fieldKey="card3_p1_val" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <InputField label="تسمية السعر الثاني" fieldKey="card3_p2_label" />
                      <InputField label="قيمة السعر الثاني" fieldKey="card3_p2_val" />
                    </div>

                    <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 12, marginTop: 12, marginBottom: 16 }}>
                      <label className="cms-label">ميزات الباقة:</label>
                      <InputField label="الميزة الأولى" fieldKey="card3_f1" />
                      <InputField label="الميزة الثانية" fieldKey="card3_f2" />
                      <InputField label="الميزة الثالثة" fieldKey="card3_f3" />
                    </div>
                    
                    <ImageUploadField label="صورة الباقة الثالثة" fieldKey="card3_img_url" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "login" && (
              <div className="cms-section-card">
                <h3 className="cms-card-title">
                  <span className="material-symbols-outlined">login</span>
                  إعدادات صفحة تسجيل الدخول (Login Page)
                </h3>
                <div className="cms-section-split">
                  <div className="cms-split-main">
                    <InputField label="العنوان الترحيبي الرئيسي" fieldKey="login_title" />
                    <InputField label="النص الفرعي للترحيب" fieldKey="login_subtitle" isTextarea />
                  </div>
                  <div className="cms-split-side">
                    <ImageUploadField label="صورة الخلفية (القسم الأيسر)" fieldKey="login_bg_url" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "contact" && (
              <div className="cms-section-card">
                <h3 className="cms-card-title">
                  <span className="material-symbols-outlined">contact_support</span>
                  معلومات التواصل والدعم
                </h3>
                <div className="cms-section-split">
                  <div className="cms-split-main">
                    <InputField label="عنوان قسم التواصل (العنوان الصغير)" fieldKey="contact_eyebrow" />
                    <InputField label="العنوان الرئيسي للتواصل" fieldKey="contact_title" />
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
                      <InputField label="رقم الهاتف" fieldKey="contact_phone" />
                      <InputField label="البريد الإلكتروني" fieldKey="contact_email" />
                      <InputField label="رابط/حساب الإنستغرام" fieldKey="contact_ig" />
                    </div>
                  </div>
                  <div className="cms-split-side">
                    <ImageUploadField label="صورة قسم التواصل (Contact Image)" fieldKey="contact_img_url" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "media" && (
              <div className="cms-section-card">
                <h3 className="cms-card-title">
                  <span className="material-symbols-outlined">photo_library</span>
                  مكتبة الوسائط المرفوعة
                </h3>
                <p className="cms-media-info">
                  تظهر هنا جميع الصور التي قمت برفعها مسبقاً إلى مساحة التخزين الخاصة بك. يمكنك تصفح الصور، نسخ روابطها المباشرة لاستخدامها، أو حذف غير المستخدم منها لتحرير المساحة.
                </p>
                
                {isLoadingMedia ? (
                  <div className="cms-loading-media">
                    <div className="cms-spinner"></div>
                    <p>جاري تحميل مكتبة الصور...</p>
                  </div>
                ) : mediaLibrary.length === 0 ? (
                  <p style={{ padding: 48, textAlign: "center", background: "var(--bg3)", borderRadius: 12, color: "var(--muted)" }}>لا توجد صور مرفوعة حالياً في المكتبة.</p>
                ) : (
                  <div className="cms-media-grid">
                    {mediaLibrary.map((img, idx) => (
                      <div key={idx} className="cms-media-card">
                        <img src={img.url} alt={img.name} className="cms-media-img" />
                        <div className="cms-media-overlay">
                          <span className="cms-media-name" title={img.name}>{img.name}</span>
                          <div className="cms-media-actions">
                            <button onClick={() => handleCopyUrl(img.url)} className="cms-media-btn copy">
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
                              نسخ
                            </button>
                            <button onClick={() => handleDeleteFromLibrary(img.url)} disabled={isUploading} className="cms-media-btn delete">
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                              حذف
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="cms-footer">
          <button 
            onClick={handleOpenPreview} 
            disabled={isSaving || isUploading} 
            className="cms-btn-secondary"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>open_in_new</span>
            معاينة قبل النشر
          </button>
          
          <button 
            onClick={handleSave} 
            disabled={isSaving || isUploading} 
            className="cms-btn-primary"
          >
            {isSaving ? (
              <>
                <div className="cms-spinner" style={{ width: 16, height: 16, border: "2px solid #080808", borderTopColor: "transparent" }}></div>
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>save</span>
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
                <span className="material-symbols-outlined">delete_forever</span>
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
                <span className="material-symbols-outlined">close</span>
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
                        borderRadius: 8, 
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
                        <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: 28 }}>check_circle</span>
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
  );
}
