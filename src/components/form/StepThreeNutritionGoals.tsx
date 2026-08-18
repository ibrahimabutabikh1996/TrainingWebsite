"use client";

import { FormGrid, FormSection, SelectField, TextArea, TextInput, Dropzone } from "./Fields";
import type { StepProps } from "./types";
import { t, type TranslationKey } from "@/lib/translations";


const COFFEE: TranslationKey[] = ["opt_coffee_0", "opt_coffee_1", "opt_coffee_2", "opt_coffee_more"];
const YES_NO: TranslationKey[] = ["opt_yes", "opt_no"];

export function StepThreeNutritionGoals({ formData, update }: StepProps) {
  const drinksCoffee = formData.coffee_rate !== "" && formData.coffee_rate !== "opt_coffee_0";



  return (
    <>
      <FormSection title={t("sec_goal")}>
        <FormGrid>
          <TextArea
            label={t("lbl_sub_goal")}
            value={formData.sub_goal}
            onChange={(sub_goal) => update({ sub_goal })}
            placeholder={t("lbl_sub_goal")}
            rows={2}
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
            required
          />
          <TextArea
            label={t("lbl_fav_foods")}
            value={formData.fav_foods}
            onChange={(fav_foods) => update({ fav_foods })}
            placeholder={t("ph_fav_foods")}
            rows={2}
            required
          />
          <TextArea
            label={t("lbl_meat")}
            value={Array.isArray(formData.meat) ? formData.meat.join(', ') : (formData.meat || "")}
            onChange={(meat) => update({ meat })}
            placeholder={t("lbl_meat")}
            rows={2}
            optional
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
              required
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
          {formData.buy_supp === "opt_yes" && (
            <>
              <TextArea
                label={t("lbl_supplements_list")}
                value={formData.supplements_list}
                onChange={(supplements_list) => update({ supplements_list })}
                placeholder={t("ph_supplements")}
                rows={2}
                optional
              />
              <Dropzone
                prompt={t("lbl_upload_supp_img")}
                files={Array.isArray(formData.supplements_photo) ? formData.supplements_photo : (formData.supplements_photo ? [formData.supplements_photo as unknown as File] : [])}
                onFiles={(files) => update({ supplements_photo: files })}
                accept="image/*"
                multiple
                preview
                optional
              />
            </>
          )}
        </FormGrid>
      </FormSection>
    </>
  );
}
