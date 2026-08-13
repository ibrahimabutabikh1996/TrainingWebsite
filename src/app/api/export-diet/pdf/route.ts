import { NextResponse, type NextRequest } from "next/server";
import { requireUser, sessionOwnsProfile } from "@/lib/authGuard";
import { PdfBusyError, renderPagePdf } from "@/lib/pdf";
import { SESSION_COOKIE } from "@/lib/sessionCookies";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/* Chromium needs longer than the platform's default. Written as a literal
   because Next reads segment config statically — an imported constant is
   rejected at build time with "Invalid segment configuration export". Keep it in
   step with PDF_MAX_DURATION_SECONDS in @/lib/pdf. */
export const maxDuration = 60;

// Renders the /export-diet page in a headless browser and prints it to a
// real PDF (selectable text, vector graphics) via Chrome's own print engine.
export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { searchParams, origin } = request.nextUrl;
  const profileId = searchParams.get("profileId");

  /* The diet sheet names the trainee and lists their allergies. */
  if (profileId && !(await sessionOwnsProfile(auth.session, profileId))) {
    return NextResponse.json({ error: "غير مصرح لك بهذا الإجراء" }, { status: 403 });
  }

  try {
    const pdf = await renderPagePdf({
      path: "/export-diet",
      params: profileId ? { profileId } : {},
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
        { error: "جاري تجهيز ملف آخر، يرجى المحاولة بعد لحظات" },
        { status: 503, headers: { "Retry-After": "10" } }
      );
    }
    console.error("Diet PDF generation failed:", error);
    return NextResponse.json({ error: "تعذّر تجهيز الملف" }, { status: 500 });
  }
}
