"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { FormGrid, FormSection, SelectField, TextArea, TextInput } from "./Fields";
import type { StepProps } from "./types";
import type { TranslationKey } from "@/lib/translations";

const GOALS: TranslationKey[] = [
  "opt_goal_weight_loss",
  "opt_goal_muscle_gain",
  "opt_goal_fitness",
  "opt_goal_health",
];
const COFFEE: TranslationKey[] = ["opt_coffee_0", "opt_coffee_1", "opt_coffee_2", "opt_coffee_more"];
const MEAT: TranslationKey[] = ["opt_meat_chicken", "opt_meat_beef", "opt_meat_fish", "opt_meat_mixed"];
const YES_NO: TranslationKey[] = ["opt_yes", "opt_no"];

export function StepThreeNutritionGoals({ formData, update }: StepProps) {
  const { t } = useLanguage();
  const drinksCoffee = formData.coffee_rate !== "" && formData.coffee_rate !== "opt_coffee_0";

  return (
    <>
      <FormSection title={t("sec_goal")}>
        <FormGrid>
          <SelectField
            label={t("lbl_sub_goal")}
            value={formData.sub_goal}
            onChange={(sub_goal) => update({ sub_goal })}
            options={GOALS}
            required
          />
          <TextInput
            label={t("lbl_target_weight")}
            type="number"
            inputMode="decimal"
            min={30}
            max={300}
            unit={t("unit_kg")}
            value={formData.target_weight}
            onChange={(target_weight) => update({ target_weight })}
            required
          />
        </FormGrid>
      </FormSection>

      <FormSection title={t("sec_food_prefs")}>
        <FormGrid>
          <TextArea
            label={t("lbl_allergies")}
            value={formData.allergies}
            onChange={(allergies) => update({ allergies })}
            placeholder={t("ph_allergies")}
            rows={2}
            optional
          />
          <TextArea
            label={t("lbl_fav_foods")}
            value={formData.fav_foods}
            onChange={(fav_foods) => update({ fav_foods })}
            placeholder={t("ph_fav_foods")}
            rows={2}
            optional
          />
          <SelectField
            label={t("lbl_meat")}
            value={formData.meat}
            onChange={(meat) => update({ meat })}
            options={MEAT}
            required
          />
          <SelectField
            label={t("lbl_coffee_rate")}
            value={formData.coffee_rate}
            onChange={(coffee_rate) => update({ coffee_rate })}
            options={COFFEE}
            required
          />
          {drinksCoffee && (
            <TextInput
              label={t("lbl_coffee_type")}
              value={formData.coffee_type}
              onChange={(coffee_type) => update({ coffee_type })}
              placeholder={t("ph_coffee_type")}
              optional
            />
          )}
        </FormGrid>
      </FormSection>

      <FormSection title={t("sec_supplements")}>
        <FormGrid>
          <SelectField
            label={t("lbl_buy_supp")}
            value={formData.buy_supp}
            onChange={(buy_supp) => update({ buy_supp })}
            options={YES_NO}
            required
            full
          />
        </FormGrid>
      </FormSection>
    </>
  );
}
