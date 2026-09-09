import { describe, expect, it } from "vitest";
import { sanitizeCustomCss } from "@/lib/sanitize-css";
import { sanitizeBlockCss } from "@/lib/block-style";

describe("sanitizeCustomCss", () => {
  it("strips @import and javascript URLs", () => {
    const raw = `@import url("https://evil"); .x { background: url(javascript:alert(1)); }`;
    const out = sanitizeCustomCss(raw);
    expect(out.toLowerCase()).not.toContain("@import");
    expect(out.toLowerCase()).not.toContain("javascript:");
    expect(out).toContain("/* blocked */");
  });

  it("strips script tags and control chars", () => {
    const raw = "body{}\u0000</script><script>alert(1)</script>";
    const out = sanitizeCustomCss(raw);
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out).not.toMatch(/\u0000/);
  });

  it("returns empty for nullish", () => {
    expect(sanitizeCustomCss(null)).toBe("");
    expect(sanitizeCustomCss(undefined)).toBe("");
  });

  it("caps length at 20k", () => {
    const raw = "a".repeat(25000);
    expect(sanitizeCustomCss(raw).length).toBeLessThanOrEqual(20000);
  });
});

describe("sanitizeBlockCss", () => {
  it("blocks expression()", () => {
    const out = sanitizeBlockCss("width: expression(alert(1));");
    expect(out.toLowerCase()).not.toContain("expression(");
  });
});
