import type { JsonRecord } from "@/types";
import { translations } from "@/lib/translations";
import { PLAN_KEYS } from "@/lib/formLabels";

/* What each plan and offer is called, taken from the content manager.
 *
 * There were two copies of these six names. The card on the landing page reads
 * the coach's own copy out of `site_settings`, editable in the panel; the
 * intake form, the WhatsApp message it composes and the coach's sign-up email
 * all read a fixed copy in `translations.ts`. Renaming a package in the panel
 * changed the first and left the other three saying the old name — and, for the
 * offers, the two had never been checked against each other at all.
 *
 * The panel is the single source now. The dictionary is the fallback and
 * nothing more: it answers for a database with no content row yet, and for a
 * field the coach has left empty.
 *
 * The key a plan is stored under is the same in both places — `plan3` is
 * `card3_badge` whether that is a translation key or a column in the content
 * blob — so `PLAN_KEYS` serves for both and there is no second mapping to keep
 * in step.
 */

export type PlanNames = Record<string, string>;

/* Names the panel still has stored, and what they are shown as.
 *
 * The three plans were renamed at some point without the stored row being
 * rewritten, so `site_settings` holds "متابعة شهرية" to this day and the landing
 * page has been translating it on the way to the screen ever since.
 *
 * That translation used to live as a local function inside LandingClient, which
 * was fine while the landing page was the only thing reading those fields. It is
 * not any more: the form, the WhatsApp message, the subscriber list and the PDF
 * export all read them now, and every one of them would have shown the coach
 * "متابعة شهرية" while the card beside it said "خطة ذاتية التوجيه". One table,
 * imported by both.
 *
 * Delete an entry once the stored row is corrected — this is a migration that
 * never happened, not a permanent mapping. */
const LEGACY_NAMES: Record<string, string> = {
  "متابعة شهرية": "خطة ذاتية التوجيه",
  "خطط ذاتية التوجيه": "خطة ذاتية التوجيه",
  /* "الأسبوعية", with the hamza. The rule this replaces wrote "الاسبوعية"
     without one, and since the stored row still holds the legacy value, that
     spelling was what the card on the landing page actually showed — while the
     panel's own default, the dictionary and every other mention in the project
     spell it with the hamza. A one-character typo in a table nothing else read.
     (`scripts/strip_hamzas.ts` is unrelated: it normalises exercise names.) */
  "متابعة اسبوعية": "خطة المتابعة الأسبوعية",
  "متابعة يومية": "خطة المتابعة اليومية",
};

/** One stored value, as it should be shown. Anything unrecognised passes through. */
export function normalizeLegacyName(value: string): string {
  return LEGACY_NAMES[value] ?? value;
}

/** The names with no content row behind them — a fresh install. */
export const DEFAULT_PLAN_NAMES: PlanNames = Object.fromEntries(
  Object.entries(PLAN_KEYS).map(([plan, key]) => [
    plan,
    (translations as Record<string, string>)[key] ?? plan,
  ]),
);

/**
 * The coach's names, with the dictionary showing through wherever they have not
 * written one.
 *
 * A field that exists but holds only spaces counts as not written: the panel
 * stores exactly what was typed, and a name of `"   "` on a card is a blank
 * where a package should be.
 */
export function resolvePlanNames(content: JsonRecord | null | undefined): PlanNames {
  if (!content) return { ...DEFAULT_PLAN_NAMES };

  const names: PlanNames = { ...DEFAULT_PLAN_NAMES };
  for (const [plan, key] of Object.entries(PLAN_KEYS)) {
    const written = content[key];
    if (typeof written === "string" && written.trim() !== "") {
      /* Through the same rewrite the card goes through, or the form would name
         a package differently from the button the person just clicked. */
      names[plan] = normalizeLegacyName(written.trim());
    }
  }
  return names;
}

/**
 * One name, resolved. Anything this does not know — a plan value from an older
 * row, or a typo — comes back as `fallback` rather than as the raw key.
 */
export function planNameFrom(
  names: PlanNames,
  plan: unknown,
  fallback = "",
): string {
  if (plan === null || plan === undefined || plan === "") return fallback;
  return names[String(plan)] ?? fallback;
}
