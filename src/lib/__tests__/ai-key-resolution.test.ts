import { describe, expect, it } from "vitest";

/**
 * Resolution order contract (mirrored for unit coverage without DB):
 * 1) user enabled + decrypted key → source user, no platform quota
 * 2) else platform enabled + key → source platform + quota
 * 3) else unavailable
 */
function resolveKeyMock(input: {
  user?: { enabled: boolean; hasKey: boolean };
  platform?: { enabled: boolean; hasKey: boolean };
}): { available: boolean; source: "user" | "platform" | null; usePlatformQuota: boolean } {
  if (input.user?.enabled && input.user.hasKey) {
    return { available: true, source: "user", usePlatformQuota: false };
  }
  if (input.platform?.enabled && input.platform.hasKey) {
    return { available: true, source: "platform", usePlatformQuota: true };
  }
  return { available: false, source: null, usePlatformQuota: false };
}

describe("AI key resolution order", () => {
  it("prefers personal key", () => {
    const r = resolveKeyMock({
      user: { enabled: true, hasKey: true },
      platform: { enabled: true, hasKey: true },
    });
    expect(r).toEqual({ available: true, source: "user", usePlatformQuota: false });
  });

  it("falls back to platform", () => {
    const r = resolveKeyMock({
      user: { enabled: false, hasKey: true },
      platform: { enabled: true, hasKey: true },
    });
    expect(r.source).toBe("platform");
    expect(r.usePlatformQuota).toBe(true);
  });

  it("unavailable when neither", () => {
    expect(resolveKeyMock({}).available).toBe(false);
  });
});
