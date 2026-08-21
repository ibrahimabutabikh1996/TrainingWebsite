import { NextResponse } from "next/server";
import { requireUser, sessionOwnsProfile } from "@/lib/authGuard";
import {
  clientAddress,
  consumeAttempt,
  UPLOAD_SESSION_GLOBAL_KEY,
  UPLOAD_SESSION_GLOBAL_LIMIT,
  UPLOAD_SESSION_LIMIT,
} from "@/lib/rateLimit";
import { createUploadSession } from "@/lib/uploadSessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/uploads/session — opens a scratch folder for one browser's uploads.
 *
 * Two callers:
 *
 *   registration  nobody is signed in yet, by definition. The session is
 *                 anonymous, which is why it is rate limited per address, expires
 *                 within the hour, caps how many files it can hold, and reaches
 *                 no existing profile or account. The id it returns is a handle,
 *                 not a credential — see `openSession`.
 *
 *   renewal       a signed-in trainee replacing their answers. The session is
 *                 bound to their account, and the profile is checked here rather
 *                 than taken from the request.
 */
const tooMany = (retryAfterSeconds: number) =>
  NextResponse.json(
    { error: "محاولات كثيرة جداً. يرجى المحاولة بعد قليل." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );

export async function POST(request: Request) {
  const address = clientAddress(request);

  /* The address ceiling, first and cheap. It is no longer the only one: the
     address comes from a header the caller writes, so on its own it is a limit
     that can be rotated out of. What backs it up depends on the scope, and is
     applied below once the scope is known. */
  const byAddress = await consumeAttempt(`upload-session:${address}`, UPLOAD_SESSION_LIMIT);

  let body: { scope?: unknown; profileId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const scope = body.scope === "renewal" ? "renewal" : "registration";

  if (scope === "renewal") {
    /* `requireUser` rather than a bare `getSession`.
     *
     * The renewal branch decides whose profile a session may be bound to, and it
     * decides it through `sessionOwnsProfile` — which answers `true` for the
     * coach before it looks anything up. Handed a session read straight from the
     * cookie, that exemption was granted on a token that may already have been
     * withdrawn: a coach whose password had since changed, or whose account was
     * gone, could still open an upload session pointed at any trainee's profile.
     *
     * This was the last place in the project where `sessionOwnsProfile` was
     * given an unverified session. Every other call site — /api/attachments,
     * /api/training-cycles, /api/submit-form, the dashboard action, both export
     * pages — already passes one that came from `requireUser`, `requireUserPage`
     * or `requireUserAction`. This is that same call, in the one route that had
     * been left out.
     *
     * A live coach is unaffected: `requireUser` admits them and
     * `sessionOwnsProfile` still answers `true`, so helping a trainee renew keeps
     * working. What stops working is doing it with a token that has been
     * revoked. */
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const profileId = typeof body.profileId === "string" ? body.profileId : "";
    if (!profileId || !(await sessionOwnsProfile(auth.session, profileId))) {
      return NextResponse.json({ error: "غير مصرح لك بهذا الإجراء" }, { status: 403 });
    }

    /* Counted against the profile as well as the address. The profile is
       server-derived — the session was verified and ownership checked above — so
       this is the half of the ceiling the caller cannot rotate out of. Consumed
       after the authorisation checks so a stranger cannot burn somebody else's
       budget by naming their id. */
    const byProfile = await consumeAttempt(
      `upload-session:profile:${profileId}`,
      UPLOAD_SESSION_LIMIT
    );
    if (!byAddress.allowed || !byProfile.allowed) {
      return tooMany(Math.max(byAddress.retryAfterSeconds, byProfile.retryAfterSeconds));
    }

    const session = await createUploadSession({
      scope: "renewal",
      accountId: auth.session.userId,
      profileId,
      clientIp: address,
    });
    return NextResponse.json({ uploadSessionId: session.id, expiresAt: session.expires_at });
  }

  /* Registration. Deliberately not bound to a session even when the caller has
     one — a signed-in visitor filling in the public form is registering someone
     new, and the session should reach nothing they already own. The cookie is
     not read at all on this path, which is why it stays open to strangers.

     This is the one endpoint with nothing server-issued to count against: it is
     what issues the identity everything downstream uses, so by definition the
     caller has none yet. The address alone was therefore the whole ceiling, and
     rotating the header walked through it. The backstop below counts every
     anonymous session opened by anyone, so a rotated address is counted just the
     same — at a limit set far above real traffic. See UPLOAD_SESSION_GLOBAL_LIMIT
     for what this costs and why it is still the better trade. */
  const globally = await consumeAttempt(UPLOAD_SESSION_GLOBAL_KEY, UPLOAD_SESSION_GLOBAL_LIMIT);
  if (!byAddress.allowed || !globally.allowed) {
    return tooMany(Math.max(byAddress.retryAfterSeconds, globally.retryAfterSeconds));
  }

  const session = await createUploadSession({
    scope: "registration",
    clientIp: address,
  });
  return NextResponse.json({ uploadSessionId: session.id, expiresAt: session.expires_at });
}
