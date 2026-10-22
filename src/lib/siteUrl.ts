/**
 * The site's public address, without a trailing slash. Read by the metadata,
 * the sitemap and robots.txt, which all need absolute URLs.
 *
 * `NEXT_PUBLIC_SITE_URL` overrides it — for a preview deployment, say — and the
 * production domain is the fallback so a missing variable never yields
 * `localhost` links in what Google indexes.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.ibrahimabutabikh.com"
).replace(/\/+$/, "");
