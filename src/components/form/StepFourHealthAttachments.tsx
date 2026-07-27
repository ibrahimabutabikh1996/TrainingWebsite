"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { Dropzone, FormGrid, FormSection, TextArea, TextInput } from "./Fields";
import type { StepProps } from "./types";

export function StepFourHealthAttachments({ formData, update }: StepProps) {
  const { t } = useLanguage();

  /* Single-file dropzones store one File (or null); the multi one stores a list. */
  const single = (files: File[]) => files[0] ?? null;

  return (
    <>
      <FormSection title={t("sec_health")}>
        <FormGrid>
          <TextArea
            label={t("lbl_injuries")}
            value={formData.injuries}
            onChange={(injuries) => update({ injuries })}
            placeholder={t("ph_injuries")}
            rows={2}
            optional
          />
          <Dropzone
            label={t("lbl_analysis")}
            prompt={t("lbl_upload_file")}
            files={formData.analysis_file ? [formData.analysis_file] : []}
            onFiles={(files) => update({ analysis_file: single(files) })}
            accept="image/*,application/pdf"
            optional
          />
        </FormGrid>
      </FormSection>

      {formData.gender === "male" && (
        <FormSection title={t("lbl_photos_male")} hint={t("lbl_photos_male_hint")}>
          <Dropzone
            prompt={t("lbl_upload_photos")}
            files={formData.body_photos}
            onFiles={(body_photos) => update({ body_photos })}
            accept="image/*"
            multiple
            preview
          />
        </FormSection>
      )}

      {formData.gender === "female" && (
        <FormSection title={t("sub_measurements")}>
          <FormGrid tight>
            <TextInput
              label={t("lbl_meas_arm")}
              type="number"
              inputMode="decimal"
              unit={t("unit_cm")}
              value={formData.meas_arm}
              onChange={(meas_arm) => update({ meas_arm })}
            />
            <TextInput
              label={t("lbl_meas_waist")}
              type="number"
              inputMode="decimal"
              unit={t("unit_cm")}
              value={formData.meas_waist}
              onChange={(meas_waist) => update({ meas_waist })}
            />
            <TextInput
              label={t("lbl_meas_hips")}
              type="number"
              inputMode="decimal"
              unit={t("unit_cm")}
              value={formData.meas_hips}
              onChange={(meas_hips) => update({ meas_hips })}
            />
            <TextInput
              label={t("lbl_meas_leg")}
              type="number"
              inputMode="decimal"
              unit={t("unit_cm")}
              value={formData.meas_leg}
              onChange={(meas_leg) => update({ meas_leg })}
            />
          </FormGrid>
        </FormSection>
      )}

      <FormSection title={t("sec_supplements")}>
        <FormGrid>
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
            files={formData.supplements_photo ? [formData.supplements_photo] : []}
            onFiles={(files) => update({ supplements_photo: single(files) })}
            accept="image/*"
            preview
            optional
          />
        </FormGrid>
      </FormSection>

      <FormSection title={t("sec_diet_history")} hint={t("lbl_diet_history_hint")}>
        <FormGrid>
          <TextArea
            label={t("lbl_diet_history")}
            value={formData.diet_history}
            onChange={(diet_history) => update({ diet_history })}
            placeholder={t("ph_diet_history")}
            rows={3}
            optional
          />
          <Dropzone
            prompt={t("lbl_upload_diet_plan")}
            files={formData.diet_history_file ? [formData.diet_history_file] : []}
            onFiles={(files) => update({ diet_history_file: single(files) })}
            accept="image/*,application/pdf"
            optional
          />
        </FormGrid>
      </FormSection>
    </>
  );
}
