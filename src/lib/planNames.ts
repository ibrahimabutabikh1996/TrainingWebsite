import type { JsonRecord } from "@/types";
import { translations } from "@/lib/translations";
import { PLAN_KEYS, PLAN_VALUES } from "@/lib/formLabels";
import { planOrderFrom, planValueOf, planNumberOf } from "@/lib/planCards";

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

  /* Plans past the three the dictionary knows about. The coach can add any
     number of cards now, and a card the panel created has no entry in
     `PLAN_KEYS` and none in `translations` — its name exists only where the
     coach typed it. Read from the order rather than from every `cardN_badge`
     in the document, so this map holds what is on offer and nothing else: it
     is the list the form's plan picker is built from, and a package the coach
     has taken down should not still be selectable. */
  for (const id of planOrderFrom(content)) {
    const written = content[`${id}_badge`];
    if (typeof written === "string" && written.trim() !== "") {
      names[planValueOf(id)] = normalizeLegacyName(written.trim());
    }
  }

  return names;
}

/**
 * The same, plus the packages that are no longer offered.
 *
 * A plan the coach deletes disappears from the cards and from the picker, but
 * the subscribers who bought it do not disappear with it: their profile still
 * says `plan4`, and their record, their sheet and the subscriber list all have
 * to keep calling it what they bought. Deleting a plan therefore leaves its
 * name behind — this reads those leftovers, so nothing that displays a stored
 * plan ever falls back to showing the bare key or an empty tag.
 *
 * Anything showing a plan somebody is already on wants this. The form's picker
 * wants `resolvePlanNames`, which is the list of what can still be bought.
 */
export function resolvePlanDisplayNames(content: JsonRecord | null | undefined): PlanNames {
  const names = resolvePlanNames(content);
  if (!content) return names;

  for (const key of Object.keys(content)) {
    const m = /^card(\d+)_badge$/.exec(key);
    if (!m) continue;
    const n = planNumberOf(`card${m[1]}`);
    if (n === null) continue;
    const plan = `plan${n}`;
    if (names[plan]) continue;
    const written = content[key];
    if (typeof written === "string" && written.trim() !== "") {
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


/** A plan value that names one of the offers rather than one of the plans. */
export function isOfferValue(plan: unknown): boolean {
  return String(plan).startsWith("offer");
}

export interface PlanOption {
  value: string;
  label: string;
}

/**
 * The six plan values as a list to choose from, with the ambiguous ones marked.
 *
 * `off_card1_badge` and friends are deliberately the same strings as
 * `card1_badge` and friends — that was asked for, and the note beside them in
 * `translations.ts` spells out the cost: six products under three names, and
 * anything that shows the name alone cannot tell them apart. A dropdown is the
 * sharpest case of that, because it puts both under the pointer at once. The
 * subscriber filter listed "خطة المتابعة اليومية" twice with nothing to say
 * which was which, and so did the two pickers in the intake form — where the
 * pair are separate products at separate prices.
 *
 * So the marker goes on here, in the list, and nowhere else: the cards on the
 * landing page keep the names the coach chose for them.
 *
 * Marked only when the name is actually shared. A label is suffixed when some
 * other value resolves to the same string, which means the day the offers are
 * given names of their own in the content manager the suffix disappears by
 * itself — rather than leaving a coach who named an offer "عرض رمضان" reading
 * "عرض رمضان (عرض)".
 */
export function planOptions(names: PlanNames): PlanOption[] {
  const labelFor = (value: string) => planNameFrom(names, value, value);

  /* Whatever the resolver knows about, rather than a fixed six. `PLAN_VALUES`
     is still the floor — a document with no plans of its own answers with the
     three the dictionary carries — but a coach who has added a fourth needs it
     in the picker, and one who has taken the third down needs it gone. */
  const values = PLAN_VALUES.filter((v) => v in names).concat(
    Object.keys(names).filter((v) => !PLAN_VALUES.includes(v)),
  );

  const seen = new Map<string, number>();
  for (const value of values) {
    const label = labelFor(value);
    seen.set(label, (seen.get(label) ?? 0) + 1);
  }

  return values.map((value) => {
    const label = labelFor(value);
    const shared = (seen.get(label) ?? 0) > 1;
    return {
      value,
      label: shared && isOfferValue(value)
        ? `${label} (${translations.plan_offer_suffix})`
        : label,
    };
  });
}
