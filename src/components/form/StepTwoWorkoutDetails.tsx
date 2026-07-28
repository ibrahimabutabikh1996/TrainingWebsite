"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { ChipGroup, FormGrid, FormSection, SelectField, TextArea } from "./Fields";
import type { StepProps, SubscriptionFormData } from "./types";
import type { TranslationKey } from "@/lib/translations";

const BREAKFAST: TranslationKey[] = ["opt_bf_1", "opt_bf_2", "opt_bf_3", "opt_bf_4"];
const LUNCH: TranslationKey[] = ["opt_lh_1", "opt_lh_2", "opt_lh_3", "opt_lh_4", "opt_lh_5"];
const DINNER: TranslationKey[] = ["opt_dn_1", "opt_dn_2", "opt_dn_3", "opt_dn_4", "opt_dn_5"];

const EXPERIENCE: TranslationKey[] = ["opt_exp_none", "opt_exp_1", "opt_exp_2", "opt_exp_more"];
const EXP_TYPES: TranslationKey[] = [
  "chk_exp_weights",
  "chk_exp_home",
  "chk_exp_martial",
  "chk_exp_boxing",
  "chk_exp_other",
];
const COMMIT: TranslationKey[] = ["opt_commit_gym", "opt_commit_home"];
const DAYS: TranslationKey[] = ["opt_days_2", "opt_days_3", "opt_days_4", "opt_days_5", "opt_days_6"];
const GYM_TIME: TranslationKey[] = ["opt_time_1", "opt_time_2", "opt_time_3"];

export function StepTwoWorkoutDetails({ formData, update }: StepProps) {
  const { t } = useLanguage();

  const toggleExpType = (value: string) => {
    const current = formData.workout_type_exp;
    update({
      workout_type_exp: current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    });
  };

  /* The three meal selects repeat for work days and days off. */
  const mealFields = (prefix: "workday" | "holiday") => (
    <FormGrid tight>
      <SelectField
        label={t("lbl_meal_breakfast")}
        value={formData[`${prefix}_breakfast` as keyof SubscriptionFormData] as string}
        onChange={(v) => update({ [`${prefix}_breakfast`]: v } as Partial<SubscriptionFormData>)}
        options={BREAKFAST}
        required
      />
      <SelectField
        label={t("lbl_meal_lunch")}
        value={formData[`${prefix}_lunch` as keyof SubscriptionFormData] as string}
        onChange={(v) => update({ [`${prefix}_lunch`]: v } as Partial<SubscriptionFormData>)}
        options={LUNCH}
        required
      />
      <SelectField
        label={t("lbl_meal_dinner")}
        value={formData[`${prefix}_dinner` as keyof SubscriptionFormData] as string}
        onChange={(v) => update({ [`${prefix}_dinner`]: v } as Partial<SubscriptionFormData>)}
        options={DINNER}
        required
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

          <ChipGroup
            label={t("lbl_workout_type_exp")}
            options={EXP_TYPES}
            values={formData.workout_type_exp}
            onToggle={toggleExpType}
            optional
          />

          <TextArea
            label={t("lbl_workout_type_other_desc")}
            value={formData.workout_type_other_desc}
            onChange={(workout_type_other_desc) => update({ workout_type_other_desc })}
            placeholder={t("ph_workout_other")}
            rows={3}
            optional
          />
        </FormGrid>
      </FormSection>
    </>
  );
}
