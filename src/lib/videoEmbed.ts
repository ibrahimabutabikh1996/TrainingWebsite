/**
 * Turns a video page URL (Google Drive "view" link, YouTube watch/share link, …)
 * into the matching iframe-embeddable URL, so exercise videos can play inline
 * instead of sending the coach to another tab. Falls back to the original URL
 * for anything already embeddable (e.g. a direct .mp4) or unrecognized.
 */
export function getEmbedUrl(url: string): string {
  const trimmed = url.trim();

  const drive = trimmed.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;

  const youtube =
    trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]+)/);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;

  return trimmed;
}
