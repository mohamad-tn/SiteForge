import { describe, expect, it } from "vitest";
import { looksLikeHtmlImage, stripJpegExif } from "@/lib/upload-guards";

describe("upload guards", () => {
  it("rejects HTML-looking payloads without image magic", () => {
    const html = Buffer.from("<!DOCTYPE html><html><script>x</script></html>");
    expect(looksLikeHtmlImage("image/png", html)).toBe(true);
  });

  it("keeps real PNG magic", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(looksLikeHtmlImage("image/png", png)).toBe(false);
  });

  it("strips JPEG APP1 when present", () => {
    // minimal JPEG: SOI + APP1(len=4) + SOS-ish remainder
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x04, 0x00, 0x00, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9,
    ]);
    const out = stripJpegExif(jpeg);
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
    // APP1 should be gone
    expect(out.includes(0xe1)).toBe(false);
  });
});
