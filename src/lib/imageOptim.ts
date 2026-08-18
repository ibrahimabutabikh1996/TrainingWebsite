/* Addresses for Next's image optimiser, for the pictures the coach uploads.
 *
 * The content manager stores whatever came out of the camera and every page
 * served it untouched: a phone asking for the landing page fetched five
 * originals — 4224x5280, 5510x5510, two of 6000x4000 — to paint them into boxes
 * about 330 CSS pixels wide. Eight megabytes over a mobile connection for what
 * fits in a few hundred kilobytes.
 *
 * `/_next/image` is already part of the framework: it fetches the original once,
 * re-encodes it to the requested width (WebP or AVIF where the browser says so),
 * and caches the result. The host has to be named in `next.config.ts` first —
 * an address it was not told about is refused, which is what stops the endpoint
 * from becoming an open image proxy for the whole internet.
 *
 * Only the widths below may be asked for: `w` is checked against the
 * `deviceSizes`/`imageSizes` lists and anything else comes back a 400. Keep this
 * file and that config in step.
 */

/** Requestable widths — the union of Next's default `imageSizes`/`deviceSizes`. */
const ALLOWED_WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];

/** Photographs, not line art: 70 holds up and is a third off the default. */
const DEFAULT_QUALITY = 70;

function nearestAllowed(width: number): number {
  return ALLOWED_WIDTHS.find((w) => w >= width) ?? ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1];
}

/**
 * One optimised address. `url` must already have been through `safeMediaUrl` —
 * this only encodes, it does not judge.
 */
export function optimizedSrc(url: string, width: number, quality = DEFAULT_QUALITY): string {
  return `/_next/image?url=${encodeURIComponent(url)}&w=${nearestAllowed(width)}&q=${quality}`;
}

/**
 * A `srcset` across the widths a phone, a tablet and a desktop actually need.
 * Paired with a `sizes` attribute the browser picks one and downloads nothing
 * else — which is the whole point, since the phone's choice is the small one.
 */
export function optimizedSrcSet(
  url: string,
  widths: number[] = [384, 640, 828, 1080],
  quality = DEFAULT_QUALITY
): string {
  return widths.map((w) => `${optimizedSrc(url, w, quality)} ${nearestAllowed(w)}w`).join(", ");
}

/**
 * The same address wrapped for CSS. Single quotes match the rest of the
 * stylesheet and cannot appear inside the value — `safeMediaUrl` rejects a URL
 * carrying one, and everything added here is percent-encoded.
 */
export function optimizedCssUrl(url: string, width: number, quality = DEFAULT_QUALITY): string {
  return `url('${optimizedSrc(url, width, quality)}')`;
}
