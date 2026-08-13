import { NextResponse } from "next/server";
import { getSession } from "@/lib/authGuard";
import { clientAddress, consumeAttempt, UPLOAD_SLOT_LIMIT } from "@/lib/rateLimit";
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

  const limit = await consumeAttempt(`upload-slot:${address}`, UPLOAD_SLOT_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة جداً. يرجى المحاولة بعد قليل." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: { uploadSessionId?: unknown; field?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  if (typeof body.uploadSessionId !== "string" || typeof body.field !== "string") {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const opened = await openSession(body.uploadSessionId, await getSession());
  if (!opened.ok) {
    return NextResponse.json({ error: opened.error }, { status: opened.status });
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
