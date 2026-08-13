import "server-only";
import puppeteer, { type Browser } from "puppeteer-core";
import { SESSION_COOKIE } from "@/lib/sessionCookies";

/* Printing a page to PDF, on a platform that will not run a browser for you.
 *
 * Both export routes called `puppeteer.launch()` from the full `puppeteer`
 * package. That works on a machine where npm could download a Chromium next to
 * it; on Vercel it cannot work at all — there is no browser in the runtime, and
 * the package is far past what a function bundle may weigh. The deployment
 * target is Vercel, so the browser now comes from `@sparticuz/chromium`, which
 * exists to ship a Lambda-sized Chromium, driven by `puppeteer-core` (the same
 * API with no bundled binary).
 *
 * Development keeps the full `puppeteer` — a devDependency now — because it
 * already carries a Chromium that runs on the machine this is written on.
 *
 * What this module adds beyond swapping the launcher:
 *
 *   concurrency  one render at a time per instance. A browser is ~200 MB of
 *                resident memory; two of them on a 1 GB function is an OOM kill,
 *                and the caller gets a 503 instead of a dead instance.
 *   timeouts     every step is bounded. A page that never reaches networkidle
 *                otherwise holds the browser until the platform kills the
 *                function, and the browser leaks with it.
 *   cleanup      the browser is closed in a `finally`, and a failure to close is
 *                logged rather than thrown, so it cannot mask the real error.
 *   SSRF         the caller passes a path, never a URL. The origin comes from
 *                the incoming request and the query is rebuilt from named keys,
 *                so no part of the address being fetched is attacker-chosen.
 */

/**
 * The function budget the steps below have to fit inside.
 *
 * Each route repeats it as a literal `export const maxDuration = 60`, because
 * Next reads segment config statically and rejects an imported constant. If this
 * changes, change it there too.
 */
export const PDF_MAX_DURATION_SECONDS = 60;

const NAVIGATION_TIMEOUT_MS = 25_000;
const RENDER_TIMEOUT_MS = 20_000;

/* Per instance, which is all a serverless process can speak for. It is not a
   global limit and is not meant to be one — it is what keeps a single instance
   from killing itself. */
let activeRenders = 0;
const MAX_CONCURRENT_RENDERS = 1;

export class PdfBusyError extends Error {
  constructor() {
    super("A PDF is already being generated on this instance.");
    this.name = "PdfBusyError";
  }
}

function isServerless(): boolean {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

async function launch(): Promise<Browser> {
  if (isServerless()) {
    const chromium = (await import("@sparticuz/chromium")).default;
    /* WebGL and the software rasteriser are not needed to print a text page,
       and skipping them avoids extracting the swiftshader archive on every cold
       start. */
    chromium.setGraphicsMode = false;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  /* Development. `PUPPETEER_EXECUTABLE_PATH` wins if it is set — otherwise the
     Chromium that the full `puppeteer` devDependency downloaded is used. */
  const explicit = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicit) {
    return puppeteer.launch({
      executablePath: explicit,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  const full = (await import("puppeteer")).default;
  return puppeteer.launch({
    executablePath: await full.executablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

export interface RenderRequest {
  /** An in-app path, e.g. `/export-workout`. Never a full URL. */
  path: string;
  /** Query parameters, already narrowed to the keys the page accepts. */
  params: Record<string, string>;
  /** The origin of the incoming request — the site printing its own page. */
  origin: string;
  /** The caller's session, so the guarded page renders for them and not the sign-in screen. */
  sessionCookie?: string;
}

/**
 * Renders one of this site's own pages and returns the PDF bytes.
 *
 * Throws `PdfBusyError` when this instance is already rendering.
 */
export async function renderPagePdf(request: RenderRequest): Promise<Uint8Array> {
  if (activeRenders >= MAX_CONCURRENT_RENDERS) {
    throw new PdfBusyError();
  }
  activeRenders++;

  let browser: Browser | null = null;
  try {
    const pageUrl = new URL(request.path, request.origin);
    for (const [key, value] of Object.entries(request.params)) {
      pageUrl.searchParams.set(key, value);
    }

    browser = await launch();

    if (request.sessionCookie) {
      await browser.setCookie({
        name: SESSION_COOKIE,
        value: request.sessionCookie,
        domain: new URL(request.origin).hostname,
        path: "/",
        httpOnly: true,
      });
    }

    const page = await browser.newPage();
    page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);

    await page.goto(pageUrl.toString(), {
      waitUntil: "networkidle0",
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    await page.evaluateHandle("document.fonts.ready");

    /* The pages carry their own `@page { size: A4; margin: 15mm }` rule, so
       Chrome's print engine is told to defer to it via preferCSSPageSize rather
       than double-applying a margin on top. */
    return await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      timeout: RENDER_TIMEOUT_MS,
    });
  } finally {
    activeRenders--;
    if (browser) {
      /* Closing can fail on an already-dead browser; that must not replace the
         error that got us here. */
      try {
        await browser.close();
      } catch (error) {
        console.error("Failed to close the PDF browser:", error);
      }
    }
  }
}
