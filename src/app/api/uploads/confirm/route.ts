import { NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/authGuard";
import { clientAddress, consumeAttempt, UPLOAD_CONFIRM_LIMIT } from "@/lib/rateLimit";
import { confirmItem, openSession } from "@/lib/uploadSessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/uploads/confirm — reads the object back and decides whether to keep it.
 *
 * Takes an item id, not a path. The path is looked up from the row, and the row
 * has to belong to the session the caller was authorised for — so there is no
 * arbitrary path to point this at, and nothing to be learned by guessing ids.
 *
 * Until an object passes here it is `created`: not confirmed, not attachable,
 * and swept in due course. The verification itself — real size, real leading
 * bytes, stored content type, image structure — is in `confirmItem`.
 */
export async function POST(request: Request) {
  let body: { uploadSessionId?: unknown; itemId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  if (typeof body.uploadSessionId !== "string" || typeof body.itemId !== "string") {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const opened = await openSession(body.uploadSessionId, await getVerifiedSession());
  if (!opened.ok) {
    return NextResponse.json({ error: opened.error }, { status: opened.status });
  }

  /* A ceiling, which this was the only endpoint in the upload chain to lack.
   *
   * Every call downloads the object from storage to inspect it, so an unbounded
   * caller could make the server fetch the same object as fast as the network
   * allowed. Counted against the session id — minted here, checked just above by
   * `openSession`, and not the caller's to rotate — and against the address as
   * well, matching the two-dimension shape the other upload endpoints use.
   *
   * Consumed after `openSession` so naming a stranger's session cannot spend
   * their allowance; the ceiling is generous because a session may legitimately
   * hold up to `MAX_ITEMS_PER_SESSION` files, each confirmed once. */
  const address = clientAddress(request);
  const [byAddress, bySession] = await Promise.all([
    consumeAttempt(`upload-confirm:${address}`, UPLOAD_CONFIRM_LIMIT),
    consumeAttempt(`upload-confirm:session:${opened.session.id}`, UPLOAD_CONFIRM_LIMIT),
  ]);
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

  const result = await confirmItem(opened.session, body.itemId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    itemId: result.itemId,
    field: result.field,
    type: result.type,
    sizeBytes: result.sizeBytes,
  });
}
