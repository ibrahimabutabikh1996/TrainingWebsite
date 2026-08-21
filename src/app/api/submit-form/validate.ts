/* Shape check for the intake payload.
   profiles.data is a jsonb blob, so a renamed or misspelled field is accepted
   silently and only shows up much later as an empty cell in the admin UI —
   which is exactly how the meal-time fields (`workday_breakfast` read as
   `meal_work_bf`) sat broken without anything failing. Validating at the write
   boundary makes that class of mistake loud and immediate. */

import { PLANS_NEEDING_TYPE } from "@/lib/formLabels";

/** Every key the form is allowed to submit. */
const ALLOWED_KEYS = [
  // step 1
  "fullname", "phone", "plan", "plan_type", "gender", "age", "weight", "height",
  "activity", "residence", "employment",
  // step 2
  "workday_breakfast", "workday_lunch", "workday_dinner",
  "holiday_breakfast", "holiday_lunch", "holiday_dinner",
  "workout_exp", "workout_type_exp", "workout_type_other_desc",
  "workout_commit", "workout_days", "gym_time", "home_equipment_photo",
  // step 3
  "sub_goal", "target_weight", "allergies", "fav_foods",
  "coffee_rate", "coffee_type", "meat", "buy_supp",
  // step 4 (file fields arrive separately as multipart entries)
  "injuries", "meas_arm", "meas_waist", "meas_hips", "meas_leg",
  "supplements_list", "diet_history", "last_diet_fail", "eating_reason",
  "analysis_file", "body_photos", "supplements_photo", "diet_history_file",
  // step 0
  "payment_receipt",
  "username", "password",
] as const;

/** Must be present and non-empty — these mirror the form's `required` fields. */
const REQUIRED_KEYS = [
  "fullname", "phone", "plan", "gender", "age", "weight", "height",
  "activity", "residence", "employment",
  "workout_exp", "workout_type_exp", "workout_commit", "workout_days",
  "sub_goal", "target_weight", "allergies", "fav_foods", "coffee_rate", "buy_supp",
  "injuries",
] as const;

/** Numeric answers are stored as strings; check they at least parse. */
const NUMERIC_KEYS: Record<string, { min: number; max: number }> = {
  age: { min: 10, max: 100 },
  weight: { min: 30, max: 300 },
  height: { min: 100, max: 250 },
  target_weight: { min: 30, max: 300 },
};

/* How long any one answer may be.
 *
 * There was no ceiling of any kind: `profiles.data` is a jsonb column and the
 * route wrote whatever arrived, so a single submission could carry megabytes of
 * text in `diet_history` or `allergies` and the only limit was the platform's
 * body size. Nothing here is meant to be an essay — the longest of them are a
 * few sentences about an injury or a past diet — and the admin panel renders
 * them into table cells.
 *
 * Generous on purpose: the point is a ceiling, not a word count, and a rejected
 * genuine answer is worse than a long one. Counted in code units, which for
 * Arabic is close enough to characters for a bound this loose. */
const MAX_ANSWER_LENGTH = 2_000;

/** Free-text fields where someone may legitimately keep writing. */
const LONG_ANSWER_KEYS = new Set([
  "injuries", "allergies", "fav_foods", "supplements_list",
  "diet_history", "last_diet_fail", "eating_reason", "workout_type_other_desc",
]);

/** Everything else is a name, a choice or a short phrase. */
const MAX_SHORT_ANSWER_LENGTH = 200;

/* Credentials. The account these create is the trainee's only way back in, and
   the row lives in `accounts.username`, which is unique — so a name has to be
   something a person can be told over the phone and type again.
   Imported rather than restated: /api/admin/create-account makes accounts too,
   and the two rules must not drift apart. */
import {
  isReservedUsername,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  USERNAME_PATTERN,
} from "@/lib/auth";

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
    if (
      v === undefined || 
      v === null || 
      (typeof v === "string" && v.trim() === "") ||
      (Array.isArray(v) && v.length === 0)
    ) {
      errors.push(`missing required field: ${key}`);
    }
  }

  /* Not `data.plan === "plan1"` any more. The offers section links into this
     form the same way the plans do, and the first offer quotes three prices —
     combined, diet only, training only — which are the three `plan_type`
     options. It has to be asked the same follow-up question, and refused the
     same way when it arrives without an answer. The set is shared with the form
     so the two cannot disagree about which products need it. */
  if (PLANS_NEEDING_TYPE.has(String(data.plan))) {
    const v = data.plan_type;
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
      errors.push("missing required field: plan_type");
    }
  }

  if (data.coffee_rate && data.coffee_rate !== "opt_coffee_0") {
    const v = data.coffee_type;
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
      errors.push("missing required field: coffee_type");
    }
  }

  if (data.gender !== undefined && data.gender !== "male" && data.gender !== "female") {
    errors.push(`gender must be "male" or "female"`);
  }

  /* Females submit measurements in place of body photos (which the route
     requires for males), so they carry the same weight as a required field. */
  if (data.gender === "female") {
    for (const key of ["meas_arm", "meas_waist", "meas_hips", "meas_leg"]) {
      const v = data[key];
      if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
        errors.push(`missing required field: ${key}`);
      }
    }
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

  /* Length, on every string that arrives — including the entries of the one
     array field, since `workout_type_exp` is a list of strings and an unbounded
     list of unbounded strings is the same problem wearing a hat. */
  const checkLength = (key: string, value: unknown, label = key) => {
    if (typeof value !== "string") return;
    const max = LONG_ANSWER_KEYS.has(key) ? MAX_ANSWER_LENGTH : MAX_SHORT_ANSWER_LENGTH;
    if (value.length > max) {
      errors.push(`${label} is too long (${value.length} > ${max})`);
    }
  };

  for (const [key, value] of Object.entries(data)) {
    if (key === "username" || key === "password") continue;
    if (Array.isArray(value)) {
      if (value.length > 50) errors.push(`${key} has too many entries (${value.length} > 50)`);
      value.slice(0, 50).forEach((entry, i) => checkLength(key, entry, `${key}[${i}]`));
      continue;
    }
    checkLength(key, value);
  }

  /* Credentials are optional — the form has always allowed a submission with no
     account attached — but if one is being created it has to be usable. There is
     no length or shape check anywhere on the client, so this is the only one. */
  const username = data.username;
  const password = data.password;

  if (typeof username === "string" && username !== "") {
    if (!USERNAME_PATTERN.test(username)) {
      errors.push("username must be 3-32 characters of letters, digits, dot, underscore or hyphen");
    }
    /* This form is open to the public and lets the visitor name their own
       account. `isAdminUsername` reads that same name to decide whether a
       session may open the coach's panel, so a reserved name claimed here would
       be a privilege escalation, not a naming collision. Refused server-side —
       the browser is never asked. */
    if (isReservedUsername(username)) {
      errors.push("username is reserved");
    }
    if (typeof password !== "string" || password === "") {
      errors.push("password is required when a username is given");
    }
  }

  if (typeof password === "string" && password !== "") {
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.push(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    /* bcrypt truncates at 72 bytes; the cap is well above that and exists so a
       megabyte "password" cannot be handed to the hashing round. */
    if (password.length > MAX_PASSWORD_LENGTH) {
      errors.push(`password must be at most ${MAX_PASSWORD_LENGTH} characters`);
    }
    if (typeof username !== "string" || username === "") {
      errors.push("username is required when a password is given");
    }
  }

  return { ok: errors.length === 0, errors };
}
