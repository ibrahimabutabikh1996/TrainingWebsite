"use client";

import { useCallback, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

import { useTheme } from "@/contexts/ThemeContext";
import { StepOneBasicInfo } from "@/components/form/StepOneBasicInfo";
import { StepTwoWorkoutDetails } from "@/components/form/StepTwoWorkoutDetails";
import { StepThreeNutritionGoals } from "@/components/form/StepThreeNutritionGoals";
import { StepFourHealthAttachments } from "@/components/form/StepFourHealthAttachments";
import { IconCheck } from "@/components/form/Fields";
import type { SubscriptionFormData } from "@/components/form/types";
import { useUploads } from "@/hooks/useUploads";
import { INTAKE_UPLOAD_FIELDS, isIntakeUploadField } from "@/lib/uploadFields";
import { t, type TranslationKey } from "@/lib/translations";
import "../landing.css"; // fixed navbar + shared premium chrome
import "./form.css";

const TOTAL_STEPS = 4;

const STEP_NAMES: TranslationKey[] = [
  "form_step1_name",
  "form_step2_name",
  "form_step3_name",
  "form_step4_name",
];

const STEP_TITLES: TranslationKey[] = ["step1_title", "step2_title", "step3_title", "step4_title"];

function FormNavbar() {
  const { toggleTheme } = useTheme();


  return (
    <nav id="navbar" className="scrolled">
      <Link href="/" className="nav-logo" title="Ibrahim Abutabikh Logo">
        <span className="nav-logo-mark" style={{ width: "auto", maxWidth: "280px" }}>
          <img src="/images/logo/hLogo.png" alt="Ibrahim Abutabikh Logo" style={{ maxHeight: "48px", height: "100%", width: "auto", objectFit: "contain", display: "block" }} />
        </span>
      </Link>
      <div className="nav-actions">
        <button className="theme-toggle" id="themeToggle" onClick={toggleTheme} aria-label="تبديل المظهر">
          <svg className="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          <svg className="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>
        <Link href="/" className="nav-cta">
          {t("nav_home")}
        </Link>
      </div>
    </nav>
  );
}

function Stepper({
  currentStep,
  onJump,
}: {
  currentStep: number;
  onJump: (step: number) => void;
}) {
  /* Fill spans the gaps already crossed, not the steps themselves. */
  const fill = ((currentStep - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <div className="stepper">
      <p className="stepper-count">
        {t("form_step_word")} <b>{currentStep}</b> {t("form_step_of")} {TOTAL_STEPS}
        <span className="stepper-current-name">
          {" — "}
          {t(STEP_NAMES[currentStep - 1])}
        </span>
      </p>
      <ol
        className="stepper-list"
        aria-label={t("form_eyebrow")}
        style={{ "--step-count": TOTAL_STEPS } as React.CSSProperties}
      >
        <span className="stepper-track" aria-hidden="true">
          <span className="stepper-fill" style={{ width: `${fill}%` }} />
        </span>
        {STEP_NAMES.map((nameKey, i) => {
          const step = i + 1;
          const state = step < currentStep ? "done" : step === currentStep ? "current" : "todo";
          /* Jumping forward would skip that step's native validation, so only
             already-completed steps are reachable by click. */
          const clickable = state === "done";
          return (
            <li key={nameKey} style={{ display: "contents" }}>
              <button
                type="button"
                className="stepper-item"
                data-state={state}
                data-clickable={clickable}
                aria-current={state === "current" ? "step" : undefined}
                disabled={!clickable}
                onClick={() => clickable && onJump(step)}
              >
                <span className="stepper-dot">
                  {state === "done" ? <IconCheck /> : step}
                </span>
                <span className="stepper-label">{t(nameKey)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const initialData: SubscriptionFormData = {
  fullname: "",
  phone: "",
  plan: "",
  plan_type: "",
  gender: "male",
  age: "",
  weight: "",
  height: "",
  activity: "",
  residence: "",
  employment: "",

  workday_breakfast: "",
  workday_lunch: "",
  workday_dinner: "",
  holiday_breakfast: "",
  holiday_lunch: "",
  holiday_dinner: "",
  workout_exp: "",
  workout_type_exp: [],
  workout_type_other_desc: "",
  workout_commit: "",
  workout_days: "",
  gym_time: "",
  home_equipment_photo: [],

  sub_goal: "",
  target_weight: "",
  allergies: "",
  fav_foods: "",
  coffee_rate: "",
  coffee_type: "",
  meat: "",
  buy_supp: "",

  injuries: "",
  analysis_file: [],
  body_photos: [],
  meas_arm: "",
  meas_waist: "",
  meas_hips: "",
  meas_leg: "",
  supplements_list: "",
  supplements_photo: [],
  diet_history: "",
  diet_history_file: [],
  last_diet_fail: "",
  eating_reason: "",
};

function FormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRenew = searchParams.get("renew") === "true";
  const profileId = searchParams.get("profileId");

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [formData, setFormData] = useState<SubscriptionFormData>({
    ...initialData,
    plan: searchParams.get("plan") || "",
  });

  /* Files leave for storage as they are chosen, not with the submission — see
     `useUploads`. Vercel refuses a request body much over 4.5 MB, which one
     phone photo can already exceed. */
  const uploads = useUploads({
    scope: isRenew && profileId ? "renewal" : "registration",
    profileId: profileId ?? undefined,
  });

  const update = useCallback(
    (patch: Partial<SubscriptionFormData>) => {
      setFormData((prev) => ({ ...prev, ...patch }));

      /* Any attachment field in this patch starts uploading now. Doing it here
         rather than in an effect keeps it tied to the person's action, so the
         upload begins on the click that chose the file. */
      for (const [key, value] of Object.entries(patch)) {
        if (isIntakeUploadField(key) && Array.isArray(value)) {
          uploads.sync(key, value as File[]);
        }
      }
    },
    [uploads]
  );

  const goTo = (step: number) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setCurrentStep(Math.min(TOTAL_STEPS, Math.max(1, step)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    /* Explicit validation for required file upload dropzones that browser validation may bypass */
    if (currentStep === 4 || currentStep === TOTAL_STEPS) {
      if (formData.gender === "male" && (!formData.body_photos || formData.body_photos.length === 0)) {
        toast.error("إرفاق صور الجسم (مطلوبة للذكور) حقل إجباري للمتابعة وإكمال الاستبيان.");
        if (currentStep === TOTAL_STEPS) {
          goTo(4);
        }
        return;
      }
    }

    /* Each step is its own submit, so the browser has already validated the
       fields currently on screen before we get here. */
    if (currentStep < TOTAL_STEPS) {
      goTo(currentStep + 1);
      return;
    }

    /* A file still in flight has no confirmed record yet, so submitting now
       would quietly drop it. A failed one has been refused by the server and
       needs replacing, not ignoring. */
    if (uploads.isUploading) {
      toast.error("جاري رفع الملفات، يرجى الانتظار لحظة قبل الإرسال.");
      return;
    }
    if (uploads.failed.length > 0) {
      toast.error(`تعذّر رفع بعض الملفات: ${uploads.failed[0].error ?? ""} — يرجى إزالتها وإعادة اختيارها.`);
      return;
    }

    setIsSubmitting(true);
    try {
      /* The attachments are already in storage; the submission carries the
         answers, the upload session, and which of its files are still wanted.
         The File objects themselves are stripped out — they would serialise to
         empty objects, and the server would ignore them anyway. */
      const answers: Record<string, unknown> = { ...formData };
      for (const field of INTAKE_UPLOAD_FIELDS) delete answers[field];

      const res = await fetch("/api/submit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: JSON.stringify(answers),
          profileId: isRenew && profileId ? profileId : undefined,
          uploadSessionId: uploads.getUploadSessionId() ?? undefined,
          keepItemIds: uploads.keepItemIds,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        let errorData: any = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          console.error(`Server rejected submission [${res.status} ${res.statusText}] HTML/Text:`, errorText);
        }
        console.error(`Server rejected submission [${res.status} ${res.statusText}] JSON:`, errorData);
        throw new Error(errorData.error || t("form_error_send"));
      }

      setIsSubmitting(false);

      if (formData.plan === "plan1") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        setShowWhatsAppModal(true);
      } else {
        toast.success(`${t("form_success_title")}\n${t("form_success_msg")}`, { duration: 8000 });
        if (isRenew) {
          router.push("/dashboard");
        } else {
          router.push("/login?registered=true");
        }
      }
    } catch (err) {
      console.error("Submission error:", err);
      toast.error(err instanceof Error ? err.message : t("form_error_generic"));
      setIsSubmitting(false);
    }
  };

  const stepProps = { formData, update };

  if (showWhatsAppModal) {
    const text = encodeURIComponent("تم الاشتراك في الخطة ذاتية التوجيه");
    const waLink = `https://wa.me/9647877511605?text=${text}`;
    
    return (
      <div className="form-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <article className="form-sheet" style={{ textAlign: 'center', padding: '40px 20px', maxWidth: '480px' }}>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '16px', color: 'var(--text)' }}>تم استلام طلبك بنجاح!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: 1.6, fontSize: '1.1rem' }}>
            لإتمام عملية الدفع وتفعيل الخطة ذاتية التوجيه، يرجى التواصل مع الكابتن عبر الواتساب بالضغط على الزر أدناه.
          </p>
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="form-btn form-btn--primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '12px', textDecoration: 'none', padding: '16px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 448 512" fill="currentColor">
              <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-23.1-115-65.1-157.1zM223.9 414.7c-33 0-65.3-8.9-93.6-25.7l-6.7-4-69.5 18.2L72.7 334l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
            </svg>
            انتقال إلى الواتساب
          </a>
        </article>
      </div>
    );
  }

  return (
    <div className="form-shell">
      <article className="form-sheet">
        <header className="form-sheet-head">
          <span className="form-eyebrow">{t("form_eyebrow")}</span>
          <h1 className="form-title">{isRenew ? t("form_renew_title") : t("form_main_title")}</h1>
          <p className="form-subtitle">
            {isRenew ? t("form_renew_subtitle") : t("form_main_subtitle")}
          </p>
        </header>

        <Stepper currentStep={currentStep} onJump={goTo} />

        <div className="form-sheet-body">
          <form id="multi-step-form" onSubmit={handleSubmit} noValidate={false}>
            <div className="form-step" key={currentStep}>
              <h2 className="form-step-title">{t(STEP_TITLES[currentStep - 1])}</h2>
              <p className="form-step-hint">{t("form_required_hint")}</p>

              {currentStep === 1 && <StepOneBasicInfo {...stepProps} />}
              {currentStep === 2 && <StepTwoWorkoutDetails {...stepProps} />}
              {currentStep === 3 && <StepThreeNutritionGoals {...stepProps} />}
              {currentStep === 4 && <StepFourHealthAttachments {...stepProps} />}
            </div>

            <div className="form-actions">
              {currentStep > 1 && (
                <button
                  type="button"
                  className="form-btn form-btn--ghost"
                  onClick={() => goTo(currentStep - 1)}
                  disabled={isSubmitting}
                >
                  {t("btn_prev")}
                </button>
              )}
              <button type="submit" className="form-btn form-btn--primary" disabled={isSubmitting}>
                {isSubmitting && <span className="btn-spinner" aria-hidden="true" />}
                {isSubmitting
                  ? t("form_submitting")
                  : currentStep === TOTAL_STEPS
                    ? t("btn_submit")
                    : t("btn_next")}
              </button>
            </div>
          </form>
        </div>
      </article>
    </div>
  );
}

function FormFallback() {
  return (
    <div className="form-loading">
      <img src="/images/logo/vLogo.png" alt="Loading..." className="loading-vlogo" />
      <span>{t("form_loading")}</span>
    </div>
  );
}

export default function FormPage() {
  return (
    <div className="landing-wrapper form-page">
      <FormNavbar />
      <main id="main" className="form-main">
        <Suspense fallback={<FormFallback />}>
          <FormContent />
        </Suspense>
      </main>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--bg2)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            fontFamily: "inherit",
            maxWidth: "460px",
            lineHeight: 1.7,
          },
        }}
      />
    </div>
  );
}
