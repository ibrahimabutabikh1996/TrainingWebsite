/* Form answers are persisted as translation KEYS ("opt_goal_fitness",
   "chk_exp_weights"), never as display text — see src/components/form/*.
   Anything that renders a stored profile therefore has to resolve them back,
   otherwise the raw key leaks onto the screen.

   The admin panel is Arabic-only, so this reads the `ar` dictionary directly
   rather than going through the LanguageContext (these are server components). */

import { translations } from "@/lib/translations";

const ar = translations.ar as Record<string, string>;

export const EMPTY = "--";

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * Resolve a single stored answer. Values that aren't known keys (free text
 * such as residence or a typed coffee brand) pass through untouched.
 */
export function answerLabel(value: unknown, fallback: string = EMPTY): string {
  if (isBlank(value)) return fallback;
  const key = String(value);
  return ar[key] ?? key;
}

/** Multi-select answers (workout_type_exp) arrive as an array of keys. */
export function answerList(value: unknown, fallback: string = EMPTY): string {
  if (Array.isArray(value)) {
    const parts = value.map((v) => answerLabel(v, "")).filter(Boolean);
    return parts.length ? parts.join("، ") : fallback;
  }
  return answerLabel(value, fallback);
}

/* Activity is stored as a bare "1".."4", which would collide with other
   numeric answers if it went through the generic lookup. */
const ACTIVITY_KEYS: Record<string, string> = {
  "1": "opt_act_1",
  "2": "opt_act_2",
  "3": "opt_act_3",
  "4": "opt_act_4",
};

export function activityLabel(value: unknown, fallback: string = EMPTY): string {
  if (isBlank(value)) return fallback;
  const key = ACTIVITY_KEYS[String(value)];
  return key ? ar[key] : answerLabel(value, fallback);
}

/* The plan comes from the ?plan= link on the landing page, and its display
   name lives under the pricing-card badge keys. */
const PLAN_KEYS: Record<string, string> = {
  plan1: "card1_badge",
  plan2: "card2_badge",
  plan3: "card3_badge",
};

export function planLabel(value: unknown, fallback: string = EMPTY): string {
  if (isBlank(value)) return fallback;
  const key = PLAN_KEYS[String(value)];
  return key ? ar[key] : answerLabel(value, fallback);
}

export function genderLabel(value: unknown, fallback: string = EMPTY): string {
  if (value === "male") return ar.opt_gender_male;
  if (value === "female") return ar.opt_gender_female;
  return fallback;
}

/** Appends a unit only when there is actually a value to qualify. */
export function withUnit(value: unknown, unit: string, fallback: string = EMPTY): string {
  return isBlank(value) ? fallback : `${value} ${unit}`;
}
