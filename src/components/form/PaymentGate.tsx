"use client";

/* The screen the registration form opens on.
 *
 * The WhatsApp hand-off used to close the form: the trainee answered four steps
 * of questions and only then was told to message the coach about paying. That
 * put every unpaid enquiry through the whole intake. It now comes first — settle
 * the fee over WhatsApp, attach the transfer slip, and the questions open after.
 *
 * Renewals skip this entirely; they arrive already paying members. See
 * `src/app/form/page.tsx`.
 */

import toast from "react-hot-toast";

import { t } from "@/lib/translations";
import { PLAN_KEYS, planLabel } from "@/lib/formLabels";
import { Dropzone, SelectField } from "./Fields";

/* Also written into src/app/LandingClient.tsx in several places. Named here
   rather than inlined so the one the form sends people to is greppable. */
const COACH_WHATSAPP = "9647877511605";

const PLAN_VALUES = Object.keys(PLAN_KEYS);

function IconWhatsApp() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-23.1-115-65.1-157.1zM223.9 414.7c-33 0-65.3-8.9-93.6-25.7l-6.7-4-69.5 18.2L72.7 334l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
    </svg>
  );
}

const GATE_STEPS = [
  { title: "form_gate_s1_title", text: "form_gate_s1_text" },
  { title: "form_gate_s2_title", text: "form_gate_s2_text" },
  { title: "form_gate_s3_title", text: "form_gate_s3_text" },
] as const;

interface PaymentGateProps {
  plan: string;
  /* True when the plan arrived on the `?plan=` link — then it is only shown.
     Without it the trainee picks here, so the WhatsApp message can name it. */
  planLocked: boolean;
  onPlan: (plan: string) => void;
  receipt: File[];
  onReceipt: (files: File[]) => void;
  isUploading: boolean;
  hasFailed: boolean;
  onStart: () => void;
}

export function PaymentGate({
  plan,
  planLocked,
  onPlan,
  receipt,
  onReceipt,
  isUploading,
  hasFailed,
  onStart,
}: PaymentGateProps) {
  /* No name yet — it is asked for in step 1, which this screen stands in front
     of. The coach sees the sender's number in WhatsApp either way. */
  const waText = encodeURIComponent(`${t("form_gate_wa_msg_1")}${planLabel(plan, "")}${t("form_gate_wa_msg_2")}`);
  const waLink = `https://wa.me/${COACH_WHATSAPP}?text=${waText}`;

  const uploaded = receipt.length > 0;
  const canStart = uploaded && !isUploading;

  const start = () => {
    if (hasFailed) {
      toast.error(t("form_gate_failed"));
      return;
    }
    onStart();
  };

  return (
    <div className="form-shell">
      <article className="form-sheet">
        <header className="form-sheet-head">
          <span className="form-eyebrow">{t("form_eyebrow")}</span>
          <h1 className="form-title">{t("form_gate_title")}</h1>
          <p className="form-subtitle">{t("form_gate_subtitle")}</p>
        </header>

        <div className="form-sheet-body">
          <ol className="gate-steps">
            {GATE_STEPS.map((step, i) => (
              <li key={step.title} className="gate-step">
                <span className="gate-step-num" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="gate-step-body">
                  <b>{t(step.title)}</b>
                  <p>{t(step.text)}</p>
                </div>
              </li>
            ))}
          </ol>

          {planLocked ? (
            <p className="gate-plan">
              {t("form_gate_plan_chosen")}: <b>{planLabel(plan)}</b>
            </p>
          ) : (
            <div className="gate-plan-picker">
              <SelectField
                label={t("lbl_plan")}
                value={plan}
                onChange={onPlan}
                options={PLAN_VALUES.map((value) => ({ value, label: planLabel(value) }))}
                required
                full
              />
            </div>
          )}

          {/* An anchor only once there is a plan to name in the message —
              otherwise the coach receives "أرغب بالاشتراك في  وأريد…" with a
              hole where the plan should be. */}
          {plan ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="form-btn gate-wa"
            >
              <IconWhatsApp />
              {t("form_gate_wa_btn")}
            </a>
          ) : (
            <button type="button" className="form-btn gate-wa" disabled>
              <IconWhatsApp />
              {t("form_gate_wa_btn")}
            </button>
          )}
          {!plan && <p className="gate-note">{t("form_gate_plan_hint")}</p>}

          <div className="gate-receipt">
            {/* Images only, so the thumbnail below is always a real preview of
                what was sent — a PDF renders as a broken image in that grid. */}
            <Dropzone
              label={t("form_gate_receipt")}
              prompt={t("form_gate_receipt_prompt")}
              files={receipt}
              onFiles={onReceipt}
              accept="image/*"
              preview
              required
            />
          </div>

          <div className="gate-actions">
            <button
              type="button"
              className="form-btn form-btn--primary"
              onClick={start}
              disabled={!canStart}
            >
              {isUploading && <span className="btn-spinner" aria-hidden="true" />}
              {isUploading ? t("form_gate_uploading") : t("form_gate_start")}
            </button>
            {!uploaded && <p className="gate-note">{t("form_gate_start_hint")}</p>}
          </div>
        </div>
      </article>
    </div>
  );
}
