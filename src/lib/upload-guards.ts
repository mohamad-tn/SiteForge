/**
 * Upload content guards — reject HTML masquerading as images; light JPEG EXIF strip.
 */

/** Reject HTML / SVG-as-HTML when claimed as raster image. */
export function looksLikeHtmlImage(mime: string, bytes: Buffer): boolean {
  if (!mime.startsWith("image/")) return false;
  if (mime === "image/svg+xml") return false; // handled separately
  const head = bytes.subarray(0, Math.min(256, bytes.length)).toString("utf8").toLowerCase();
  if (
    head.includes("<!doctype html") ||
    head.includes("<html") ||
    head.includes("<script") ||
    /^\s*<[a-z!?]/.test(head)
  ) {
    // Allow binary JPEG/PNG magic; only flag if no known image magic
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const isPng =
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
    const isWebp =
      bytes.length > 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;
    if (isJpeg || isPng || isGif || isWebp) return false;
    return true;
  }
  return false;
}

/**
 * Strip JPEG APP1 (EXIF) segments when present. Best-effort; returns original on failure.
 */
export function stripJpegExif(bytes: Buffer): Buffer {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  try {
    const out: number[] = [0xff, 0xd8];
    let i = 2;
    while (i + 3 < bytes.length) {
      if (bytes[i] !== 0xff) break;
      const marker = bytes[i + 1];
      if (marker === 0xda) {
        // SOS — copy rest
        for (let j = i; j < bytes.length; j++) out.push(bytes[j]);
        return Buffer.from(out);
      }
      if (marker === 0xd9) {
        out.push(0xff, 0xd9);
        return Buffer.from(out);
      }
      // Standalone markers
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        out.push(0xff, marker);
        i += 2;
        continue;
      }
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (len < 2 || i + 2 + len > bytes.length) break;
      // Skip APP1 (EXIF)
      if (marker !== 0xe1) {
        for (let j = i; j < i + 2 + len; j++) out.push(bytes[j]);
      }
      i += 2 + len;
    }
    if (out.length > 2) return Buffer.from(out);
  } catch {
    /* keep original */
  }
  return bytes;
}
