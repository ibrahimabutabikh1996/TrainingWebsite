/* Who counts as the coach.
 *
 * The rule the app has always used — it was just written out at four separate
 * call sites, each kept in step by hand. Membership is by username because that
 * is what the `accounts` table records; giving it a column of its own is a
 * schema change, and the security batch this was written for is not the place
 * for one.
 *
 * Its own module because both sides need it: the server, to decide what a
 * request may do, and the browser, to decide which navigation to draw. Only the
 * first of those is a decision — see `@/lib/clientSession`.
 */

/* Exported so `isReservedUsername` in `@/lib/auth` can refuse these at account
   creation. Membership here decides what a session may do, so a stranger must
   never be able to claim one of these names through the public intake form —
   the only thing that stood between them and the coach's panel was whether the
   row happened to exist already. */
export const ADMIN_USERNAMES: readonly string[] = ["admin", "mkm94admin"];

export function isAdminUsername(username: string | null | undefined): boolean {
  return typeof username === "string" && ADMIN_USERNAMES.includes(username);
}
