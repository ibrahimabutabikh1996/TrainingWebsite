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

import { safeMediaUrl } from "@/lib/richText";

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

/**
 * A thumbnail address for a picture the coach uploaded, safe to hand to `<img>`.
 *
 * The panel used to write `<img src={url}>` with the stored address exactly as
 * it came out of the bucket, in five places. That is what put a 9504x5346
 * photograph — fifty megapixels, two megabytes — into a 74-pixel box on the
 * content screen. The transfer is the smaller half of that cost: decoding fifty
 * megapixels allocates a couple of hundred megabytes of bitmap and does it on
 * the main thread, which is why the page felt slow rather than merely heavy.
 *
 * `optimizedSrc` already existed and the landing page already used it; the panel
 * simply never did. Same optimiser, same allow-list in `next.config.ts`, so no
 * new surface — this only asks for the size the box is actually drawn at.
 *
 * Falls back to the address it was given when `safeMediaUrl` refuses it, so a
 * picture that cannot be optimised still appears rather than disappearing. That
 * is the right way round here: this is a thumbnail in the coach's own panel, not
 * a value being interpolated into CSS, and the optimiser refuses anything it was
 * not told about regardless.
 */
export function previewSrc(url: string, width: number, quality = DEFAULT_QUALITY): string {
  const safe = safeMediaUrl(url);
  return safe ? optimizedSrc(safe, width, quality) : url;
}
