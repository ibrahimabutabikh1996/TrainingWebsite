/* Calendar helpers for the training log.

   Dates here are plain calendar days — "the day the trainee trained" — never
   instants. A `date` column holds a day with no zone, and Postgres truncates the
   timestamp it is given in UTC, so persisting a *local* midnight loses a day
   wherever local time runs ahead of UTC (UTC+3 here). Every calendar date is
   therefore carried as UTC midnight and read back through UTC accessors, so the
   day written is always the day stored.

   Formatting is done by hand rather than through `toLocaleDateString`: the
   `ar-SA` locale resolves to the Umm al-Qura calendar, which would print Hijri
   dates for days the trainee entered as Gregorian ones. */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** How far back a workout may be backdated — a forgotten session, not a rewrite of history. */
export const MAX_BACKDATE_DAYS = 120;

export function utcMidnight(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

/** `YYYY-MM-DD` for a calendar date stored as UTC midnight. */
export function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Parses `YYYY-MM-DD` into the matching UTC-midnight calendar date. */
export function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return utcMidnight(y, (m ?? 1) - 1, d ?? 1);
}

/** The caller's own calendar day — the trainee's in the browser, the server's on the server. */
export function todayISODate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isISODate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromISODate(s).getTime());
}

/** Whole days from `from` to `to`, both calendar dates. */
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((fromISODate(toISO).getTime() - fromISODate(fromISO).getTime()) / DAY_MS);
}

/* ─── Weekday names ─────────────────────────────────────────────────────────
   Indexed by `getUTCDay()`: 0 = Sunday … 6 = Saturday. */

export const WEEKDAYS_AR = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;

/** The order the week is read in Iraq — Saturday first. Used for the day picker. */
export const WEEKDAY_PICKER_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;

/** 0 = Sunday … 6 = Saturday, for a `YYYY-MM-DD` day. */
export function weekdayOf(iso: string): number {
  return fromISODate(iso).getUTCDay();
}

export function weekdayName(iso: string): string {
  return WEEKDAYS_AR[weekdayOf(iso)];
}

/* ─── Labels ─── */

/** `26/7/2026` */
export function formatDate(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
}

/** `26/7` — for tables and tags, where the year is noise. */
export function formatShortDate(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

/** `السبت 26/7` */
export function formatDayAndDate(iso: string): string {
  return `${weekdayName(iso)} ${formatShortDate(iso)}`;
}

/**
 * The span a set of recorded workouts covers, e.g. `26/7 — 1/8`.
 * Null when nothing has been recorded yet: a cycle has no dates until it is lived.
 */
export function dateRangeLabel(dates: (string | null)[]): string | null {
  const days = dates.filter(isISODate).sort();
  if (days.length === 0) return null;
  const first = formatShortDate(days[0]);
  const last = formatShortDate(days[days.length - 1]);
  return first === last ? first : `${first} — ${last}`;
}

/**
 * The days a workout may be dated to, newest first: today back through
 * `MAX_BACKDATE_DAYS`. Future days are not offered — a workout is recorded once
 * it has been done.
 */
export function selectableDates(todayISO: string, span = 60): string[] {
  const today = fromISODate(todayISO).getTime();
  return Array.from({ length: span }, (_, i) => toISODate(new Date(today - i * DAY_MS)));
}

/**
 * Whether a date may be recorded, judged against the given "today".
 *
 * One day of slack ahead: the server may still be on yesterday's UTC date while
 * the trainee's own clock (UTC+3) has already turned over, and they should not
 * be told their date is in the future when it is simply their evening.
 */
export function isRecordableDate(iso: unknown, todayISO: string): iso is string {
  if (!isISODate(iso)) return false;
  const ahead = daysBetween(todayISO, iso);
  return ahead <= 1 && ahead >= -MAX_BACKDATE_DAYS;
}

/** Arabic title for a cycle, e.g. "الدورة 3". */
export function cycleTitle(cycleNumber: number): string {
  return `الدورة ${cycleNumber}`;
}

/** Relative wording for the recent days, so the picker reads like speech. */
export function relativeDayLabel(iso: string, todayISO: string): string | null {
  switch (daysBetween(todayISO, iso)) {
    case 0:
      return "اليوم";
    case -1:
      return "أمس";
    case -2:
      return "أول أمس";
    default:
      return null;
  }
}
