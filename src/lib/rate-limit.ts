/**
 * Best-effort in-memory rate limiter (single Node process).
 * Not a substitute for edge/WAF limits on multi-instance deploys.
 */

type Bucket = { n: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

/**
 * Sliding fixed-window counter.
 * @param key e.g. `login:ip:1.2.3.4` or `ai:user:abc`
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let row = buckets.get(key);
  if (!row || now >= row.resetAt) {
    row = { n: 0, resetAt: now + windowMs };
    buckets.set(key, row);
  }
  if (row.n >= max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((row.resetAt - now) / 1000)),
    };
  }
  row.n += 1;
  return {
    ok: true,
    remaining: Math.max(0, max - row.n),
    retryAfterSec: Math.max(1, Math.ceil((row.resetAt - now) / 1000)),
  };
}

/** Test helper — clears all buckets. */
export function resetRateLimitBuckets() {
  buckets.clear();
}

/** Client IP best-effort from proxy headers (Render / reverse proxy). */
export function clientIpFromRequest(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  return "unknown";
}
