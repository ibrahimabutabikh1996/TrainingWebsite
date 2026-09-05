import { INTAKE_MAX_BYTES } from "@/lib/uploadFields";

/* What may be uploaded, and what it is really made of.
 *
 * Both upload paths — the registration form and the content manager — took
 * whatever they were handed: any type, any size, any number of files, straight
 * into a public storage bucket, under a name derived from the one the browser
 * sent. That is free file hosting for anyone who can post a form, and an `.html`
 * or `.svg` landing in a bucket on a public URL is a phishing page or a script
 * with a legitimate-looking address.
 *
 * The rules here are applied server-side, and the type is read from the file's
 * own leading bytes rather than from its name or from the `Content-Type` the
 * browser claimed. Both of those are the caller's to invent; the bytes are not.
 *
 * SVG is deliberately absent from every allowlist. It is a document, not an
 * image — it can carry script, and served from the bucket's own origin that
 * script would run there. Nothing in this project needs to upload one.
 */

/** Formats this project actually uses. Anything not on this list has no signature. */
export type DetectedType =
  | "jpeg" | "png" | "webp" | "gif" | "heic"
  | "pdf"
  | "mp4" | "quicktime" | "webm"
  | "mp3" | "m4a" | "ogg" | "wav";

interface Signature {
  type: DetectedType;
  mime: string;
  extension: string;
  /** Byte-for-byte match, `null` meaning "any byte here". */
  magic: (number | null)[];
  offset?: number;
}

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

/* Ordered so the more specific `ftyp` brands are tested before anything that
   could also match them. */
const SIGNATURES: Signature[] = [
  { type: "jpeg", mime: "image/jpeg", extension: "jpg", magic: [0xff, 0xd8, 0xff] },
  { type: "png", mime: "image/png", extension: "png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "gif", mime: "image/gif", extension: "gif", magic: ascii("GIF8") },
  { type: "pdf", mime: "application/pdf", extension: "pdf", magic: ascii("%PDF-") },
  { type: "webm", mime: "video/webm", extension: "webm", magic: [0x1a, 0x45, 0xdf, 0xa3] },
  { type: "ogg", mime: "audio/ogg", extension: "ogg", magic: ascii("OggS") },
  { type: "mp3", mime: "audio/mpeg", extension: "mp3", magic: ascii("ID3") },
  { type: "mp3", mime: "audio/mpeg", extension: "mp3", magic: [0xff, 0xfb] },
  { type: "mp3", mime: "audio/mpeg", extension: "mp3", magic: [0xff, 0xf3] },
];

/* RIFF containers and ISO-BMFF (`ftyp`) boxes share a prefix across several
   formats, so the brand four bytes in decides which one it is. */
const RIFF_BRANDS: Record<string, { type: DetectedType; mime: string; extension: string }> = {
  WEBP: { type: "webp", mime: "image/webp", extension: "webp" },
  WAVE: { type: "wav", mime: "audio/wav", extension: "wav" },
};

const FTYP_BRANDS: Record<string, { type: DetectedType; mime: string; extension: string }> = {
  /* iPhones hand over HEIC for an ordinary photo, so refusing it would refuse
     most of the body photos the form exists to collect. */
  heic: { type: "heic", mime: "image/heic", extension: "heic" },
  heix: { type: "heic", mime: "image/heic", extension: "heic" },
  hevc: { type: "heic", mime: "image/heic", extension: "heic" },
  mif1: { type: "heic", mime: "image/heif", extension: "heic" },
  msf1: { type: "heic", mime: "image/heif", extension: "heic" },
  isom: { type: "mp4", mime: "video/mp4", extension: "mp4" },
  iso2: { type: "mp4", mime: "video/mp4", extension: "mp4" },
  mp41: { type: "mp4", mime: "video/mp4", extension: "mp4" },
  mp42: { type: "mp4", mime: "video/mp4", extension: "mp4" },
  avc1: { type: "mp4", mime: "video/mp4", extension: "mp4" },
  "qt  ": { type: "quicktime", mime: "video/quicktime", extension: "mov" },
  M4A: { type: "m4a", mime: "audio/mp4", extension: "m4a" },
  M4V: { type: "mp4", mime: "video/mp4", extension: "mp4" },
};

export interface DetectedFile {
  type: DetectedType;
  /** The type to store the object under — read from the bytes, not from the request. */
  mime: string;
  /** The canonical extension for that type. The submitted name is never reused. */
  extension: string;
}

function readAscii(bytes: Uint8Array, start: number, length: number): string {
  let out = "";
  for (let i = start; i < start + length && i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

/** What the leading bytes say this is, or null for anything unrecognised. */
export function detectFileType(bytes: Uint8Array): DetectedFile | null {
  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (bytes.length < offset + sig.magic.length) continue;
    if (sig.magic.every((b, i) => b === null || bytes[offset + i] === b)) {
      return { type: sig.type, mime: sig.mime, extension: sig.extension };
    }
  }

  if (readAscii(bytes, 0, 4) === "RIFF") {
    const brand = RIFF_BRANDS[readAscii(bytes, 8, 4)];
    if (brand) return brand;
  }

  if (readAscii(bytes, 4, 4) === "ftyp") {
    const raw = readAscii(bytes, 8, 4);
    /* Brands are padded to four characters; `M4A ` and `M4A` are the same box. */
    const brand = FTYP_BRANDS[raw] ?? FTYP_BRANDS[raw.trim()];
    if (brand) return brand;
  }

  return null;
}

const MB = 1024 * 1024;

export interface UploadRule {
  /** Which detected types this field accepts. */
  allowed: readonly DetectedType[];
  maxBytes: number;
  maxFiles: number;
  maxTotalBytes: number;
}

const PHOTO_TYPES = ["jpeg", "png", "webp", "gif", "heic"] as const;

/** Registration attachments: photos of a body, a lab report, a previous plan. */
export const INTAKE_RULE: UploadRule = {
  allowed: [...PHOTO_TYPES, "pdf"],
  /* Read from `@/lib/uploadFields` because the browser needs this same number
     before it asks the server for a slot — see the note there. */
  maxBytes: INTAKE_MAX_BYTES,
  maxFiles: 10,
  maxTotalBytes: 40 * MB,
};

/** The whole submission, across every field, so ten fields cannot each take 40 MB. */
export const INTAKE_TOTAL_BYTES = 60 * MB;

/** The content manager: page imagery, plus video and audio for testimonials. */
export const CMS_MEDIA_RULE: UploadRule = {
  allowed: [...PHOTO_TYPES, "mp4", "quicktime", "webm", "mp3", "m4a", "ogg", "wav"],
  maxBytes: 50 * MB,
  maxFiles: 1,
  maxTotalBytes: 50 * MB,
};

export type UploadCheck =
  | { ok: true; file: DetectedFile; bytes: Buffer }
  | { ok: false; error: string };

function megabytes(bytes: number): string {
  return `${Math.round(bytes / MB)} ميغابايت`;
}

/**
 * Reads one file, decides what it is, and refuses it if it is not on the list.
 *
 * Size is checked before the bytes are read, so an oversized upload is turned
 * away rather than pulled into memory first.
 */
export async function checkUpload(file: File, rule: UploadRule): Promise<UploadCheck> {
  if (file.size === 0) {
    return { ok: false, error: "الملف فارغ" };
  }
  if (file.size > rule.maxBytes) {
    return { ok: false, error: `حجم الملف يتجاوز الحد المسموح (${megabytes(rule.maxBytes)})` };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectFileType(new Uint8Array(bytes.subarray(0, 32)));

  if (!detected) {
    return { ok: false, error: "نوع الملف غير معروف أو غير مدعوم" };
  }
  if (!rule.allowed.includes(detected.type)) {
    return { ok: false, error: "نوع الملف غير مسموح به" };
  }

  return { ok: true, file: detected, bytes };
}

/** Checks a whole field at once: count first, then each file, then the total. */
export async function checkUploadGroup(
  files: File[],
  rule: UploadRule
): Promise<{ ok: true; checked: Array<{ file: DetectedFile; bytes: Buffer }> } | { ok: false; error: string }> {
  if (files.length > rule.maxFiles) {
    return { ok: false, error: `عدد الملفات يتجاوز الحد المسموح (${rule.maxFiles})` };
  }

  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > rule.maxTotalBytes) {
    return { ok: false, error: `الحجم الكلي للملفات يتجاوز الحد المسموح (${megabytes(rule.maxTotalBytes)})` };
  }

  const checked: Array<{ file: DetectedFile; bytes: Buffer }> = [];
  for (const file of files) {
    const result = await checkUpload(file, rule);
    if (!result.ok) return result;
    checked.push({ file: result.file, bytes: result.bytes });
  }
  return { ok: true, checked };
}

/**
 * A name for the stored object, built here rather than taken from the caller.
 *
 * The old helper kept the submitted extension, so `report.pdf.html` stayed an
 * `.html` in a public bucket. Nothing of the original name survives: the prefix
 * says which field it came from, the random part keeps two uploads apart, and
 * the extension comes from what the bytes turned out to be.
 */
export function storageFilename(prefix: string, detected: DetectedFile): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "file";
  const unique = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  return `${safePrefix}_${unique}.${detected.extension}`;
}
