/* A second opinion on whether an "image" is really an image.
 *
 * Magic bytes prove the first few bytes look right. They do not prove there is a
 * picture behind them: `FFD8FF` followed by a megabyte of anything is a valid
 * JPEG signature attached to nothing, and it would pass `detectFileType` happily.
 *
 * This walks far enough into the container to find the header that states the
 * dimensions. Reaching it means the structure is real — a coherent frame header
 * for JPEG, an IHDR chunk for PNG, a VP8 header for WebP. It is not a full
 * decode, deliberately: decoding attacker-supplied images is where image
 * libraries get their CVEs, and a decompression bomb is a hostile file that
 * decodes perfectly. Reading a header cannot be made to allocate anything.
 *
 * Formats it cannot speak for (HEIC, PDF) come back `unknown`, and the caller
 * decides. Refusing HEIC would refuse most photos an iPhone produces.
 */

export type ProbeResult =
  | { kind: "image"; width: number; height: number }
  | { kind: "unknown" }
  | { kind: "invalid"; reason: string };

/** Beyond this, a header is not a header — it is a file pretending to have one. */
const MAX_DIMENSION = 30_000;

function plausible(width: number, height: number): boolean {
  return (
    Number.isInteger(width) && Number.isInteger(height) &&
    width > 0 && height > 0 &&
    width <= MAX_DIMENSION && height <= MAX_DIMENSION
  );
}

function probePng(bytes: Uint8Array): ProbeResult {
  /* Signature (8) + length (4) + "IHDR" (4) + width (4) + height (4). */
  if (bytes.length < 24) return { kind: "invalid", reason: "truncated PNG header" };
  if (String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR") {
    return { kind: "invalid", reason: "PNG without an IHDR chunk" };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return plausible(width, height)
    ? { kind: "image", width, height }
    : { kind: "invalid", reason: "implausible PNG dimensions" };
}

function probeJpeg(bytes: Uint8Array): ProbeResult {
  /* Walk the marker chain to a Start-Of-Frame segment, which carries the size.
     Bounded by the buffer, so a malformed chain ends the loop rather than
     spinning in it. */
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return { kind: "invalid", reason: "broken JPEG marker chain" };

    const marker = bytes[offset + 1];
    /* Padding between segments. */
    if (marker === 0xff) { offset++; continue; }
    /* Standalone markers carry no length. */
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) return { kind: "invalid", reason: "invalid JPEG segment length" };

    /* SOF0..SOF15, excluding the DHT/JPG/DAC markers interleaved in that range. */
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

    if (isFrameHeader) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return plausible(width, height)
        ? { kind: "image", width, height }
        : { kind: "invalid", reason: "implausible JPEG dimensions" };
    }

    /* Start of scan: pixel data follows, no frame header will appear after it. */
    if (marker === 0xda) break;

    offset += 2 + length;
  }
  return { kind: "invalid", reason: "JPEG with no frame header" };
}

function probeWebp(bytes: Uint8Array): ProbeResult {
  if (bytes.length < 30) return { kind: "invalid", reason: "truncated WebP header" };
  const chunk = String.fromCharCode(...bytes.subarray(12, 16));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (chunk === "VP8X") {
    const width = 1 + ((bytes[24]) | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + ((bytes[27]) | (bytes[28] << 8) | (bytes[29] << 16));
    return plausible(width, height)
      ? { kind: "image", width, height }
      : { kind: "invalid", reason: "implausible WebP dimensions" };
  }
  if (chunk === "VP8 ") {
    const width = view.getUint16(26, true) & 0x3fff;
    const height = view.getUint16(28, true) & 0x3fff;
    return plausible(width, height)
      ? { kind: "image", width, height }
      : { kind: "invalid", reason: "implausible WebP dimensions" };
  }
  if (chunk === "VP8L") {
    const bits = view.getUint32(21, true);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return plausible(width, height)
      ? { kind: "image", width, height }
      : { kind: "invalid", reason: "implausible WebP dimensions" };
  }
  return { kind: "invalid", reason: "WebP without a recognised chunk" };
}

function probeGif(bytes: Uint8Array): ProbeResult {
  if (bytes.length < 10) return { kind: "invalid", reason: "truncated GIF header" };
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  return plausible(width, height)
    ? { kind: "image", width, height }
    : { kind: "invalid", reason: "implausible GIF dimensions" };
}

/**
 * Reads the structural header of `type` out of `bytes` (the first few KB of the
 * object are enough).
 */
export function probeImage(type: string, bytes: Uint8Array): ProbeResult {
  switch (type) {
    case "png": return probePng(bytes);
    case "jpeg": return probeJpeg(bytes);
    case "webp": return probeWebp(bytes);
    case "gif": return probeGif(bytes);
    /* HEIC is a box structure whose dimensions sit behind an item-properties
       tree; parsing it properly is a project of its own, and refusing it would
       refuse most iPhone photos. The magic-byte check stands alone for these. */
    default: return { kind: "unknown" };
  }
}
