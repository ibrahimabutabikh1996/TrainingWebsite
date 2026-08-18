import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/authGuard";
import { storeCmsMedia } from "@/lib/cmsMedia";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/media — the coach's image and media uploads, over a request
 * the browser can measure.
 *
 * It does exactly what the `uploadImageServer` server action does, through the
 * same `storeCmsMedia`, behind the same "is this the coach" check. It exists
 * because a server action is invoked with `fetch`, and a fetch request body has
 * no progress event: the panel could only ever guess at how far a file had got,
 * and it guessed on a timer. An ordinary endpoint can be sent with
 * `XMLHttpRequest`, which reports the bytes as they leave — see
 * `@/lib/xhrUpload`.
 *
 * The guard is the same call the action makes, not a looser one. Nothing about
 * what may be stored, or by whom, changes by arriving here instead.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "لم يُرسل أي ملف" }, { status: 400 });
    }

    const stored = await storeCmsMedia(file);
    if (!stored.ok) {
      /* A refusal here is about the file itself — its type, its size — so it is
         a 400 and it carries the reason. */
      return NextResponse.json({ error: stored.error }, { status: 400 });
    }

    return NextResponse.json({ url: stored.url });
  } catch (error) {
    console.error("Failed to store an admin media upload:", error);
    return NextResponse.json({ error: "تعذّر رفع الملف" }, { status: 500 });
  }
}
