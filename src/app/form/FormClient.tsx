"use client";

import { useCallback, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

import { StepOneBasicInfo } from "@/components/form/StepOneBasicInfo";
import { StepTwoWorkoutDetails } from "@/components/form/StepTwoWorkoutDetails";
import { StepThreeNutritionGoals } from "@/components/form/StepThreeNutritionGoals";
import { StepFourHealthAttachments } from "@/components/form/StepFourHealthAttachments";
import { PaymentGate } from "@/components/form/PaymentGate";
import { IconCheck } from "@/components/form/Fields";
import { planNameFrom, type PlanNames } from "@/lib/planNames";
import type { SubscriptionFormData } from "@/components/form/types";
import { useUploads } from "@/hooks/useUploads";
import { INTAKE_UPLOAD_FIELDS, isIntakeUploadField } from "@/lib/uploadFields";
import { t, type TranslationKey } from "@/lib/translations";
import "../landing.css"; // fixed navbar + shared premium chrome
import "./form.css";
import { optimizedSrc, optimizedSrcSet } from "@/lib/imageOptim";

const TOTAL_STEPS = 4;

const STEP_NAMES: TranslationKey[] = [
  "form_step1_name",
  "form_step2_name",
  "form_step3_name",
  "form_step4_name",
];

const STEP_TITLES: TranslationKey[] = ["step1_title", "step2_title", "step3_title", "step4_title"];

function FormNavbar() {


  return (
    <nav id="navbar" className="scrolled">
      <Link href="/" className="nav-logo" title="Ibrahim Abutabikh Logo">
        <span className="nav-logo-mark" style={{ width: "auto", maxWidth: "min(280px, 100%)" }}>
          <img
            src={optimizedSrc("/images/logo/hLogo.png", 384)}
            srcSet={optimizedSrcSet("/images/logo/hLogo.png", [384, 640, 828])}
            sizes="280px"
            alt="Ibrahim Abutabikh Logo"
            style={{ maxHeight: "48px", height: "100%", width: "auto", objectFit: "contain", display: "block" }}
          />
        </span>
      </Link>
      <div className="nav-actions">
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
  payment_receipt: [],

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

function FormContent({ planNames }: { planNames: PlanNames }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRenew = searchParams.get("renew") === "true";
  const profileId = searchParams.get("profileId");

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  /* The payment gate stands in front of step 1 for everyone: the fee is settled
     over WhatsApp and the transfer slip attached before any question is asked.
     A renewal used to skip it, on the reasoning that a renewing trainee is
     "already a paying member" — but a renewal is a new month and so a new
     transfer, and the slip is the only thing the coach has to check it against.
     The server requires it on both paths now, so skipping the gate here would
     only produce a form that cannot be submitted. */
  const [paymentDone, setPaymentDone] = useState(false);
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
        let errorData: { error?: string; message?: string } = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          console.error(`Server rejected submission [${res.status} ${res.statusText}] HTML/Text:`, errorText);
        }
        console.error(`Server rejected submission [${res.status} ${res.statusText}] JSON:`, errorData);
        throw new Error(errorData.error || t("form_error_send"));
      }

      setIsSubmitting(false);

      window.scrollTo({ top: 0, behavior: "smooth" });
      setShowSuccess(true);
    } catch (err) {
      console.error("Submission error:", err);
      toast.error(err instanceof Error ? err.message : t("form_error_generic"));
      setIsSubmitting(false);
    }
  };

  /* Read from the URL, not from `formData.plan` — the latter becomes non-empty
     the moment the visitor picks one, which would lock the field behind their
     first choice and leave them unable to change it. */
  const stepProps = {
    formData,
    update,
    planLocked: Boolean(searchParams.get("plan")),
    planNames,
  };

  /* Step 0. Nothing of the questionnaire is rendered until the fee is settled
     and the transfer slip is attached — the trainee messages the coach from
     here, and comes back to this same screen to upload the receipt. */
  if (!paymentDone) {
    return (
      <PaymentGate
        planNames={planNames}
        plan={formData.plan}
        planLocked={Boolean(searchParams.get("plan"))}
        onPlan={(plan) => update({ plan })}
        receipt={formData.payment_receipt}
        onReceipt={(payment_receipt) => update({ payment_receipt })}
        isUploading={uploads.isUploading}
        hasFailed={uploads.failed.length > 0}
        onStart={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
          setPaymentDone(true);
        }}
      />
    );
  }

  if (showSuccess) {
    return (
      <div className="form-shell form-shell--centered">
        <article className="form-sheet done-sheet">
          <h2 className="done-title">{t("form_done_title")}</h2>
          <p className="done-summary">
            {t("form_done_name")}: <strong>{formData.fullname}</strong>
            <br />
            {t("form_done_plan")}: <strong>{planNameFrom(planNames, formData.plan)}</strong>
          </p>
          <p className="done-text">{isRenew ? t("form_done_renew_text") : t("form_done_text")}</p>
          {/* One way out, and it is the sign-in page: the account is how the
              trainee reaches the programme once the coach has built it. */}
          <button onClick={() => router.push("/login")} className="form-btn form-btn--primary">
            {t("form_done_login")}
          </button>
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
      <img
        src={optimizedSrc("/images/logo/vLogo.png", 384)}
        srcSet={optimizedSrcSet("/images/logo/vLogo.png", [256, 384])}
        sizes="180px"
        alt="Loading..."
        className="loading-vlogo"
      />
      <span>{t("form_loading")}</span>
    </div>
  );
}

export default function FormClient({ planNames }: { planNames: PlanNames }) {
  return (
    <div className="landing-wrapper form-page">
      <FormNavbar />
      <main id="main" className="form-main">
        <Suspense fallback={<FormFallback />}>
          <FormContent planNames={planNames} />
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

