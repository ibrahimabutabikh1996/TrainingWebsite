import React from "react";
import type { JsonRecord } from "@/types";
import {
  answerLabel,
  answerList,
  activityLabel,
  planLabel,
  genderLabel,
  withUnit,
  EMPTY,
} from "@/lib/formLabels";
import { t } from "@/lib/translations";
import { Icon, type IconName } from "@/components/Icon";

interface Props {
  data: JsonRecord;
  measurements?: JsonRecord;
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === EMPTY || value === null || value === undefined || value === "") return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: "0.95rem", color: "var(--text)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg2)", padding: "20px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
        <Icon name={icon} style={{ color: "var(--primary)", fontSize: "22px" }} />
        <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text)", fontWeight: 800 }}>{title}</h3>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
        {children}
      </div>
    </div>
  );
}

export function ComprehensiveDataViewer({ data, measurements = {} }: Props) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg2)", borderRadius: "var(--radius-lg)", border: "1px dashed var(--border)" }}>
        لا توجد بيانات مسجلة لهذا المشترك
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "16px", width: "100%" }}>
      <Section title={t("form_step1_name")} icon="person">
        <DataRow label={t("lbl_fullname")} value={data.fullname as string} />
        <DataRow label={t("lbl_phone")} value={data.phone as string} />
        <DataRow label={t("lbl_plan")} value={planLabel(data.plan)} />
        <DataRow label={t("lbl_gender")} value={genderLabel(data.gender)} />
        <DataRow label={t("lbl_age")} value={withUnit(data.age, t("unit_year"))} />
        <DataRow label={t("lbl_weight")} value={withUnit(measurements.weight || data.weight, t("unit_kg"))} />
        <DataRow label={t("lbl_height")} value={withUnit(measurements.height || data.height, t("unit_cm"))} />
        <DataRow label={t("lbl_activity")} value={activityLabel(data.activity)} />
        <DataRow label={t("lbl_residence")} value={data.residence as string} />
        <DataRow label={t("lbl_employment")} value={data.employment as string} />
      </Section>

      <Section title={t("form_step2_name")} icon="schedule">
        <DataRow label={t("sub_workday_meals") + " - " + t("lbl_meal_breakfast")} value={answerLabel(data.workday_breakfast)} />
        <DataRow label={t("sub_workday_meals") + " - " + t("lbl_meal_lunch")} value={answerLabel(data.workday_lunch)} />
        <DataRow label={t("sub_workday_meals") + " - " + t("lbl_meal_dinner")} value={answerLabel(data.workday_dinner)} />
        <DataRow label={t("sub_holiday_meals") + " - " + t("lbl_meal_breakfast")} value={answerLabel(data.holiday_breakfast)} />
        <DataRow label={t("sub_holiday_meals") + " - " + t("lbl_meal_lunch")} value={answerLabel(data.holiday_lunch)} />
        <DataRow label={t("sub_holiday_meals") + " - " + t("lbl_meal_dinner")} value={answerLabel(data.holiday_dinner)} />
        <DataRow label={t("lbl_workout_exp")} value={answerLabel(data.workout_exp)} />
        <DataRow label={t("lbl_workout_type_exp")} value={answerList(data.workout_type_exp)} />
        <DataRow label={t("lbl_workout_type_other_desc")} value={data.workout_type_other_desc as string} />
        <DataRow label={t("lbl_workout_commit")} value={answerLabel(data.workout_commit)} />
        <DataRow label={t("lbl_workout_days")} value={answerLabel(data.workout_days)} />
        <DataRow label={t("lbl_gym_time")} value={answerLabel(data.gym_time)} />
      </Section>

      <Section title={t("form_step3_name")} icon="restaurant_menu">
        <DataRow label={t("lbl_sub_goal")} value={answerLabel(data.sub_goal)} />
        <DataRow label={t("lbl_target_weight")} value={withUnit(data.target_weight, t("unit_kg"))} />
        <DataRow label={t("lbl_allergies")} value={data.allergies as string} />
        <DataRow label={t("lbl_fav_foods")} value={data.fav_foods as string} />
        <DataRow label={t("lbl_coffee_rate")} value={answerLabel(data.coffee_rate)} />
        <DataRow label={t("lbl_coffee_type")} value={data.coffee_type as string} />
        <DataRow label={t("lbl_meat")} value={answerLabel(data.meat)} />
        <DataRow label={t("lbl_buy_supp")} value={answerLabel(data.buy_supp)} />
      </Section>

      <Section title={t("form_step4_name")} icon="medical_services">
        <DataRow label={t("lbl_injuries")} value={data.injuries as string} />
        <DataRow label={t("lbl_meas_arm")} value={withUnit(measurements.meas_arm || data.meas_arm, t("unit_cm"))} />
        <DataRow label={t("lbl_meas_waist")} value={withUnit(measurements.meas_waist || data.meas_waist, t("unit_cm"))} />
        <DataRow label={t("lbl_meas_hips")} value={withUnit(measurements.meas_hips || data.meas_hips, t("unit_cm"))} />
        <DataRow label={t("lbl_meas_leg")} value={withUnit(measurements.meas_leg || data.meas_leg, t("unit_cm"))} />
        <DataRow label={t("lbl_supplements_list")} value={data.supplements_list as string} />
        <DataRow label={t("lbl_diet_history")} value={data.diet_history as string} />
        <DataRow label={t("lbl_last_diet_fail")} value={data.last_diet_fail as string} />
        <DataRow label={t("lbl_eating_reason")} value={data.eating_reason as string} />
      </Section>
    </div>
  );
}
