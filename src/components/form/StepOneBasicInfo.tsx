"use client";

import { t } from "@/lib/translations";
import { PLANS_NEEDING_TYPE } from "@/lib/formLabels";
import { planOptions } from "@/lib/planNames";
import { FormGrid, SelectField, TextInput } from "./Fields";
import type { StepProps } from "./types";


const ACTIVITY_OPTIONS = [
  { value: "1", key: "opt_act_1" },
  { value: "2", key: "opt_act_2" },
  { value: "3", key: "opt_act_3" },
  { value: "4", key: "opt_act_4" },
] as const;

export function StepOneBasicInfo({ formData, update, planLocked, planNames }: StepProps) {
  /* Built from the shared list rather than written out, so the selector cannot
     fall behind the set of things a landing-page card can link to — which is
     exactly what happened when the offers were pointed at this form: its three
     cards had no entry here, and someone arriving without `?plan=` could not
     have picked one. The labels are the coach's own, from the content manager. */
  const options = planOptions(planNames);


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

      {/* Locked only when the plan came in on the `?plan=` link the member
          followed from the landing page — that is the normal way in, and the
          choice has already been made by then.

          It used to be locked unconditionally. Reaching /form without a plan —
          a bookmark, a shared link, or just typing the address — then left a
          required field greyed out and empty with no way to fill it: every
          other answer could be given, and the submission was still refused by
          the server, which requires `plan`. A dead end with nothing on screen
          to explain it. */}
      <SelectField
        label={t("lbl_plan")}
        value={formData.plan}
        onChange={(plan) => update({ plan })}
        options={options}
        required
        disabled={planLocked}
        full
      />

      {PLANS_NEEDING_TYPE.has(formData.plan) && (
        <SelectField
          label="نوع الاشتراك المطلوب"
          value={formData.plan_type}
          onChange={(plan_type) => update({ plan_type })}
          options={[
            { value: "both", label: "نظام تدريبي + غذائي" },
            { value: "diet", label: "نظام غذائي فقط" },
            { value: "training", label: "نظام تدريبي فقط" },
          ]}
          required
          noPlaceholder
        />
      )}

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
        inputMode="decimal"
        step="any"
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
        step="any"
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
        inputMode="decimal"
        step="any"
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
