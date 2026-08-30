/**
 * Turns a video page URL (Google Drive "view" link, YouTube watch/share link, …)
 * into the matching iframe-embeddable URL, so exercise videos can play inline
 * instead of sending the coach to another tab. Falls back to the original URL
 * for anything already embeddable (e.g. a direct .mp4) or unrecognized.
 */
/**
 * The URL if it is one a browser may be pointed at, otherwise null.
 *
 * `exercises.video_url` is stored by the panel and then rendered on the
 * trainee's dashboard — as the `href` of a link and as the `src` of an embed.
 * Nothing checked it at either end, so `javascript:...` in that column was a
 * script that ran in a trainee's session on click: an admin-writable field
 * reaching other people's sessions.
 *
 * Only http and https. A protocol-relative `//host/path` is refused too — it
 * inherits the page's scheme and is not something a video link needs.
 */
export function safeVideoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("//")) return null;

  try {
    /* A base is supplied so this works during server rendering, where there is
       no document to resolve against. It only affects relative input, which the
       protocol test below then rejects anyway. */
    const parsed = new URL(trimmed, "https://placeholder.invalid");
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.hostname === "placeholder.invalid") return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function getEmbedUrl(url: string): string | null {
  const safe = safeVideoUrl(url);
  if (!safe) return null;

  const drive = safe.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;

  const youtube =
    safe.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]+)/);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;

  /* Vimeo and Instagram were recognised on the trainee's dashboard and nowhere
     else — that page carried its own copy of this translation, which is how
     the two drifted apart. Neither host frames its own page URL: Vimeo answers
     a watch link with an X-Frame-Options that forbids it, and Instagram serves
     a login wall. So a link either becomes a player address here or it does not
     play at all, which is what the panel's two libraries were doing with one.

     Matched on the parsed hostname rather than on a substring of the whole
     address, so a path that merely contains the name is not mistaken for the
     host. */
  const host = hostnameOf(safe);

  if (host === "vimeo.com" || host === "www.vimeo.com") {
    const vimeo = safe.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  }

  if (host === "instagram.com" || host === "www.instagram.com") {
    const post = safe.match(/instagram\.com\/(p|reel)\/([\w-]+)/);
    if (post) return `https://www.instagram.com/${post[1]}/${post[2]}/embed`;
  }

  return safe;
}

/** The hostname of an address already known to be http(s), or null. */
function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Whether the address is a media file the browser can play by itself.
 *
 * A `<video>` element handles these natively, so there is nothing for an
 * iframe to add — the trainee's dashboard already made this distinction and
 * the panel's two libraries did not, which meant the same `.mp4` was a real
 * player on one screen and a framed document on another.
 *
 * The query string is dropped before the extension is read: a signed storage
 * URL carries its parameters after the filename.
 */
export function isDirectMediaUrl(url: string): boolean {
  const safe = safeVideoUrl(url);
  if (!safe) return false;
  return /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(safe.split("?")[0].split("#")[0]);
}

/**
 * The file id inside a Google Drive link, or null for anything else.
 *
 * Both shapes the coach can paste are recognised: the share link
 * `/file/d/<id>/view?usp=...` and the older `?id=<id>` query form. The path
 * pattern stops at `?` and `#` as well as `/`, so a link with the id as its
 * last segment does not carry the query string into the id.
 *
 * Separate from `getEmbedUrl` on purpose — that function answers "what may be
 * framed", and this one answers "is this a Drive file, and which", which is
 * what the player needs before it can reach for a poster or a stream.
 */
export function driveFileId(url: string): string | null {
  const safe = safeVideoUrl(url);
  if (!safe) return null;

  const path = safe.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (path) return path[1];

  try {
    const parsed = new URL(safe);
    if (parsed.hostname !== "drive.google.com") return null;
    const id = parsed.searchParams.get("id");
    return id || null;
  } catch {
    return null;
  }
}

/* There is no `driveStreamUrl` here, and this note is why nobody should add
 * one back.
 *
 * `https://drive.usercontent.google.com/download?id=…` does serve the file —
 * it answers 200 with `Content-Type: video/mp4`, honours range requests, and
 * fetches perfectly from curl. It cannot be played by this site, and the
 * reason is not the sharing setting or the file:
 *
 *     Cross-Origin-Resource-Policy: same-site
 *
 * Google sets that on every response from that host. It instructs the browser
 * to refuse the resource to any document that is not same-site with Drive,
 * which this site never is. A `<video>` pointed at it fails with
 * MEDIA_ERR_SRC_NOT_SUPPORTED — code 4, "Format error" — which reads like a
 * codec problem and is not one; the file is H.264/AAC and plays fine once it
 * reaches the machine. curl does not enforce CORP, so the address tests clean
 * from a terminal and fails in every browser. That combination is what makes
 * this worth writing down.
 *
 * Framing `/preview` is Google's supported route and the only one available to
 * a third-party site. Serving the bytes from this origin instead would work —
 * the browser's objection is to Drive's headers, not to the file — but it means
 * proxying the video through this app, which is a bandwidth decision and not a
 * detail to slip into a helper. */

/**
 * A still from a Drive video, used as the player's poster.
 *
 * This is the frame that stands in for the black box, and it is the one Drive
 * address a browser on another site may actually load: unlike the download
 * host above, this one answers `Access-Control-Allow-Origin: *` and sets no
 * Cross-Origin-Resource-Policy. If Drive has no thumbnail for a file the image
 * simply fails to load and the player's own backdrop shows through — still not
 * a black screen.
 *
 * `w640` rather than a larger size deliberately. These are portrait clips
 * filmed on a phone, so `w1280` returns the full 1080x1920 frame at nearly a
 * megabyte — for a still that is displayed a few hundred pixels wide, and on
 * the dashboard is one of however many exercises the day holds.
 */
export function drivePosterUrl(id: string): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w640`;
}
