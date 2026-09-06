import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/authGuard";
import { SESSION_COOKIE } from "@/lib/sessionCookies";
import { PdfBusyError, renderPagePdf, PDF_MAX_DURATION_SECONDS } from "@/lib/pdf";

export const dynamic = "force-dynamic";

/* Repeated from PDF_MAX_DURATION_SECONDS — Next reads segment config
   statically and rejects an imported constant. */
export const maxDuration = 60;
void (PDF_MAX_DURATION_SECONDS satisfies typeof maxDuration);

/**
 * Prints /export-diet to a PDF. See the workout route for the reasoning; this
 * one differs only in the page it prints and the key it accepts.
 *
 * /export-diet checks `sessionOwnsProfile` for itself, so forwarding the
 * session cookie is both what makes the render work and what keeps it to the
 * caller's own plan.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { searchParams, origin } = request.nextUrl;

  /* Forwarded, not decided here: /export-diet checks both keys for itself —
     `sessionOwnsProfile` for a prescribed plan, and admin-only for a template,
     which has no owner to be checked against. This route's job is to hand the
     headless render the same address and the caller's own cookie. */
  const params: Record<string, string> = {};
  const profileId = searchParams.get("profileId");
  if (profileId) params.profileId = profileId;
  const groupId = searchParams.get("groupId");
  if (groupId) params.groupId = groupId;

  try {
    const pdf = await renderPagePdf({
      path: "/export-diet",
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
    console.error("Diet PDF render failed:", error);
    return NextResponse.json({ error: "تعذّر إنشاء الملف" }, { status: 500 });
  }
}
