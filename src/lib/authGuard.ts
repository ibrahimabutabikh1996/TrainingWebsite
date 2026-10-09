/* One place that answers "who is asking, and may they?".
 *
 * Every route handler, server action and server-rendered page goes through a
 * guard here before it touches Prisma. Three separate shapes, because the three
 * kinds of caller need three different refusals:
 *
 *   requireUser / requireAdmin              → route handlers, refused with a 401/403 response
 *   requireUserAction / requireAdminAction  → server actions, refused with null
 *   requireUserPage / requireAdminPage      → server components, refused with a redirect
 *
 * All three read the same signed cookie and go through the same verification,
 * so there is one definition of "signed in" and one of "is the coach".
 *
 * The proxy turns unauthenticated visitors away before any of this runs, but it
 * is a convenience, not the boundary: a route reached by any other path still
 * has to prove the caller for itself, which is why these calls sit inside the
 * handlers rather than only in `src/proxy.ts`.
 *
 * That file is what older comments and Next's own older docs call `middleware`
 * — Next 16 renamed the convention, and `src/middleware.ts` does not exist here.
 */

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createSessionToken,
  isAdminUsername,
  SESSION_TTL_REMEMBER_SECONDS,
  SESSION_TTL_SECONDS,
  verifySessionToken,
  type Session,
} from "@/lib/session";
import { SESSION_COOKIE, USER_HINT_COOKIE } from "@/lib/sessionCookies";
import { firstAllowedPath, hasPermission, type StaffPermission } from "@/lib/staffPermissions";

export type { Session } from "@/lib/session";

/** The signed-in account, or null. Never throws — an absent or forged cookie is just "nobody". */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * The signed-in account, or null — where a withdrawn session also counts as
 * null rather than as itself.
 *
 * For the handlers that legitimately serve both signed-in and anonymous callers
 * and so cannot use `requireUser`: the upload endpoints, which have to keep
 * working for a stranger filling in the registration form. They read the
 * session with `getSession`, which checks the signature and the expiry and asks
 * the database nothing — so a trainee whose account had been suspended, or
 * whose token predated a password change, still acted as themselves there.
 *
 * Returning null instead is what "anonymous" already means to those handlers,
 * and it is the honest answer: the credential has been disowned. The practical
 * effect is narrow and correct — an unowned registration session stays usable,
 * because it takes no owner, while an owned one is refused, because the caller
 * can no longer prove they are its owner.
 */
export async function getVerifiedSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  return (await sessionRefusal(session)) ? null : session;
}

/* ------------------------------------------------------------------ *
 * Route handlers
 * ------------------------------------------------------------------ */

export type ApiGuard =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

/* The refusals are deliberately terse. Telling an unauthenticated caller which
   ids exist, or which of them they were close to being allowed to read, is the
   information the guard is there to withhold. */

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "غير مصرح لك بهذا الإجراء" }, { status: 403 });
}

function suspended(): NextResponse {
  return NextResponse.json(
    { error: "الحساب متوقف يرجى التواصل مع الادارة" },
    { status: 403 }
  );
}

/* ------------------------------------------------------------------ *
 * Revocation
 * ------------------------------------------------------------------ */

/**
 * Why this session should be refused despite carrying a valid signature, or
 * null if it should not be.
 *
 * A signed token proves only what was true when it was minted. Two things can
 * stop being true afterwards, and neither was noticed until this existed:
 *
 *   "suspended"  the coach suspended the trainee. `is_suspended` was read at the
 *                door only — /api/auth/login refuses on it — which left the case
 *                the switch actually exists for uncovered. Someone already
 *                signed in kept their session for its full life: a week, or a
 *                month with "remember me". The coach pressed the button and
 *                nothing happened.
 *
 *   "stale"      the password changed after this token was issued. The reason
 *                people change a password is that somebody else has it, and
 *                until now that somebody kept their session regardless. The
 *                token cannot be revoked — it is a signature, not a row — so it
 *                is disowned instead, by comparing when it was minted against
 *                `accounts.password_changed_at`.
 *
 * One query answers both. The account row is where the password timestamp lives
 * and the trainee's profile hangs off it, so the suspension flag comes back on
 * the same round trip rather than a second one — which matters, because this
 * runs on every guarded request and the whole point of a signed token was to
 * avoid the database entirely.
 *
 * A missing account is refused too: the row was deleted while the cookie lived.
 *
 * Suspension is checked only for trainees and staff. The coach cannot be
 * suspended — membership is a username in `@/lib/adminUsernames`, not a column —
 * but their password change counts the same as anyone's.
 *
 * A staff member's grant comes back on the same round trip, and is written onto
 * the session as `permissions` for the guards below to read — and with it the
 * trainees they were given, as `traineeIds`. A token that says
 * staff with no `staff_accounts` row behind it is refused as stale: the coach
 * removed them.
 */
async function sessionRefusal(session: Session): Promise<"suspended" | "stale" | null> {
  const account = await prisma.accounts.findUnique({
    where: { id: session.userId },
    select: {
      password_changed_at: true,
      staff_accounts: {
        select: {
          permissions: true,
          is_suspended: true,
          staff_trainees: { select: { profile_id: true } },
        },
      },
      /* Newest first, matching /api/auth/login and /api/profile: that is the
         profile the dashboard loads, so it is the one whose flag governs. */
      profiles: {
        orderBy: { created_at: "desc" },
        take: 1,
        select: { is_suspended: true },
      },
    },
  });

  if (!account) return "stale";

  /* Seconds, because that is the resolution the token records. `>` and not
     `>=`: a change landing in the same second as the sign-in that follows it is
     the re-issue in /api/auth/change-password, and refusing that would log
     someone out for changing their own password successfully. */
  if (account.password_changed_at) {
    const changedAt = Math.floor(account.password_changed_at.getTime() / 1000);
    if (changedAt > session.issuedAt) return "stale";
  }

  if (session.isStaff) {
    if (!account.staff_accounts) return "stale";
    if (account.staff_accounts.is_suspended) return "suspended";
    session.permissions = account.staff_accounts.permissions;
    session.traineeIds = account.staff_accounts.staff_trainees.map((t) => t.profile_id);
    return null;
  }

  if (!session.isAdmin && account.profiles[0]?.is_suspended === true) return "suspended";

  return null;
}

/* ------------------------------------------------------------------ *
 * Staff
 * ------------------------------------------------------------------ */

/**
 * What a guard asks of a staff member: one permission, any one of several, or
 * "any" for nothing more than being staff at all. Leaving it out of an admin
 * guard means the coach only.
 */
export type AdminNeed = StaffPermission | readonly StaffPermission[] | "any";

/**
 * Whether this session may do what `need` names. The coach always may; a
 * trainee never. Only meaningful on a session a guard has already checked,
 * since that is what fills in a staff member's `permissions`.
 */
export function sessionCan(session: Session, need: AdminNeed): boolean {
  if (session.isAdmin) return true;
  if (!session.isStaff) return false;
  if (need === "any") return true;
  const needs: readonly StaffPermission[] = typeof need === "string" ? [need] : need;
  return needs.some((n) => hasPermission(session.permissions, n));
}

/**
 * Whether this session may see this trainee at all. The coach sees every one;
 * a staff member only those the coach gave them. Nothing else is decided here —
 * what they may do with the trainee is still `sessionCan`'s question.
 */
export function sessionMaySeeTrainee(session: Session, profileId: string): boolean {
  if (session.isAdmin) return true;
  return session.isStaff && (session.traineeIds ?? []).includes(profileId);
}

/**
 * A Prisma filter on `profiles.id` that keeps a staff member to their own
 * trainees, or an empty object for the coach. Spread it into a `where`:
 * `where: { ...traineeScope(session), … }`.
 */
export function traineeScope(session: Session): { id?: { in: string[] } } {
  return session.isAdmin ? {} : { id: { in: [...(session.traineeIds ?? [])] } };
}

/**
 * The same rule for a row that hangs off a trainee by `profile_id`, such as a
 * diet plan: a staff member reaches the rows of their own trainees and the rows
 * that belong to no trainee at all. An empty object for the coach.
 */
export function profileRowScope(
  session: Session
): { OR?: ({ profile_id: null } | { profile_id: { in: string[] } })[] } {
  return session.isAdmin
    ? {}
    : { OR: [{ profile_id: null }, { profile_id: { in: [...(session.traineeIds ?? [])] } }] };
}

/** Any signed-in account whose session is still good. Call it as the first line of the handler, before the try block. */
export async function requireUser(): Promise<ApiGuard> {
  const session = await getSession();
  if (!session) return { ok: false, response: unauthorized() };

  const refusal = await sessionRefusal(session);
  if (refusal === "suspended") return { ok: false, response: suspended() };
  /* A stale token is answered as "not signed in", because that is what it now
     is: the credential it was issued against no longer exists. */
  if (refusal) return { ok: false, response: unauthorized() };

  return { ok: true, session };
}

/**
 * The coach only.
 *
 * `sessionRefusal` is checked here for the same reason it is checked in
 * `requireUser`, and it was not. The three admin guards read the signature and
 * the expiry and nothing else — no database at all — so a token stayed good for
 * its whole life whatever happened to the account behind it. Changing the
 * coach's password did not sign the old sessions out of the panel, though it did
 * sign a trainee out of the dashboard; deleting the account did not either. The
 * one credential in this system that can read every trainee's file was the one
 * that could not be withdrawn.
 *
 * Ordered so `isAdmin` is settled first: a trainee who wanders in is refused on
 * the token alone and never costs a query.
 *
 * With `need`, a staff member holding it is admitted too — see `AdminNeed`.
 * Without it, the coach only.
 */
export async function requireAdmin(need?: AdminNeed): Promise<ApiGuard> {
  const session = await getSession();
  if (!session) return { ok: false, response: unauthorized() };
  if (!session.isAdmin && !(need && session.isStaff)) return { ok: false, response: forbidden() };

  /* Answered as "not signed in", matching `requireUser`: the credential this
     token was issued against no longer exists. Suspension can only arise for a
     staff member — `sessionRefusal` does not read it for the coach. */
  const refusal = await sessionRefusal(session);
  if (refusal === "suspended") return { ok: false, response: suspended() };
  if (refusal) return { ok: false, response: unauthorized() };

  if (need && !sessionCan(session, need)) return { ok: false, response: forbidden() };

  return { ok: true, session };
}

/* ------------------------------------------------------------------ *
 * Server actions
 * ------------------------------------------------------------------ */

/**
 * A server action is a public HTTP endpoint, whatever it looks like from the
 * call site — so each one checks for itself. Null means refuse, and the action
 * returns its own error shape rather than a shared one.
 */
export async function requireUserAction(): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  /* A suspended trainee, or one holding a token from before their password
     changed, is refused here exactly as an unauthenticated one is — the action's
     own error shape says so, and nothing downstream has to know which it was. */
  return (await sessionRefusal(session)) ? null : session;
}

export async function requireAdminAction(need?: AdminNeed): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  if (!session.isAdmin && !(need && session.isStaff)) return null;
  /* Same revocation check as `requireAdmin` — see the note there. A server
     action is a public endpoint, so the eighteen of them behind this guard were
     reachable with a withdrawn token exactly as the route handlers were. */
  if (await sessionRefusal(session)) return null;
  if (need && !sessionCan(session, need)) return null;
  return session;
}

/* ------------------------------------------------------------------ *
 * Server components
 * ------------------------------------------------------------------ */

/**
 * Redirects instead of rendering. Call it before the first Prisma query, not
 * after: a page that queries and then redirects has already read the data, and
 * on a streamed response may already have sent some of it.
 */
export async function requireUserPage(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  /* Back to the sign-in screen, which is where the refusal is spelled out:
     signing in again is what the person will try, and /api/auth/login answers a
     suspended account with "الحساب متوقف" and a changed password with the
     ordinary prompt. /login is outside the proxy's matcher and does not send a
     signed-in visitor anywhere, so this cannot loop. */
  if (await sessionRefusal(session)) redirect("/login");
  return session;
}

export async function requireAdminPage(need?: AdminNeed): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  /* A signed-in trainee who wanders into the panel goes back to their own
     dashboard rather than to the sign-in screen they just came from. */
  if (!session.isAdmin && !session.isStaff) redirect("/dashboard");
  /* Same revocation check as `requireAdmin` — see the note there. To /login
     rather than /dashboard: a token whose account is gone or whose password has
     changed is not a trainee in the wrong place, it is nobody. */
  if (await sessionRefusal(session)) redirect("/login");
  /* A staff member on a screen they were not granted goes to the first one they
     were — which their grant does open, so this cannot loop — or out of the
     panel if they were granted none. */
  if (!session.isAdmin && !(need && sessionCan(session, need))) {
    redirect(firstAllowedPath(session.permissions) ?? "/");
  }
  return session;
}

/* ------------------------------------------------------------------ *
 * Ownership
 * ------------------------------------------------------------------ */

/**
 * Whether this session may act on this profile.
 *
 * The client sends a `profileId` on nearly every write, and used to be believed:
 * changing one digit reached somebody else's training log. The id is still what
 * names the row, but it is checked against `profiles.user_id` before anything is
 * read or written. The coach passes, because the panel is built on acting for
 * other people — and so does a staff member granted the subscribers section at
 * `need`, for a trainee the coach gave them: "view" for a path that only reads,
 * "edit" (the default) for one that writes.
 */
export async function sessionOwnsProfile(
  session: Session,
  profileId: string,
  need: "view" | "edit" = "edit"
): Promise<boolean> {
  if (sessionCan(session, `subscribers.${need}`)) return sessionMaySeeTrainee(session, profileId);

  const profile = await prisma.profiles.findUnique({
    where: { id: profileId },
    select: { user_id: true },
  });
  return profile?.user_id === session.userId;
}

/**
 * The route-handler form: `{ ok: false }` carries the response to return.
 *
 * A profile that does not exist and a profile that belongs to someone else are
 * answered identically, so the endpoint cannot be used to find out which ids
 * are real.
 */
export async function requireProfileAccess(
  profileId: string,
  need: "view" | "edit" = "edit"
): Promise<ApiGuard> {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  if (!(await sessionOwnsProfile(auth.session, profileId, need))) {
    return { ok: false, response: forbidden() };
  }
  return auth;
}

/**
 * The profile the signed-in trainee owns — newest first, which is the one
 * `/api/profile` and the sign-in check have always used.
 */
export async function ownProfileId(session: Session): Promise<string | null> {
  const profile = await prisma.profiles.findFirst({
    where: { user_id: session.userId },
    orderBy: { created_at: "desc" },
    select: { id: true },
  });
  return profile?.id ?? null;
}

/* ------------------------------------------------------------------ *
 * Issuing and clearing
 * ------------------------------------------------------------------ */

/**
 * Writes the session cookie. Only callable from a route handler or a server
 * action — Next does not allow a server component to set cookies.
 */
export async function startSession(
  account: { id: string; username: string },
  remember = false,
  /**
   * Overrides the lifetime `remember` would choose. For re-issuing a session
   * that already exists — /api/auth/change-password replaces the caller's token
   * so that changing your own password does not sign you out, and the
   * replacement has to keep the lifetime the original was granted rather than
   * silently demoting a month to a week. Clamped, so a computed value from an
   * old token cannot mint something longer than the maximum.
   */
  ttlSecondsOverride?: number
): Promise<Session> {
  const ttl =
    ttlSecondsOverride !== undefined && Number.isFinite(ttlSecondsOverride)
      ? Math.min(Math.max(Math.floor(ttlSecondsOverride), 60), SESSION_TTL_REMEMBER_SECONDS)
      : remember
        ? SESSION_TTL_REMEMBER_SECONDS
        : SESSION_TTL_SECONDS;
  /* Whether this is a staff member is settled here, once, and carried in the
     token so the proxy can admit them to the panel. Their grant is not: the
     guards read that on every request. */
  const isStaff =
    !isAdminUsername(account.username) &&
    (await prisma.staff_accounts.findUnique({
      where: { account_id: account.id },
      select: { account_id: true },
    })) !== null;
  const { token, expiresAt } = await createSessionToken(account, ttl, isStaff);
  const store = await cookies();

  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttl,
  });

  /* Readable by script, and worth nothing on its own — see USER_HINT_COOKIE.
   *
   * The value goes in raw: Next's cookie serializer percent-encodes it on the
   * way out, and `@/lib/clientSession` decodes once on the way in. Encoding it
   * here as well stored the coach's name as `...%2540gmail.com`, which decoded
   * back to `...%40gmail.com` and matched no entry in `ADMIN_USERNAMES`. The
   * session itself was unaffected — it carries the username in the signed token
   * — so the coach reached /admin at sign-in and every screen that asked the
   * browser who they were got a stranger: the landing page's panel link and the
   * password screen's back link both pointed at the trainee dashboard, and
   * `/dashboard` no longer bounced them to their own panel. */
  store.set(USER_HINT_COOKIE, account.username, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttl,
  });

  return {
    userId: account.id,
    username: account.username,
    isAdmin: isAdminUsername(account.username),
    isStaff,
    expiresAt,
    issuedAt: expiresAt - ttl,
  };
}

export async function endSession(): Promise<void> {
  const store = await cookies();

  /* Cleared by writing an empty, already-expired cookie with the same
     attributes it was created with, rather than `store.delete(name)`.
     `delete` emits only the name, path and expiry; a browser keys a cookie on
     name, domain and path, so that is usually enough — but "usually" is doing
     work there. A `Secure` cookie cannot be overwritten by a non-`Secure` one
     from an insecure origin, and a signed-out browser that keeps a valid
     session cookie is the failure this must not have. Writing the same shape
     back leaves nothing to differ over. */
  const cleared = {
    value: "",
    path: "/",
    maxAge: 0,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };

  store.set({ name: SESSION_COOKIE, httpOnly: true, ...cleared });
  store.set({ name: USER_HINT_COOKIE, httpOnly: false, ...cleared });
}
