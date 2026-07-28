"use client";

import { hasRealImage, PLACEHOLDER_IMAGE } from "@/lib/placeholderImage";
import type { JsonRecord } from "@/types";
import React, { useState, useEffect } from "react";
import { saveLandingContent, listImagesServer, deleteImageServer, uploadImageServer } from "./actions";
import imageCompression from 'browser-image-compression';
import { Toaster, toast } from 'react-hot-toast';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/lib/cropUtils';
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

const DEFAULT_TEXTS: Record<string, { ar: string, en: string }> = {
  hero_title: { en: "Train Hard\\nTrain Smart", ar: "تدرب بقوة\\nتدرب بذكاء" },
  hero_sub: { en: "Elite fitness programs built for serious achievers", ar: "برامج لياقة بدنية نخبوية مصممة للمنجزين الجادين" },
  hero_quote: { en: "My diet rule is to never let it last for more than 3 months", ar: "قاعدتي في الدايت: لا تدعه يستمر لأكثر من 3 أشهر" },
  hero_btn: { en: "Sign In", ar: "تسجيل الدخول" },
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

interface CropArea { x: number; y: number; width: number; height: number }

const CMSContext = React.createContext<JsonRecord>({});

const InputField = ({ label, fieldKey, isTextarea = false, forceDir }: { label: string, fieldKey: string, isTextarea?: boolean, forceDir?: "rtl" | "ltr" }) => {
  const { currentContent, setContent, activeLang } = React.useContext(CMSContext);
  const defaultText = DEFAULT_TEXTS[fieldKey]?.[activeLang as "ar" | "en"] || "";
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
          dir={forceDir ? forceDir : (activeLang === "ar" ? "rtl" : "ltr")}
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
            dir={forceDir ? forceDir : (activeLang === "ar" ? "rtl" : "ltr")}
            className="cms-input"
          />
        </div>
      )}
    </div>
  );
};

const PhoneInputField = ({ label, fieldKey }: { label: string, fieldKey: string }) => {
  const { currentContent, setContent } = React.useContext(CMSContext);
  const icon = FIELD_ICONS[fieldKey] || "phone";
  
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
          borderRadius: "10px",
          direction: "ltr",
          /* Without this the fixed-width segments push the row past the card. */
          minWidth: 0,
          overflow: "hidden",
          transition: "all 0.25s ease"
        }} 
      >
        <span className="material-symbols-outlined" style={{ color: "var(--muted)", fontSize: "1.2rem", display: "flex" }}>{icon}</span>
        
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
          <span className="material-symbols-outlined cms-upload-icon">cloud_upload</span>
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
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>photo_library</span>
        اختيار من مكتبة الوسائط
      </button>

      {/* Preview block if image exists */}
      {hasImage && (
        <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 8 }}>
          <div className="cms-image-preview-card">
            <img src={imageUrl} alt={label} className="cms-preview-img" onClick={() => setPreviewImageUrl(imageUrl)} style={{ cursor: "zoom-in" }} />
            <div className="cms-preview-overlay" style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setPreviewImageUrl(imageUrl)} 
                className="cms-preview-btn-delete"
                style={{ background: 'rgba(255, 255, 255, 0.2)' }}
                title="عرض الصورة"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span>
                عرض
              </button>
              <button 
                onClick={() => handleDeleteImage(fieldKey)} 
                disabled={isUploading || isSaving}
                className="cms-preview-btn-delete"
                title="حذف الصورة"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function AdminCMSClient({ initialEn, initialAr }: { initialEn: JsonRecord; initialAr: JsonRecord }) {
  const [contentEn, setContentEn] = useState(initialEn);
  const [contentAr, setContentAr] = useState(initialAr);
  /* Snapshot of what is actually stored, so edits can be compared against it.
     Nothing tracked unsaved state before: switching tab, flipping language or
     closing the tab discarded every pending edit without a word. */
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({ en: initialEn, ar: initialAr })
  );
  /* Compared as a whole rather than with a per-field flag: edits land in two
     language objects and several nested shapes, and one snapshot cannot drift
     out of step with them the way a scattered set of flags would. */
  const isDirty = JSON.stringify({ en: contentEn, ar: contentAr }) !== savedSnapshot;
  const [activeLang, setActiveLang] = useState<"ar" | "en">("ar");
  const [activeTab, setActiveTab] = useState("hero");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [mediaLibrary, setMediaLibrary] = useState<{name: string, url: string}[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const previewWindowRef = React.useRef<Window | null>(null);

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

  const handleOpenPreview = () => {
    let url = "/?preview=true";
    if (activeTab === "login") {
      url = "/login?preview=true";
    } else if (activeTab === "contact") {
      url = "/?preview=true#contact";
    } else if (activeTab === "membership") {
      url = "/?preview=true#membership";
    } else if (activeTab === "coach") {
      url = "/?preview=true#coach";
    }
    
    const payload = activeLang === "ar" ? contentAr : contentEn;
    localStorage.setItem("cms_preview_data", JSON.stringify({
      lang: activeLang,
      payload
    }));

    previewWindowRef.current = window.open(url, "cms_preview");
    if (previewWindowRef.current) {
      previewWindowRef.current.focus();
    }
  };

  const loadMedia = async () => {
    setIsLoadingMedia(true);
    const images = await listImagesServer();
    setMediaLibrary(images);
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

  const currentContent = activeLang === "ar" ? contentAr : contentEn;
  const setContent = (key: string, value: string) => {
    // Fields that should be exactly the same in both Arabic and English
    const universalFields = ["contact_phone", "contact_email", "contact_ig"];
    
    if (universalFields.includes(key)) {
      setContentAr({ ...contentAr, [key]: value });
      setContentEn({ ...contentEn, [key]: value });
    } else {
      if (activeLang === "ar") {
        setContentAr({ ...contentAr, [key]: value });
      } else {
        setContentEn({ ...contentEn, [key]: value });
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const attempt = JSON.stringify({ en: contentEn, ar: contentAr });
    const result = await saveLandingContent(contentEn, contentAr);
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

  const processAndUploadImage = async (imageFile: File, fieldKey?: string) => {
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const toastId = toast.loading("جاري رفع الصورة... 0%");
      
      const options = {
        maxSizeMB: 2, 
        useWebWorker: true,
        alwaysKeepResolution: true, 
        initialQuality: 0.95,
        onProgress: (p: number) => {
          const prog = Math.round(p * 0.5);
          setUploadProgress(prog);
          toast.loading(`جاري رفع الصورة... ${prog}%`, { id: toastId });
        }
      };
      
      const compressedFile = await imageCompression(imageFile, options);
      
      let simulatedProgress = 50;
      const progressInterval = setInterval(() => {
        simulatedProgress += 10;
        if (simulatedProgress <= 90) {
          setUploadProgress(simulatedProgress);
          toast.loading(`جاري رفع الصورة... ${simulatedProgress}%`, { id: toastId });
        }
      }, 300);

      const formData = new FormData();
      formData.append('file', compressedFile as File);
      const url = await uploadImageServer(formData);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (url) {
        if (fieldKey) {
          setContentAr((prev: JsonRecord) => ({ ...prev, [fieldKey]: url }));
          setContentEn((prev: JsonRecord) => ({ ...prev, [fieldKey]: url }));
        }
        setMediaLibrary((prev) => [{ name: imageFile.name, url }, ...prev]);
        toast.success("تم ضغط ورفع الصورة بنجاح!", { id: toastId });
      } else {
        toast.error("فشل رفع الصورة.", { id: toastId });
      }
    } catch (error) {
      console.error("Error compressing image:", error);
      toast.error("حدث خطأ أثناء معالجة الصورة.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
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
      const croppedImageFile = await getCroppedImg(cropImageSrc, croppedAreaPixels);
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
          setContentEn((prev: JsonRecord) => ({ ...prev, [fieldKey]: PLACEHOLDER_IMAGE }));
        }
        if (activeTab === "media") {
          setMediaLibrary(mediaLibrary.filter(img => img.url !== urlToDelete));
        }
        toast.success("تم حذف الصورة بنجاح!", { id: toastId });
      } else {
        if (fieldKey) {
          setContentAr((prev: JsonRecord) => ({ ...prev, [fieldKey]: PLACEHOLDER_IMAGE }));
          setContentEn((prev: JsonRecord) => ({ ...prev, [fieldKey]: PLACEHOLDER_IMAGE }));
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

        setContentEn((prev: JsonRecord) => {
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
        setContentEn((prev: JsonRecord) => ({ ...prev, [activeMediaSelectField]: url }));
        setActiveMediaSelectField(null);
      }
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("تم نسخ رابط الصورة بنجاح!");
  };

  return (
    <CMSContext.Provider value={{ currentContent, setContent, activeLang, isUploading, uploadProgress, handleImageUpload, openMediaSelector, handleDeleteImage, isSaving, setPreviewImageUrl }}>
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
          <h2 className="cms-header-title">
            <span className="material-symbols-outlined">web</span>
            محتوى الموقع
          </h2>
          <p className="cms-header-sub">
            قم بتعديل نصوص وصور الصفحة الرئيسية. كل لغة تُحفظ على حدة — بدّل بين
            «عربي» و«English» لتحرير النسختين.
          </p>
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

      {previewImageUrl && (
        <div 
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", cursor: "zoom-out" }}
          onClick={() => setPreviewImageUrl(null)}
        >
          <img src={previewImageUrl} style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }} alt="Preview" />
          <button style={{ position: "absolute", top: 24, right: 24, background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }}>
            <span className="material-symbols-outlined">close</span>
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
                  <span className="material-symbols-outlined">person</span>
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
                            setContentAr((prev: JsonRecord) => ({ ...prev, card1_active: val }));
                            setContentEn((prev: JsonRecord) => ({ ...prev, card1_active: val }));
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
                    
                    <ImageUploadField label="صورة الباقة الأولى" fieldKey="card1_img_url" recommendedSize="600x600 (مربعة)" />
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
                            setContentAr((prev: JsonRecord) => ({ ...prev, card2_active: val }));
                            setContentEn((prev: JsonRecord) => ({ ...prev, card2_active: val }));
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
                    
                    <ImageUploadField label="صورة الباقة الثانية" fieldKey="card2_img_url" recommendedSize="600x600 (مربعة)" />
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
                            setContentAr((prev: JsonRecord) => ({ ...prev, card3_active: val }));
                            setContentEn((prev: JsonRecord) => ({ ...prev, card3_active: val }));
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
                    
                    <ImageUploadField label="صورة الباقة الثالثة" fieldKey="card3_img_url" recommendedSize="600x600 (مربعة)" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "login" && (
              <div className="cms-section-card">
                <h3 className="cms-card-title">
                  <span className="material-symbols-outlined">login</span>
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
                  <span className="material-symbols-outlined">contact_support</span>
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
                      <span className="material-symbols-outlined">photo_library</span>
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
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload</span>
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
                  <p style={{ padding: 48, textAlign: "center", background: "var(--bg3)", borderRadius: 12, color: "var(--muted)" }}>لا توجد صور مرفوعة حالياً في المكتبة.</p>
                ) : (
                  <div className="cms-media-grid">
                    {mediaLibrary.map((img, idx) => (
                      <div key={idx} className="cms-media-card">
                        <img src={img.url} alt={img.name} className="cms-media-img" onClick={() => setPreviewImageUrl(img.url)} style={{ cursor: "zoom-in" }} />
                        <div className="cms-media-overlay">
                          <span className="cms-media-name" title={img.name}>{img.name}</span>
                          <div className="cms-media-actions">
                            <button onClick={() => setPreviewImageUrl(img.url)} className="cms-media-btn copy" title="عرض الصورة">
                              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>visibility</span>
                            </button>
                            <button onClick={() => handleCopyUrl(img.url)} className="cms-media-btn copy" title="نسخ الرابط">
                              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>content_copy</span>
                            </button>
                            <button onClick={() => handleDeleteFromLibrary(img.url)} disabled={isUploading} className="cms-media-btn delete" title="حذف الصورة">
                              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>delete</span>
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
          {isDirty ? (
            <span className="cms-dirty">تغييرات غير محفوظة</span>
          ) : (
            <span className="cms-saved">
              <span className="material-symbols-outlined">cloud_done</span>
              كل التغييرات محفوظة
            </span>
          )}

          {activeTab !== "media" && (
            <button
              onClick={handleOpenPreview}
              disabled={isSaving || isUploading}
              className="cms-btn-secondary"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>open_in_new</span>
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
    </CMSContext.Provider>
  );
}
