import { NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/authGuard";
import {
  clientAddress,
  consumeAttempt,
  UPLOAD_SLOT_LIMIT,
  UPLOAD_SLOT_SESSION_LIMIT,
} from "@/lib/rateLimit";
import { issueSlot, openSession } from "@/lib/uploadSessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/uploads/create — grants one slot and a token that can write to it.
 *
 * The response contains a path, but the caller did not choose it and cannot
 * change it: the token Supabase issues is bound to that exact object. Everything
 * the decision rests on — which session, whose it is, which field, how many
 * already exist — is read from the database, never from the request.
 */
export async function POST(request: Request) {
  const address = clientAddress(request);

  /* The address ceiling, kept and no longer alone — the address is a header the
     caller writes, so counting only that is a limit that can be rotated out of.
     The second key is applied once the session is open, below. */
  const byAddress = await consumeAttempt(`upload-slot:${address}`, UPLOAD_SLOT_LIMIT);

  let body: { uploadSessionId?: unknown; field?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  if (typeof body.uploadSessionId !== "string" || typeof body.field !== "string") {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const opened = await openSession(body.uploadSessionId, await getVerifiedSession());
  if (!opened.ok) {
    return NextResponse.json({ error: opened.error }, { status: opened.status });
  }

  /* Counted against the session as well as the address.
   *
   * The id was minted by this server and `openSession` has just checked that the
   * caller may use it, so unlike the address it is not the caller's to invent.
   * Consumed after that check, so naming somebody else's session cannot spend
   * their budget.
   *
   * `issueSlot` already caps how many items a session may hold; this caps how
   * many times it may ask, which is the part a rotated address was getting for
   * free. */
  const bySession = await consumeAttempt(
    `upload-slot:session:${opened.session.id}`,
    UPLOAD_SLOT_SESSION_LIMIT
  );
  if (!byAddress.allowed || !bySession.allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة جداً. يرجى المحاولة بعد قليل." },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(byAddress.retryAfterSeconds, bySession.retryAfterSeconds)
          ),
        },
      }
    );
  }

  const slot = await issueSlot(opened.session, body.field);
  if (!slot.ok) {
    return NextResponse.json({ error: slot.error }, { status: slot.status });
  }

  return NextResponse.json({
    itemId: slot.itemId,
    path: slot.path,
    token: slot.token,
    maxBytes: slot.maxBytes,
  });
}
