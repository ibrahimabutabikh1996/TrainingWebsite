import type { JsonRecord } from "@/types";
import {
  activityLabel,
  answerLabel,
  answerList,
  genderLabel,
  withUnit,
  EMPTY,
} from "@/lib/formLabels";
import { planNameFrom, type PlanNames } from "@/lib/planNames";
import { t } from "@/lib/translations";

/* One definition of "a month", and one table of what the intake form asks.
 *
 * Both existed twice before, and the two copies disagreed.
 *
 * The months did so measurably. The admin timeline invented them from the
 * calendar — `floor(daysSinceRegistration / 30) + 1` — while the details tabs
 * counted the renewals that had actually happened. A trainee who registered
 * ninety days ago and renewed once was four months old in one panel and two in
 * the other, on the same screen. Renewal is an event: somebody submits the form
 * and pays. Elapsed time is not that event, so it is not what a month is here.
 *
 * The field table was duplicated three ways — the details tabs, the trainee's
 * own dashboard, and a viewer nothing imported. This is the one that survives,
 * and it carries the labels and the formatters together so a field cannot be
 * shown with the right label and the wrong formatting in one place only.
 */

export interface SubscriptionMonth {
  /** 1-based, and the same number the coach sees. */
  monthNumber: number;
  label: string;
  /** ISO. Month 1 opens at activation; later months open at their renewal. */
  startDate: string | null;
  /** ISO, or null for the month still running. */
  endDate: string | null;
  isCurrent: boolean;
  /** The answers as they stood during that month. */
  data: JsonRecord;
}

interface RenewalRecord {
  date?: string;
  label?: string;
}

interface HistoryEntry {
  label?: string;
  date?: string;
  data?: JsonRecord;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function monthLabel(n: number): string {
  const names = [
    "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس",
    "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر",
  ];
  return n <= names.length ? `الشهر ${names[n - 1]}` : `الشهر رقم ${n}`;
}

/**
 * The months this subscription has actually had, oldest first.
 *
 * `history` holds one snapshot per completed month and `renewals` one record
 * per renewal; they are written together by /api/submit-form, so entry `i` of
 * one lines up with entry `i` of the other. A snapshot's `date` is the moment
 * the renewal was submitted — the end of the month it belongs to, and the start
 * of the next.
 *
 * A profile that has never renewed has no history and no renewals, and comes
 * back as a single current month. That is the common case and it is not a
 * special case here.
 */
export function buildSubscriptionMonths(
  data: JsonRecord,
  createdAt?: string | Date | null,
): SubscriptionMonth[] {
  const history = asArray<HistoryEntry>(data.history);
  const renewals = asArray<RenewalRecord>(data.renewals);

  const created =
    createdAt instanceof Date ? createdAt.toISOString() : createdAt || null;
  const firstStart =
    (typeof data.activation_date === "string" && data.activation_date) || created;

  const months: SubscriptionMonth[] = [];

  for (let i = 0; i < history.length; i++) {
    const entry = history[i] || {};
    months.push({
      monthNumber: i + 1,
      label: entry.label || monthLabel(i + 1),
      /* Month 1 opens at activation. Every later month opens where the renewal
         that created it was submitted, which is the previous month's close. */
      startDate: i === 0 ? firstStart : history[i - 1]?.date || renewals[i - 1]?.date || null,
      endDate: entry.date || null,
      isCurrent: false,
      data: entry.data || {},
    });
  }

  const currentNumber = history.length + 1;
  months.push({
    monthNumber: currentNumber,
    label: monthLabel(currentNumber),
    startDate:
      history.length === 0
        ? firstStart
        : history[history.length - 1]?.date || renewals[renewals.length - 1]?.date || null,
    endDate: null,
    isCurrent: true,
    /* The live blob, minus the archive it carries — a month is not inside
       itself. */
    data: currentMonthData(data),
  });

  return months;
}

/** The current answers without the bookkeeping that is not an answer. */
export function currentMonthData(data: JsonRecord): JsonRecord {
  const clean: JsonRecord = { ...data };
  for (const key of NON_ANSWER_KEYS) delete clean[key];
  return clean;
}

/* Written by the app around the answers, never by the person filling the form.
 * Excluded from snapshots and from every comparison: `weightLogs` in particular
 * grows for the life of the subscription, and copying it into each month's
 * archive is what made the stored blob grow with the square of the months. */
export const NON_ANSWER_KEYS = [
  "history",
  "renewals",
  "weightLogs",
  /* Written when the coach activates the account, not by the questionnaire, and
     it belongs to the subscription rather than to any one month of it — every
     reader takes it off the top-level blob. It was missing from this list, so
     each month's archive kept a copy of a date nothing would ever read there. */
  "activation_date",
  "deleted_months",
  "delete_all_history",
  "is_renewal",
  "is_new",
  "is_suspended",
  /* The pending-renewal flags, written by /api/submit-form and cleared by
     /api/admin/renew-account. Bookkeeping like the three above, so a month's
     archive must not carry a copy — a snapshot that kept `renewal_pending`
     would show a past month as still awaiting review forever. */
  "renewal_pending",
  "renewal_requested_at",
  "renewal_requested_month",
] as const;

/**
 * The bookkeeping a renewal must carry from the old blob into the new one.
 *
 * A renewal rewrites `profiles.data` from the answers just submitted, so
 * anything the app had written around those answers is gone unless it is named
 * here. `history` and `renewals` are not on this list because the renewal
 * branch computes them — it appends to both — while these four are carried
 * across untouched.
 *
 * The cost of each omission, which is how this list was arrived at:
 *
 *   weightLogs          every weigh-in the trainee ever recorded
 *   activation_date     where month one starts on both timelines
 *   deleted_months      which months the coach chose to hide
 *   delete_all_history  whether the whole history is hidden
 */
export const RENEWAL_CARRIED_KEYS = [
  "weightLogs",
  "activation_date",
  "deleted_months",
  "delete_all_history",
] as const;

/**
 * The new month's blob with the accumulated bookkeeping restored onto it.
 *
 * `previous` must be the stored row and `answers` the submission. The direction
 * is the whole security of this function: a value present in `previous` always
 * wins, and one that is absent there is removed from the result rather than
 * left standing. So a submitter who found a way to put `weightLogs` or
 * `activation_date` into their payload — the intake validator refuses unknown
 * fields, so they cannot today — still could not write their own weigh-in
 * history or move the date their subscription is measured from.
 *
 * A named list rather than a spread of `previous`, for the same reason
 * `currentMonthData` has one: copying the old blob wholesale is what made the
 * stored row grow with the square of the months.
 */
export function withCarriedFields(
  answers: JsonRecord,
  previous: JsonRecord,
): JsonRecord {
  const result: JsonRecord = { ...answers };
  for (const key of RENEWAL_CARRIED_KEYS) {
    if (previous[key] !== undefined) result[key] = previous[key];
    else delete result[key];
  }
  return result;
}

/* ---------------------------------------------------------------- fields -- */

export interface FieldContext {
  planNames: PlanNames;
}

/** The headings a month's card is divided into, in the order they appear. */
export const FIELD_GROUPS = [
  { id: "basics", title: "المعلومات الأساسية", icon: "person" },
  { id: "body", title: "المؤشرات البدنية والقياسات", icon: "monitor_weight" },
  { id: "training", title: "التدريب والخبرة", icon: "fitness_center" },
  { id: "nutrition", title: "التغذية ونمط الحياة", icon: "restaurant" },
  { id: "health", title: "الصحة والتاريخ الغذائي", icon: "medical_services" },
] as const;

export type FieldGroupId = (typeof FIELD_GROUPS)[number]["id"];

export interface IntakeField {
  key: string;
  label: string;
  /** Reads the whole record, because a few answers are a pair of columns. */
  format: (data: JsonRecord, ctx: FieldContext) => string;
  group: FieldGroupId;
}

const text = (key: string) => (d: JsonRecord) =>
  d[key] === null || d[key] === undefined || d[key] === "" ? EMPTY : String(d[key]);
const answer = (key: string) => (d: JsonRecord) => answerLabel(d[key]);
const list = (key: string) => (d: JsonRecord) => answerList(d[key]);
const unit = (key: string, u: string) => (d: JsonRecord) => withUnit(d[key], u);

/**
 * Every answer the intake form stores, with the label, the formatter and the
 * heading that belong to it.
 *
 * Ordering inside a group is the order of the form itself, so a month's card
 * reads the way the questionnaire does.
 */
export const INTAKE_FIELDS: IntakeField[] = [
  { key: "fullname", label: t("lbl_fullname"), format: text("fullname"), group: "basics" },
  { key: "phone", label: t("lbl_phone"), format: (d) => text("phone")(d.phone ? d : { phone: d.mobile }), group: "basics" },
  { key: "gender", label: t("lbl_gender"), format: (d) => genderLabel(d.gender), group: "basics" },
  { key: "age", label: t("lbl_age"), format: unit("age", t("unit_year")), group: "basics" },
  { key: "residence", label: t("lbl_residence"), format: text("residence"), group: "basics" },
  { key: "employment", label: t("lbl_employment"), format: text("employment"), group: "basics" },
  { key: "plan", label: t("lbl_plan"), format: (d, c) => planNameFrom(c.planNames, d.plan, EMPTY), group: "basics" },
  { key: "activity", label: t("lbl_activity"), format: (d) => activityLabel(d.activity), group: "basics" },

  { key: "height", label: t("lbl_height"), format: unit("height", t("unit_cm")), group: "body" },
  { key: "weight", label: t("lbl_weight"), format: unit("weight", t("unit_kg")), group: "body" },
  { key: "target_weight", label: t("lbl_target_weight"), format: unit("target_weight", t("unit_kg")), group: "body" },
  { key: "sub_goal", label: t("lbl_sub_goal"), format: answer("sub_goal"), group: "body" },
  { key: "meas_arm", label: t("lbl_meas_arm"), format: unit("meas_arm", t("unit_cm")), group: "body" },
  { key: "meas_waist", label: t("lbl_meas_waist"), format: unit("meas_waist", t("unit_cm")), group: "body" },
  { key: "meas_hips", label: t("lbl_meas_hips"), format: unit("meas_hips", t("unit_cm")), group: "body" },
  { key: "meas_leg", label: t("lbl_meas_leg"), format: unit("meas_leg", t("unit_cm")), group: "body" },

  { key: "workout_exp", label: t("lbl_workout_exp"), format: answer("workout_exp"), group: "training" },
  { key: "workout_type_exp", label: t("lbl_workout_type_exp"), format: list("workout_type_exp"), group: "training" },
  { key: "workout_type_other_desc", label: t("lbl_workout_type_other_desc"), format: text("workout_type_other_desc"), group: "training" },
  { key: "workout_commit", label: t("lbl_workout_commit"), format: answer("workout_commit"), group: "training" },
  { key: "workout_days", label: t("lbl_workout_days"), format: answer("workout_days"), group: "training" },
  { key: "gym_time", label: t("lbl_gym_time"), format: answer("gym_time"), group: "training" },

  { key: "workday_breakfast", label: `${t("sub_workday_meals")} — ${t("lbl_meal_breakfast")}`, format: answer("workday_breakfast"), group: "nutrition" },
  { key: "workday_lunch", label: `${t("sub_workday_meals")} — ${t("lbl_meal_lunch")}`, format: answer("workday_lunch"), group: "nutrition" },
  { key: "workday_dinner", label: `${t("sub_workday_meals")} — ${t("lbl_meal_dinner")}`, format: answer("workday_dinner"), group: "nutrition" },
  { key: "holiday_breakfast", label: `${t("sub_holiday_meals")} — ${t("lbl_meal_breakfast")}`, format: answer("holiday_breakfast"), group: "nutrition" },
  { key: "holiday_lunch", label: `${t("sub_holiday_meals")} — ${t("lbl_meal_lunch")}`, format: answer("holiday_lunch"), group: "nutrition" },
  { key: "holiday_dinner", label: `${t("sub_holiday_meals")} — ${t("lbl_meal_dinner")}`, format: answer("holiday_dinner"), group: "nutrition" },
  { key: "allergies", label: t("lbl_allergies"), format: text("allergies"), group: "nutrition" },
  { key: "fav_foods", label: t("lbl_fav_foods"), format: text("fav_foods"), group: "nutrition" },
  { key: "meat", label: t("lbl_meat"), format: list("meat"), group: "nutrition" },
  { key: "coffee_rate", label: t("lbl_coffee_rate"), format: answer("coffee_rate"), group: "nutrition" },
  { key: "coffee_type", label: t("lbl_coffee_type"), format: text("coffee_type"), group: "nutrition" },

  { key: "injuries", label: t("lbl_injuries"), format: text("injuries"), group: "health" },
  { key: "buy_supp", label: t("lbl_buy_supp"), format: answer("buy_supp"), group: "health" },
  { key: "supplements_list", label: t("lbl_supplements_list"), format: text("supplements_list"), group: "health" },
  { key: "diet_history", label: t("lbl_diet_history"), format: text("diet_history"), group: "health" },
  { key: "last_diet_fail", label: t("lbl_last_diet_fail"), format: text("last_diet_fail"), group: "health" },
  { key: "eating_reason", label: t("lbl_eating_reason"), format: text("eating_reason"), group: "health" },
];

export interface FieldValue {
  key: string;
  label: string;
  value: string;
}

export interface FieldGroup {
  id: FieldGroupId;
  title: string;
  icon: string;
  fields: FieldValue[];
}

const has = (v: string) => v !== EMPTY && v !== "";

/**
 * One month's answers, grouped under the form's own headings.
 *
 * Every month is read on its own: what it holds is what the trainee submitted
 * for it, with no reference to the month before. An answer the trainee left
 * blank is dropped rather than printed as a dash, and a group whose answers
 * were all blank does not appear at all — a month is shown at the length of
 * what it actually contains.
 */
export function monthGroups(
  month: SubscriptionMonth,
  ctx: FieldContext,
): FieldGroup[] {
  return FIELD_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    icon: group.icon,
    fields: INTAKE_FIELDS.filter((f) => f.group === group.id)
      .map((f) => ({ key: f.key, label: f.label, value: f.format(month.data, ctx) }))
      .filter((f) => has(f.value)),
  })).filter((group) => group.fields.length > 0);
}

/** How many answers a month actually carries, for its collapsed heading. */
export function answeredCount(groups: FieldGroup[]): number {
  return groups.reduce((n, g) => n + g.fields.length, 0);
}

/** The headline number on a month's collapsed row. */
export function monthWeight(
  month: SubscriptionMonth,
  ctx: FieldContext,
): string | null {
  const field = INTAKE_FIELDS.find((f) => f.key === "weight");
  if (!field) return null;
  const value = field.format(month.data, ctx);
  return has(value) ? value : null;
}
