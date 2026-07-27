"use client";

import { useCallback, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { StepOneBasicInfo } from "@/components/form/StepOneBasicInfo";
import { StepTwoWorkoutDetails } from "@/components/form/StepTwoWorkoutDetails";
import { StepThreeNutritionGoals } from "@/components/form/StepThreeNutritionGoals";
import { StepFourHealthAttachments } from "@/components/form/StepFourHealthAttachments";
import { IconCheck } from "@/components/form/Fields";
import type { SubscriptionFormData } from "@/components/form/types";
import type { TranslationKey } from "@/lib/translations";
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
  const { toggleLang, t } = useLanguage();

  return (
    <nav id="navbar" className="scrolled">
      <Link href="/" className="nav-logo">
        <span className="nav-logo-mark" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </span>
        <span className="nav-logo-text">{t("nav_logo_text")}</span>
      </Link>
      <div className="nav-actions">
        <button className="theme-toggle" id="themeToggle" onClick={toggleTheme} aria-label="Toggle theme">
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
        <button className="lang-toggle" id="langToggle" onClick={toggleLang} aria-label="Switch Language">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
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
  const { t } = useLanguage();
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

  sub_goal: "",
  target_weight: "",
  allergies: "",
  fav_foods: "",
  coffee_rate: "",
  coffee_type: "",
  meat: "",
  buy_supp: "",

  injuries: "",
  analysis_file: null,
  body_photos: [],
  meas_arm: "",
  meas_waist: "",
  meas_hips: "",
  meas_leg: "",
  supplements_list: "",
  supplements_photo: null,
  diet_history: "",
  diet_history_file: null,
};

function FormContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRenew = searchParams.get("renew") === "true";
  const profileId = searchParams.get("profileId");

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<SubscriptionFormData>({
    ...initialData,
    plan: searchParams.get("plan") || "",
  });

  const update = useCallback((patch: Partial<SubscriptionFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  }, []);

  const goTo = (step: number) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setCurrentStep(Math.min(TOTAL_STEPS, Math.max(1, step)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    /* Each step is its own submit, so the browser has already validated the
       fields currently on screen before we get here. */
    if (currentStep < TOTAL_STEPS) {
      goTo(currentStep + 1);
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData = new FormData();

      submitData.append(
        "data",
        JSON.stringify({
          ...formData,
          analysis_file: undefined,
          body_photos: undefined,
          supplements_photo: undefined,
          diet_history_file: undefined,
        })
      );

      if (formData.analysis_file) submitData.append("analysis_file", formData.analysis_file);
      if (formData.supplements_photo) submitData.append("supplements_photo", formData.supplements_photo);
      if (formData.diet_history_file) submitData.append("diet_history_file", formData.diet_history_file);

      if (isRenew && profileId) {
        submitData.append("profileId", profileId);
      }

      formData.body_photos.forEach((file) => submitData.append("body_photos", file));

      const res = await fetch("/api/submit-form", { method: "POST", body: submitData });
      if (!res.ok) throw new Error(t("form_error_send"));

      setIsSubmitting(false);
      toast.success(`${t("form_success_title")}\n${t("form_success_msg")}`, { duration: 6000 });
      router.push("/dashboard");
    } catch (err) {
      console.error("Submission error:", err);
      toast.error(t("form_error_generic"));
      setIsSubmitting(false);
    }
  };

  const stepProps = { formData, update };

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
  const { t } = useLanguage();
  return (
    <div className="form-loading">
      <span className="btn-spinner" aria-hidden="true" />
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
