import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/authGuard";
import { SESSION_COOKIE } from "@/lib/sessionCookies";
import { PdfBusyError, renderPagePdf, PDF_MAX_DURATION_SECONDS } from "@/lib/pdf";

export const dynamic = "force-dynamic";

/* Next reads segment config statically, so this cannot be the imported
   constant — it is repeated from PDF_MAX_DURATION_SECONDS, which the reference
   below keeps honest. */
export const maxDuration = 60;
void (PDF_MAX_DURATION_SECONDS satisfies typeof maxDuration);

/**
 * Prints /export-workout to a real PDF — selectable text and vector graphics,
 * via Chrome's own print engine.
 *
 * Everything that decides *what* is printed is decided by the page, which
 * guards itself. What this route has to get right is that the browser it drives
 * arrives as the caller: it forwards the session cookie, so the page renders
 * the trainee's sheet. Without it the headless browser was an anonymous visitor,
 * the guarded page redirected it to /login, and the returned "workout PDF" was
 * a picture of the sign-in screen.
 *
 * `requireUser` here is the cheap refusal — no browser is launched for a caller
 * who is not signed in at all. It is not the authorization: that is the page's,
 * and it is the one that decides whose sheet this is.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { searchParams, origin } = request.nextUrl;

  /* Rebuilt from named keys, never passed through: the address being fetched
     must not have an attacker-chosen part. */
  const params: Record<string, string> = {};
  for (const key of ["courseId", "cycleId", "profileId"]) {
    const value = searchParams.get(key);
    if (value) params[key] = value;
  }

  try {
    const pdf = await renderPagePdf({
      path: "/export-workout",
      params,
      origin,
      sessionCookie: request.cookies.get(SESSION_COOKIE)?.value,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PdfBusyError) {
      return NextResponse.json(
        { error: "جارٍ تجهيز ملف آخر — حاول بعد لحظات" },
        { status: 503, headers: { "Retry-After": "10" } }
      );
    }
    console.error("Workout PDF render failed:", error);
    return NextResponse.json({ error: "تعذّر إنشاء الملف" }, { status: 500 });
  }
}
