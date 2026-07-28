/* How many workouts make one cycle.

   The trainee answers this once, when they register — "عدد أيام التمرين التي
   تستطيع الالتزام بها" — and that answer is what a cycle counts to. It is
   deliberately not the length of the course the coach happened to build: if a
   trainee committed to five days and the plan only holds three, that is a plan
   to finish, not a commitment to quietly halve.

   The answer is stored as the option key it was picked by (`opt_days_5`), so the
   number has to be read back out of it. */

export const MIN_CYCLE_DAYS = 1;

/**
 * A sanity bound, not a week.
 *
 * This used to be 7 — the calendar showing through. Nothing about a cycle is
 * seven days long; the bound exists only so a nonsense answer cannot spawn
 * session rows without end. The intake form offers at most six, so it is never
 * reached in practice. `training_cycles_days_ck` enforces the same range.
 */
export const MAX_CYCLE_DAYS = 14;

function clamp(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  const whole = Math.trunc(n);
  if (whole < MIN_CYCLE_DAYS) return null;
  return Math.min(MAX_CYCLE_DAYS, whole);
}

/**
 * The number of weekly workouts the trainee committed to, or null when they
 * never answered — older profiles predate the question.
 *
 * Accepts the stored option key (`opt_days_5`), a bare number, and a numeric
 * string, since the intake form has not always saved it the same way.
 */
export function parseWorkoutDaysAnswer(raw: unknown): number | null {
  if (typeof raw === "number") return clamp(raw);
  if (typeof raw !== "string") return null;
  const digits = raw.match(/\d+/);
  return digits ? clamp(Number(digits[0])) : null;
}

/** Digs the answer out of a profile's intake blob, which may still be raw JSON. */
export function workoutDaysOf(data: unknown): number | null {
  let parsed = data;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  return parseWorkoutDaysAnswer((parsed as Record<string, unknown>).workout_days);
}
