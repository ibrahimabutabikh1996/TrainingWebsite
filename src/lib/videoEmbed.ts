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

  return safe;
}
