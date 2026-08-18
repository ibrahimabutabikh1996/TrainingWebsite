"use client";

import { t } from "@/lib/translations";
import { Dropzone, FormGrid, FormSection, TextArea, TextInput } from "./Fields";
import type { StepProps } from "./types";

export function StepFourHealthAttachments({ formData, update }: StepProps) {

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
            required
          />
          <Dropzone
            label={t("lbl_analysis")}
            prompt={t("lbl_upload_file")}
            files={Array.isArray(formData.analysis_file) ? formData.analysis_file : (formData.analysis_file ? [formData.analysis_file as unknown as File] : [])}
            onFiles={(files) => update({ analysis_file: files })}
            accept="image/*,application/pdf"
            multiple
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
            required
          />
        </FormSection>
      )}

      {/* Females give measurements instead of body photos, so these stand in for
          a required field rather than being extra detail. */}
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
              required
            />
            <TextInput
              label={t("lbl_meas_waist")}
              type="number"
              inputMode="decimal"
              unit={t("unit_cm")}
              value={formData.meas_waist}
              onChange={(meas_waist) => update({ meas_waist })}
              required
            />
            <TextInput
              label={t("lbl_meas_hips")}
              type="number"
              inputMode="decimal"
              unit={t("unit_cm")}
              value={formData.meas_hips}
              onChange={(meas_hips) => update({ meas_hips })}
              required
            />
            <TextInput
              label={t("lbl_meas_leg")}
              type="number"
              inputMode="decimal"
              unit={t("unit_cm")}
              value={formData.meas_leg}
              onChange={(meas_leg) => update({ meas_leg })}
              required
            />
          </FormGrid>
        </FormSection>
      )}


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
          <TextArea
            label={t("lbl_last_diet_fail")}
            value={formData.last_diet_fail}
            onChange={(last_diet_fail) => update({ last_diet_fail })}
            placeholder={t("ph_last_diet_fail")}
            rows={2}
            optional
          />
          <TextArea
            label={t("lbl_eating_reason")}
            value={formData.eating_reason}
            onChange={(eating_reason) => update({ eating_reason })}
            placeholder={t("ph_eating_reason")}
            rows={2}
            optional
          />
          <Dropzone
            prompt={t("lbl_upload_diet_plan")}
            files={Array.isArray(formData.diet_history_file) ? formData.diet_history_file : (formData.diet_history_file ? [formData.diet_history_file as unknown as File] : [])}
            onFiles={(files) => update({ diet_history_file: files })}
            accept="image/*,application/pdf"
            multiple
            optional
          />
        </FormGrid>
      </FormSection>

    </>
  );
}
