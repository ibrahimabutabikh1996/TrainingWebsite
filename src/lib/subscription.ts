/* Single source of truth for the subscription period.
   The 30-day rule used to be re-implemented at each read site, and the two
   implementations disagreed: /api/profile measured from accounts.created_at
   (ignoring activation_date entirely) while AccountManager measured from
   activation_date. The same subscription could read "expired" to the trainee
   and "active" to the coach.

   The end date is now computed once at write time and stored in
   profiles.subscription_ends_at, so every reader answers from the same value —
   and "who has expired?" becomes an indexed column comparison instead of
   digging the last element out of a JSON array. */

import { toISODate, utcMidnight } from "@/lib/trainingDates";

export const SUBSCRIPTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** End of a subscription period that starts at `from` (defaults to now). */
export function subscriptionEndFrom(from: Date = new Date()): Date {
  return new Date(from.getTime() + SUBSCRIPTION_DAYS * DAY_MS);
}

export interface SubscriptionWindow {
  /** `YYYY-MM-DD` of the day the period began. */
  start: string;
  /** `YYYY-MM-DD` of its last day. */
  end: string;
}

/**
 * The subscription period as calendar days — "the month" the trainee is inside,
 * running from the day they subscribed to the last day it covers. These are the
 * days a rest day may be placed on.
 *
 * Only the end is stored; the start is `SUBSCRIPTION_DAYS` back from it, which is
 * exactly where `subscriptionEndFrom` put it. Null when never activated.
 */
export function subscriptionWindow(
  endsAt: Date | string | null | undefined
): SubscriptionWindow | null {
  if (!endsAt) return null;
  const end = endsAt instanceof Date ? endsAt : new Date(endsAt);
  if (Number.isNaN(end.getTime())) return null;
  /* Read as a calendar day, so the stored instant's time of day — an artefact of
     whenever the coach happened to click activate — does not shift the window.
     Read in local time, not UTC: `subscriptionEndFrom` stamped it from the same
     clock `todayISODate` reads, and a subscription activated in the small hours
     of a UTC+3 evening would otherwise come back a day early at both ends. */
  const endDay = utcMidnight(end.getFullYear(), end.getMonth(), end.getDate());
  return {
    start: toISODate(new Date(endDay.getTime() - SUBSCRIPTION_DAYS * DAY_MS)),
    end: toISODate(endDay),
  };
}

/** A subscription with no end date has never been activated — not expired. */
export function isSubscriptionExpired(
  endsAt: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!endsAt) return false;
  const end = endsAt instanceof Date ? endsAt : new Date(endsAt);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() <= now.getTime();
}

/** Whole days left; negative once past the end. Null when never activated. */
export function daysRemaining(
  endsAt: Date | string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!endsAt) return null;
  const end = endsAt instanceof Date ? endsAt : new Date(endsAt);
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - now.getTime()) / DAY_MS);
}
