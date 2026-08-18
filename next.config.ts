import type { NextConfig } from "next";

/* Sent on every response. Each of these was absent, and the absences show up
   only in the cases they exist to cover.

   HSTS is the one that matters most on a site people sign in to. Without it the
   first visit of the day — someone typing the bare domain, or following an old
   http:// link — travels in the clear and can be answered by anyone on the
   network before the redirect to HTTPS ever happens. With it, the browser
   refuses to make that request at all for the next year. It is ignored over
   plain HTTP, so it costs nothing in development.

   `preload` is deliberately not set: it hands the domain to a browser-shipped
   list that takes months to get out of, and it is not something to opt into as
   a side effect of a header cleanup. Add it once the header has been running in
   production for a while.

   frame-ancestors is expressed twice on purpose — X-Frame-Options for the
   older browsers that only understand that, and the CSP directive that
   supersedes it for the rest. Scoped to framing alone: a full content policy
   is worth having, but it needs to be built against what the pages actually
   load, and guessing at one is how a site ships with its own stylesheets
   blocked. */
const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  /* Stops a browser second-guessing a Content-Type — an uploaded file served as
     text/plain must not be executed because it happens to start like a script. */
  { key: "X-Content-Type-Options", value: "nosniff" },
  /* Nothing here should ever be framed; the panel and the dashboard both act on
     a single click, which is exactly what clickjacking needs. */
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  /* Trainee ids and profile ids travel in query strings on the export pages.
     The default policy would put the full address in the Referer of anything
     those pages load. */
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  /* The site asks for none of these. Saying so stops an embedded document
     asking on its behalf. */
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

/* The one remote host whose images may be re-encoded by `/_next/image`.
 *
 * Read from the environment rather than written out, so the optimiser follows
 * the project the rest of the app is pointed at instead of a URL copied into a
 * second place. A wildcard over `*.supabase.co` would have been shorter and
 * would also have turned this site's optimiser into a free image CDN for every
 * other project on the platform.
 *
 * If the variable is missing at build time the pattern is simply absent and the
 * optimiser refuses those addresses — the pictures fall back to nothing rather
 * than to something unchecked. */
const supabaseImageHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      ...(supabaseImageHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseImageHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      /* The stock photographs the markup falls back to when the coach has not
         uploaded one of their own. */
      { protocol: "https" as const, hostname: "images.unsplash.com" },
    ],
    /* Both are markedly smaller than JPEG at the same quality; the browser is
       served whichever it says it accepts, and the original otherwise. */
    formats: ["image/avif", "image/webp"],

    /* The quality values the optimiser will serve. Next 16 refuses any `q` not
       listed here and defaults the list to `[75]` alone — so this key being
       absent was not a missing optimisation, it was every image on the site
       failing to load. `/_next/image?...&q=70` answered
       `"q" parameter (quality) of 70 is not allowed` with a 400, for remote
       photographs and for the logo in `public/` alike, and each `<img>` fell
       back to its alt text.
     *
     * 70 is what `src/lib/imageOptim.ts` asks for, deliberately — see
     * DEFAULT_QUALITY there, and the note in that file's header saying to keep
     * it and this config in step. This is that step.
     *
     * 75 is Next's own default, and it is listed even though nothing requests
     * it today. The app builds every optimiser URL by hand and uses none of
     * next/image's component, so the first person to reach for `<Image>` would
     * ask at 75 and walk into this exact wall. A quality only becomes a cache
     * variant once something actually asks for it, so carrying it costs nothing.
     *
     * Changing DEFAULT_QUALITY to a third value without adding it here breaks
     * every image again — silently, and only in a way a production build
     * shows. `next dev` is the more forgiving of the two, which is how this
     * went unnoticed. */
    qualities: [70, 75],
    /* These are photographs of a coach and a gym, not a feed — a month is a
       reasonable floor before the optimiser re-fetches an original. */
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  /* `X-Powered-By: Next.js` on every response names the stack for anyone
     deciding which exploits to try first. It buys nothing. */
  poweredByHeader: false,

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
      /* Every one of these answers with something belonging to one signed-in
         person — a profile, a training log, a diet plan, a rendered PDF. None
         of it may be held by a shared cache or replayed from a browser's back
         /forward cache to whoever is at the keyboard next. Without an explicit
         header these responses carry no caching instruction at all, which
         leaves the decision to heuristics. */
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      // Files under public/ are served with `Cache-Control: public, max-age=0` by
      // default, so every visit re-validates the 357 KB icon font over the network.
      // The font filenames carry their version, so they can be cached permanently —
      // if a font file is ever replaced, rename it rather than overwriting it.
      {
        source: '/fonts/:file*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
