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


export const SUBSCRIPTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** End of a subscription period that starts at `from` (defaults to now). */
export function subscriptionEndFrom(from: Date = new Date()): Date {
  return new Date(from.getTime() + SUBSCRIPTION_DAYS * DAY_MS);
}

/* `SubscriptionWindow` and `subscriptionWindow` stood here: the subscription
   period expressed as a first and last calendar day. Their only readers were the
   rest-days route and the coach's rest-days panel, which computed which days a
   trainee was allowed to mark off. That feature is gone, and with it the only
   question this pair answered. `subscriptionEndFrom` and `isSubscriptionExpired`
   below cover everything the rest of the app asks about a subscription. */

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
