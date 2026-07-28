/* Shape check for the intake payload.
   profiles.data is a jsonb blob, so a renamed or misspelled field is accepted
   silently and only shows up much later as an empty cell in the admin UI —
   which is exactly how the meal-time fields (`workday_breakfast` read as
   `meal_work_bf`) sat broken without anything failing. Validating at the write
   boundary makes that class of mistake loud and immediate. */

/** Every key the form is allowed to submit. */
const ALLOWED_KEYS = [
  // step 1
  "fullname", "phone", "plan", "gender", "age", "weight", "height",
  "activity", "residence", "employment",
  // step 2
  "workday_breakfast", "workday_lunch", "workday_dinner",
  "holiday_breakfast", "holiday_lunch", "holiday_dinner",
  "workout_exp", "workout_type_exp", "workout_type_other_desc",
  "workout_commit", "workout_days", "gym_time",
  // step 3
  "sub_goal", "target_weight", "allergies", "fav_foods",
  "coffee_rate", "coffee_type", "meat", "buy_supp",
  // step 4 (file fields arrive separately as multipart entries)
  "injuries", "meas_arm", "meas_waist", "meas_hips", "meas_leg",
  "supplements_list", "diet_history",
  "analysis_file", "body_photos", "supplements_photo", "diet_history_file",
] as const;

/** Must be present and non-empty — these mirror the form's `required` fields. */
const REQUIRED_KEYS = [
  "fullname", "phone", "plan", "gender", "age", "weight", "height",
  "activity", "residence", "employment",
  "workday_breakfast", "workday_lunch", "workday_dinner",
  "holiday_breakfast", "holiday_lunch", "holiday_dinner",
  "workout_exp", "workout_commit", "workout_days",
  "sub_goal", "target_weight", "meat", "coffee_rate", "buy_supp",
] as const;

/** Numeric answers are stored as strings; check they at least parse. */
const NUMERIC_KEYS: Record<string, { min: number; max: number }> = {
  age: { min: 10, max: 100 },
  weight: { min: 30, max: 300 },
  height: { min: 100, max: 250 },
  target_weight: { min: 30, max: 300 },
};

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateSubmission(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["payload must be a JSON object"] };
  }
  const data = input as Record<string, unknown>;

  /* Unknown keys are the signal that the client and server drifted apart. */
  const allowed = new Set<string>(ALLOWED_KEYS);
  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) errors.push(`unknown field: ${key}`);
  }

  for (const key of REQUIRED_KEYS) {
    const v = data[key];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
      errors.push(`missing required field: ${key}`);
    }
  }

  if (data.gender !== undefined && data.gender !== "male" && data.gender !== "female") {
    errors.push(`gender must be "male" or "female"`);
  }

  if (data.workout_type_exp !== undefined && !Array.isArray(data.workout_type_exp)) {
    errors.push("workout_type_exp must be an array");
  }

  for (const [key, range] of Object.entries(NUMERIC_KEYS)) {
    const raw = data[key];
    if (raw === undefined || raw === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      errors.push(`${key} must be numeric, got ${JSON.stringify(raw)}`);
    } else if (n < range.min || n > range.max) {
      errors.push(`${key} out of range (${range.min}-${range.max}): ${n}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
