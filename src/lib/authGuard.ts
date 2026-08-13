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
 * The middleware turns unauthenticated visitors away before any of this runs,
 * but it is a convenience, not the boundary: a route reached by any other path
 * still has to prove the caller for itself, which is why these calls sit inside
 * the handlers rather than only in `src/middleware.ts`.
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

export type { Session } from "@/lib/session";

/** The signed-in account, or null. Never throws — an absent or forged cookie is just "nobody". */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
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

/** Any signed-in account. Call it as the first line of the handler, before the try block. */
export async function requireUser(): Promise<ApiGuard> {
  const session = await getSession();
  if (!session) return { ok: false, response: unauthorized() };
  return { ok: true, session };
}

/** The coach only. */
export async function requireAdmin(): Promise<ApiGuard> {
  const session = await getSession();
  if (!session) return { ok: false, response: unauthorized() };
  if (!session.isAdmin) return { ok: false, response: forbidden() };
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
  return getSession();
}

export async function requireAdminAction(): Promise<Session | null> {
  const session = await getSession();
  return session?.isAdmin ? session : null;
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
  return session;
}

export async function requireAdminPage(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  /* A signed-in trainee who wanders into the panel goes back to their own
     dashboard rather than to the sign-in screen they just came from. */
  if (!session.isAdmin) redirect("/dashboard");
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
 * other people.
 */
export async function sessionOwnsProfile(session: Session, profileId: string): Promise<boolean> {
  if (session.isAdmin) return true;

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
export async function requireProfileAccess(profileId: string): Promise<ApiGuard> {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  if (!(await sessionOwnsProfile(auth.session, profileId))) {
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
  remember = false
): Promise<Session> {
  const ttl = remember ? SESSION_TTL_REMEMBER_SECONDS : SESSION_TTL_SECONDS;
  const { token, expiresAt } = await createSessionToken(account, ttl);
  const store = await cookies();

  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttl,
  });

  /* Readable by script, and worth nothing on its own — see USER_HINT_COOKIE. */
  store.set(USER_HINT_COOKIE, encodeURIComponent(account.username), {
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
    expiresAt,
  };
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(USER_HINT_COOKIE);
}
