import { NextResponse, type NextRequest } from "next/server";
import puppeteer from "puppeteer";

export const dynamic = "force-dynamic";

// Renders the /export-workout page in a headless browser and prints it to a
// real PDF (selectable text, vector graphics) via Chrome's own print engine,
// instead of rasterizing the page into a single JPEG like html2pdf.js did.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const pageUrl = new URL("/export-workout", origin);
  for (const key of ["courseId", "cycleId", "profileId"]) {
    const value = searchParams.get(key);
    if (value) pageUrl.searchParams.set(key, value);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(pageUrl.toString(), { waitUntil: "networkidle0" });
    await page.evaluateHandle("document.fonts.ready");

    // The page's own `@page { size: A4; margin: 15mm }` rule (in
    // ExportWorkoutClient's print styles) drives size and margins, so
    // Chrome's print engine is told to defer to it via preferCSSPageSize
    // instead of double-applying a separate Puppeteer margin on top.
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await browser.close();
  }
}
