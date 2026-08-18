/* Form answers are persisted as translation KEYS ("opt_goal_fitness",
   "chk_exp_weights"), never as display text — see src/components/form/*.
   Anything that renders a stored profile therefore has to resolve them back,
   otherwise the raw key leaks onto the screen. */

import { translations, type TranslationKey } from "@/lib/translations";

const dict = translations as Record<string, string>;

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
  return dict[key] ?? key;
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
   numeric answers if it went through the generic lookup.

   Exported because the trainee's own dashboard needs the mapping itself rather
   than the formatted label: it maps the stored value to a dictionary key here,
   then resolves that key through `t()`. */
export const ACTIVITY_KEYS: Record<string, string> = {
  "1": "opt_act_1",
  "2": "opt_act_2",
  "3": "opt_act_3",
  "4": "opt_act_4",
};

export function activityLabel(value: unknown, fallback: string = EMPTY): string {
  if (isBlank(value)) return fallback;
  const key = ACTIVITY_KEYS[String(value)];
  return key ? dict[key] : answerLabel(value, fallback);
}

/* The plan comes from the ?plan= link on the landing page, and its display
   name lives under the pricing-card badge keys. Exported for the same reason as
   ACTIVITY_KEYS above.
 *
 * `offer1..3` are the three cards in the offers section. They reach the form by
 * the same route as the plans — a card links to `/form?plan=…` with the choice
 * already locked — but they are separate products with their own names, so they
 * are recorded as themselves. Pointing an offer at `plan1` would have filed the
 * subscriber under a plan they did not buy, in the CRM, in the sign-up
 * notification and in their own profile.
 *
 * Typed as translation keys rather than plain strings, so the form can pass
 * these straight to `t()` and a key missing from the dictionary is a build
 * error here rather than the literal text "off_card1_badge" in a dropdown. */
export const PLAN_KEYS: Record<string, TranslationKey> = {
  plan1: "card1_badge",
  plan2: "card2_badge",
  plan3: "card3_badge",
  offer1: "off_card1_badge",
  offer2: "off_card2_badge",
  offer3: "off_card3_badge",
};

/** Every value `plan` may hold, in the order they are offered. */
export const PLAN_VALUES = Object.keys(PLAN_KEYS);

/* Which of the three colour scales a plan is painted in — `--plan-1` and its
   pair of tokens, and so on.
 *
 * Here rather than as an `if` chain in each of the places that paints one. The
 * CRM tag and the subscription timeline each carried their own copy, and a copy
 * per screen is how a fourth value ends up coloured correctly in one place and
 * falling through to the default in another. An offer shares the scale of the
 * plan in its own position, so the section reads as one family. */
export const PLAN_COLOUR_SLOT: Record<string, 1 | 2 | 3> = {
  plan1: 1,
  plan2: 2,
  plan3: 3,
  offer1: 1,
  offer2: 2,
  offer3: 3,
};

/* The products whose price depends on a second choice, so the form asks for
   `plan_type` and the server insists on it.
 *
 * `offer1` belongs here for the same reason `plan1` does: its card quotes three
 * prices — the combined programme, diet only, training only — which are the
 * three `plan_type` options. The other four quote one price and ask nothing
 * further. */
export const PLANS_NEEDING_TYPE = new Set(["plan1", "offer1"]);

export function planLabel(value: unknown, fallback: string = EMPTY): string {
  if (isBlank(value)) return fallback;
  const key = PLAN_KEYS[String(value)];
  return key ? dict[key] : answerLabel(value, fallback);
}

export function genderLabel(value: unknown, fallback: string = EMPTY): string {
  if (value === "male") return dict.opt_gender_male;
  if (value === "female") return dict.opt_gender_female;
  return fallback;
}

/** Appends a unit only when there is actually a value to qualify. */
export function withUnit(value: unknown, unit: string, fallback: string = EMPTY): string {
  return isBlank(value) ? fallback : `${value} ${unit}`;
}
