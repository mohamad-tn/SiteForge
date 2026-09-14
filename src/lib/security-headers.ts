/**
 * Baseline HTTP security headers for Next.js `headers()`.
 * Honest limits: CSP cannot block every XSS/CSS abuse; HSTS needs HTTPS (Render).
 * Not a pentest substitute — see STATUS.txt.
 */

export type SecurityHeader = { key: string; value: string };

/** CSP that keeps Next.js + editor inline styles + media + sandboxed preview iframes working. */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Next.js / React hydration often needs inline; Monaco-like editors use workers/eval in some setups.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // AI provider calls are server-side — browser only talks to same origin.
  "connect-src 'self'",
  "media-src 'self' data: blob: https:",
  // CSS preview iframe (sandbox) + same-origin embeds
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

export function getSecurityHeaders(): SecurityHeader[] {
  return [
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    },
    { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ];
}
