import { NextResponse } from "next/server";
import { getSession } from "@/lib/authGuard";
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

  const opened = await openSession(body.uploadSessionId, await getSession());
  if (!opened.ok) {
    return NextResponse.json({ error: opened.error }, { status: opened.status });
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
