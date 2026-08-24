/* The first gate, not the only one.
 *
 * Next 16 renamed this file convention from `middleware` to `proxy`; it is the
 * same hook, running before a request is completed. Its own documentation is
 * blunt about the limits — it "should not be used as a full session management
 * or authorization solution" — and this file takes that at face value.
 *
 * Turning an unauthenticated visitor away here means the coach's panel never
 * starts rendering for them and never runs a query on their behalf. But a
 * matcher is a list of paths, and lists go stale: a route added next month and
 * forgotten here would be wide open if this were the whole defence. So every
 * page, route handler and server action behind these paths checks for itself as
 * well, through `@/lib/authGuard`. This layer is what makes the common case
 * cheap; that layer is what makes it correct.
 *
 * `/api/*` is deliberately not matched: those handlers answer with a JSON 401,
 * and a redirect to an HTML sign-in page would reach their callers as an
 * unparseable response rather than a clear refusal.
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/session";
import { SESSION_COOKIE } from "@/lib/sessionCookies";

/** Paths only the coach may open. */
const ADMIN_PREFIXES = ["/admin", "/cms-preview"];

export async function proxy(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const needsAdmin = ADMIN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  /* A signed-in trainee is sent to their own dashboard, not back to a sign-in
     screen they have already satisfied. */
  if (needsAdmin && !session.isAdmin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    /* The content manager's previews — the home page at `/cms-preview` and the
       sign-in screen at `/cms-preview/login`. They sit outside /admin so that
       each renders with its own page's stylesheet alone rather than the panel's,
       but they are the coach's screens and are gated like the rest of them.

       `:path*` matches zero or more segments, so this one entry covers the bare
       `/cms-preview` and everything under it. It was an exact path before, which
       would have left `/cms-preview/login` unmatched — the page's own
       `requireAdminPage` would still have turned a stranger away, but the proxy
       is the first line and it should not have a gap in it. */
    "/cms-preview/:path*",
    "/dashboard/:path*",
    "/account/:path*",
    "/export-workout",
    "/export-profile",
    "/export-diet",
  ],
};
