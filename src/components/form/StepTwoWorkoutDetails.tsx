"use client";

import { ChipGroup, Dropzone, FormGrid, FormSection, SelectField, TextArea, Field } from "./Fields";
import { useId } from "react";
import { CustomSelect } from "@/components/CustomSelect";
import type { StepProps, SubscriptionFormData } from "./types";
import { t, type TranslationKey } from "@/lib/translations";

const BREAKFAST: TranslationKey[] = ["opt_bf_1", "opt_bf_2", "opt_bf_3", "opt_bf_4"];
const LUNCH: TranslationKey[] = ["opt_lh_1", "opt_lh_2", "opt_lh_3", "opt_lh_4", "opt_lh_5"];
const DINNER: TranslationKey[] = ["opt_dn_1", "opt_dn_2", "opt_dn_3", "opt_dn_4", "opt_dn_5"];

const EXPERIENCE: TranslationKey[] = ["opt_exp_none", "opt_exp_1", "opt_exp_2", "opt_exp_more"];
const EXP_TYPES: TranslationKey[] = [
  "chk_exp_weights",
  "chk_exp_home",
  "chk_exp_martial",
  "chk_exp_boxing",
  "chk_exp_bicycle",
  "chk_exp_running",
  "chk_exp_other",
];
const COMMIT: TranslationKey[] = ["opt_commit_gym", "opt_commit_home"];
const DAYS: TranslationKey[] = ["opt_days_2", "opt_days_3", "opt_days_4", "opt_days_5", "opt_days_6"];
const GYM_TIME: TranslationKey[] = ["opt_time_1", "opt_time_2", "opt_time_3"];

interface TimeInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

const PERIODS = ["صباحاً", "مساءاً", "AM", "PM"];

/* Declared at module scope on purpose. Nested inside StepTwoWorkoutDetails it was
   a freshly-created component type on every parent render, so React tore the
   inputs down and rebuilt them after each keystroke — the field lost focus and
   the typed value with it. */
function TimeInput({ label, value, onChange, placeholder, required }: TimeInputProps) {
  const id = useId();
  const parts = (value || "").trim().split(" ");
  const lastPart = parts.length > 0 ? parts[parts.length - 1] : "";
  const isPeriod = PERIODS.includes(lastPart);

  const timePart = isPeriod ? parts.slice(0, -1).join(" ") : value;
  const periodPart = isPeriod ? lastPart : "صباحاً";

  const handleTimeChange = (time: string) => {
    onChange(`${time} ${periodPart}`.trim());
  };

  const handlePeriodChange = (p: string) => {
    if (!timePart) return onChange(p);
    onChange(`${timePart} ${p}`.trim());
  };

  return (
    <Field label={label} htmlFor={id} required={required}>
      {/* The hour and its period are halves of one value, so they share one
          bordered shell rather than sitting as two separate boxes. */}
      <div className="control control--time">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          className="form-input time-value"
          required={required}
          value={timePart}
          placeholder={placeholder}
          onChange={(e) => handleTimeChange(e.target.value)}
        />
        <span className="time-period">
          <CustomSelect
            className="form-input time-period-select"
            value={periodPart}
            onChange={handlePeriodChange}
            options={[
              { value: "صباحاً", label: "صباحاً" },
              { value: "مساءاً", label: "مساءاً" },
            ]}
          />
        </span>
      </div>
    </Field>
  );
}

export function StepTwoWorkoutDetails({ formData, update }: StepProps) {

  const toggleExpType = (value: string) => {
    const current = formData.workout_type_exp;
    update({
      workout_type_exp: current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    });
  };

  const mealFields = (prefix: "workday" | "holiday") => (
    <FormGrid tight>
      <TimeInput
        label={t("lbl_meal_breakfast")}
        value={formData[`${prefix}_breakfast` as keyof SubscriptionFormData] as string}
        onChange={(v: string) => update({ [`${prefix}_breakfast`]: v } as Partial<SubscriptionFormData>)}
        placeholder={t("ph_meal_time") || "مثال: 8:00"}
      />
      <TimeInput
        label={t("lbl_meal_lunch")}
        value={formData[`${prefix}_lunch` as keyof SubscriptionFormData] as string}
        onChange={(v: string) => update({ [`${prefix}_lunch`]: v } as Partial<SubscriptionFormData>)}
        placeholder={t("ph_meal_time") || "مثال: 2:00"}
      />
      <TimeInput
        label={t("lbl_meal_dinner")}
        value={formData[`${prefix}_dinner` as keyof SubscriptionFormData] as string}
        onChange={(v: string) => update({ [`${prefix}_dinner`]: v } as Partial<SubscriptionFormData>)}
        placeholder={t("ph_meal_time") || "مثال: 9:00"}
      />
    </FormGrid>
  );

  return (
    <>
      <FormSection title={t("sub_workday_meals")}>{mealFields("workday")}</FormSection>
      <FormSection title={t("sub_holiday_meals")}>{mealFields("holiday")}</FormSection>

      <FormSection title={t("sub_training_exp")}>
        <FormGrid>
          <SelectField
            label={t("lbl_workout_exp")}
            value={formData.workout_exp}
            onChange={(workout_exp) => update({ workout_exp })}
            options={EXPERIENCE}
            required
          />

          <SelectField
            label={t("lbl_workout_commit")}
            value={formData.workout_commit}
            onChange={(workout_commit) => update({ workout_commit })}
            options={COMMIT}
            required
          />

          <SelectField
            label={t("lbl_workout_days")}
            value={formData.workout_days}
            onChange={(workout_days) => update({ workout_days })}
            options={DAYS}
            required
          />

          {formData.workout_commit === "opt_commit_gym" && (
            <SelectField
              label={t("lbl_gym_time")}
              value={formData.gym_time}
              onChange={(gym_time) => update({ gym_time })}
              options={GYM_TIME}
              required
            />
          )}

          {/* Home trainees are asked to photograph whatever kit they own, so the
              plan is built around equipment that actually exists. */}
          {formData.workout_commit === "opt_commit_home" && (
            <Dropzone
              label={t("lbl_home_equipment")}
              prompt={t("lbl_upload_equipment")}
              files={formData.home_equipment_photo}
              onFiles={(home_equipment_photo) => update({ home_equipment_photo })}
              accept="image/*"
              multiple
              preview
              optional
            />
          )}

          <ChipGroup
            label={t("lbl_workout_type_exp")}
            options={EXP_TYPES}
            values={formData.workout_type_exp}
            onToggle={toggleExpType}
            required
          />

          {formData.workout_type_exp.includes("chk_exp_other") && (
            <TextArea
              label={t("lbl_workout_type_other_desc")}
              value={formData.workout_type_other_desc}
              onChange={(workout_type_other_desc) => update({ workout_type_other_desc })}
              placeholder={t("ph_workout_other")}
              rows={3}
              required
            />
          )}
        </FormGrid>
      </FormSection>
    </>
  );
}
