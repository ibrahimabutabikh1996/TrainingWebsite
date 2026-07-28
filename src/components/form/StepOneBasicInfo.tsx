"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { FormGrid, SelectField, TextInput } from "./Fields";
import type { StepProps } from "./types";

const ACTIVITY_OPTIONS = [
  { value: "1", key: "opt_act_1" },
  { value: "2", key: "opt_act_2" },
  { value: "3", key: "opt_act_3" },
  { value: "4", key: "opt_act_4" },
] as const;

export function StepOneBasicInfo({ formData, update }: StepProps) {
  const { t } = useLanguage();

  return (
    <FormGrid>
      <TextInput
        label={t("lbl_fullname")}
        value={formData.fullname}
        onChange={(fullname) => update({ fullname })}
        required
      />

      <TextInput
        label={t("lbl_phone")}
        type="tel"
        inputMode="tel"
        placeholder={t("ph_phone")}
        value={formData.phone}
        onChange={(phone) => update({ phone })}
        required
      />

      {/* Locked: the plan comes from the ?plan= link the member arrived on. */}
      <SelectField
        label={t("lbl_plan")}
        value={formData.plan}
        onChange={(plan) => update({ plan })}
        options={[
          { value: "plan1", label: t("card1_badge") },
          { value: "plan2", label: t("card2_badge") },
          { value: "plan3", label: t("card3_badge") },
        ]}
        required
        disabled
        full
      />

      <SelectField
        label={t("lbl_gender")}
        value={formData.gender}
        onChange={(gender) => update({ gender: gender as "male" | "female" })}
        options={[
          { value: "male", label: t("opt_gender_male") },
          { value: "female", label: t("opt_gender_female") },
        ]}
        required
        noPlaceholder
      />

      <TextInput
        label={t("lbl_age")}
        type="number"
        inputMode="numeric"
        min={10}
        max={100}
        unit={t("unit_year")}
        value={formData.age}
        onChange={(age) => update({ age })}
        required
      />

      <TextInput
        label={t("lbl_weight")}
        type="number"
        inputMode="decimal"
        min={30}
        max={300}
        unit={t("unit_kg")}
        value={formData.weight}
        onChange={(weight) => update({ weight })}
        required
      />

      <TextInput
        label={t("lbl_height")}
        type="number"
        inputMode="numeric"
        min={100}
        max={250}
        unit={t("unit_cm")}
        value={formData.height}
        onChange={(height) => update({ height })}
        required
      />

      <SelectField
        label={t("lbl_activity")}
        value={formData.activity}
        onChange={(activity) => update({ activity })}
        options={ACTIVITY_OPTIONS.map((o) => ({ value: o.value, label: t(o.key) }))}
        required
        full
      />

      <TextInput
        label={t("lbl_residence")}
        value={formData.residence}
        onChange={(residence) => update({ residence })}
        required
      />

      <TextInput
        label={t("lbl_employment")}
        value={formData.employment}
        onChange={(employment) => update({ employment })}
        required
      />
    </FormGrid>
  );
}
