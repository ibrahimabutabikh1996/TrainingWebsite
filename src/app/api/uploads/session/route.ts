import { NextResponse } from "next/server";
import { getSession, sessionOwnsProfile } from "@/lib/authGuard";
import { clientAddress, consumeAttempt, UPLOAD_SESSION_LIMIT } from "@/lib/rateLimit";
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
export async function POST(request: Request) {
  const address = clientAddress(request);

  /* Without this an anonymous visitor could mint signed upload URLs in a loop
     and fill the bucket. */
  const limit = await consumeAttempt(`upload-session:${address}`, UPLOAD_SESSION_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة جداً. يرجى المحاولة بعد قليل." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: { scope?: unknown; profileId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const scope = body.scope === "renewal" ? "renewal" : "registration";
  const viewer = await getSession();

  if (scope === "renewal") {
    if (!viewer) {
      return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const profileId = typeof body.profileId === "string" ? body.profileId : "";
    if (!profileId || !(await sessionOwnsProfile(viewer, profileId))) {
      return NextResponse.json({ error: "غير مصرح لك بهذا الإجراء" }, { status: 403 });
    }

    const session = await createUploadSession({
      scope: "renewal",
      accountId: viewer.userId,
      profileId,
      clientIp: address,
    });
    return NextResponse.json({ uploadSessionId: session.id, expiresAt: session.expires_at });
  }

  /* Registration. Deliberately not bound to `viewer` even when one exists — a
     signed-in visitor filling in the public form is registering someone new, and
     the session should reach nothing they already own. */
  const session = await createUploadSession({
    scope: "registration",
    clientIp: address,
  });
  return NextResponse.json({ uploadSessionId: session.id, expiresAt: session.expires_at });
}
