import { describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitBuckets } from "@/lib/rate-limit";

describe("rate limit helper", () => {
  it("allows up to max then blocks", () => {
    resetRateLimitBuckets();
    expect(checkRateLimit("t:a", 2, 60_000).ok).toBe(true);
    expect(checkRateLimit("t:a", 2, 60_000).ok).toBe(true);
    expect(checkRateLimit("t:a", 2, 60_000).ok).toBe(false);
    expect(checkRateLimit("t:b", 2, 60_000).ok).toBe(true);
  });
});
