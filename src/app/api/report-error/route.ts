import { NextResponse } from "next/server";
import { clientAddress, consumeAttempt, type RateLimitOptions } from "@/lib/rateLimit";
import { sendErrorAlert } from "@/lib/errorAlert";

/* The browser's half of the error alerts: `error.tsx` and `global-error.tsx`
   post here when they catch something that never reached the server.

   Open to anyone, because the visitor who hit the error may not be signed in —
   which is also why everything in the body is treated as untrusted: each field
   is cut to a fixed length, and the address gets a ceiling of its own on top of
   the ones `sendErrorAlert` already applies. */
const REPORT_ERROR_LIMIT: RateLimitOptions = { max: 5, windowMinutes: 15 };

const clip = (value: unknown, max: number) =>
  typeof value === "string" && value ? value.slice(0, max) : undefined;

export async function POST(request: Request) {
  const byAddress = await consumeAttempt(
    `report-error:${clientAddress(request)}`,
    REPORT_ERROR_LIMIT
  );
  if (!byAddress.allowed) return new NextResponse(null, { status: 429 });

  try {
    const body = await request.json();

    await sendErrorAlert({
      name: clip(body?.name, 100) ?? "Error",
      message: clip(body?.message, 2000) ?? "(بدون رسالة)",
      stack: clip(body?.stack, 5000),
      digest: clip(body?.digest, 100),
      source: "browser",
      path: clip(body?.path, 500),
      userAgent: clip(request.headers.get("user-agent"), 300),
    });
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  return new NextResponse(null, { status: 204 });
}
