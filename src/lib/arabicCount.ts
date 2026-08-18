/* Arabic counted nouns don't work like English: the noun form changes with the
   number (1 singular, 2 dual, 3–10 plural, 11+ back to singular accusative).
   Interpolating a fixed plural produced strings like "1 أيام" and "3 يوم". */

export interface CountForms {
  /** n === 1 — "يوم" */
  one: string;
  /** n === 2 — "يومان" */
  two: string;
  /** 3 ≤ n ≤ 10, and 0 — "أيام" */
  few: string;
  /** n ≥ 11 — "يوماً" */
  many: string;
}

export function arabicCount(n: number, forms: CountForms): string {
  const count = Math.abs(Math.trunc(n));
  if (count === 1) return forms.one;
  if (count === 2) return forms.two;
  /* 11+ uses the singular again; 0 and 3–10 take the plural. */
  const noun = count >= 11 ? forms.many : forms.few;
  return `${count} ${noun}`;
}

/* There is no WEEK here: the week forms this file used to carry were never
   used by anything. */

export const DAY: CountForms = {
  one: "يوم",
  two: "يومان",
  few: "أيام",
  many: "يوماً",
};

export const EXERCISE: CountForms = {
  one: "تمرين",
  two: "تمرينان",
  few: "تمارين",
  many: "تمريناً",
};

export const TRAINEE: CountForms = {
  one: "مشترك",
  two: "مشتركان",
  few: "مشتركين",
  many: "مشتركاً",
};
