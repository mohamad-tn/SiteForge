/** 1×1 transparent PNG — used when media is missing so clients never throw. */
export const TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function transparentPngResponse(status = 404): Response {
  const buf = Buffer.from(TRANSPARENT_PNG_BASE64, "base64");
  return new Response(buf, {
    status,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=60",
      "Content-Length": String(buf.length),
      "X-SiteForge-Media": "placeholder",
    },
  });
}
