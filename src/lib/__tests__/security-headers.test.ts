import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { CONTENT_SECURITY_POLICY, getSecurityHeaders } from "@/lib/security-headers";

describe("security headers", () => {
  it("exports baseline headers including HSTS and CSP", () => {
    const headers = getSecurityHeaders();
    const map = Object.fromEntries(headers.map((h) => [h.key, h.value]));
    expect(map["Strict-Transport-Security"]).toMatch(/max-age=\d+/);
    expect(map["X-Content-Type-Options"]).toBe("nosniff");
    expect(map["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(map["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(map["Permissions-Policy"]).toMatch(/camera=\(\)/);
    expect(map["Cross-Origin-Opener-Policy"]).toBe("same-origin-allow-popups");
    expect(map["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("img-src 'self' data: blob: https:");
    expect(CONTENT_SECURITY_POLICY).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("wires headers() in next.config.ts", () => {
    const cfg = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(cfg).toContain("getSecurityHeaders");
    expect(cfg).toContain("headers()");
  });
});
