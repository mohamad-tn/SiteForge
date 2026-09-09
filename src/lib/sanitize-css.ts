/**
 * Custom CSS trust model
 * ----------------------
 * Site owners may inject CSS that renders on their published tenant pages
 * (`/s/[slug]`). CSS is not a sandbox: a malicious or compromised account
 * can still restyle the tenant document (clickjacking-style overlays within
 * the page, font loads, etc.). We therefore:
 *
 * 1. Strip high-risk constructs (@import, expression(), javascript:/vbscript:
 *    URLs, -moz-binding, behavior, @charset remote tricks, HTML tags).
 * 2. Cap length (see API schema max 20k).
 * 3. Scope guidance: authors should target `.sf-tenant-root …` so styles stay
 *    inside the published site shell (chrome controls are outside that root).
 * 4. Treat custom CSS as a **power-user, trusted-tenant** feature — not safe
 *    for arbitrary untrusted multi-tenant input without further isolation
 *    (iframe sandbox / CSSOM allowlist) in a future hardening pass.
 *
 * This sanitizer reduces XSS / remote-code vectors; it does not make CSS
 * "safe" against visual abuse of the owner's own page.
 */

const DANGEROUS =
  /@import\b|@charset\b|expression\s*\(|-moz-binding\b|behavior\s*:|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|<\/?script|<\/?iframe|<\/?object|<\/?embed|<\/?link|<\/?style|<\/?meta|url\s*\(\s*['"]?\s*javascript:|url\s*\(\s*['"]?\s*vbscript:/gi;

/** Remove control chars that can break out of a <style> context oddly. */
function stripControls(input: string): string {
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

/**
 * Sanitize owner-supplied CSS before persistence and before injection.
 * Returns cleaned CSS (may be empty).
 */
export function sanitizeCustomCss(raw: string | null | undefined): string {
  if (!raw) return "";
  let css = stripControls(String(raw));
  // Collapse HTML comments / CDATA-ish breakouts
  css = css.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, "");
  // Strip dangerous constructs (repeat until stable for nested tricks)
  let prev = "";
  let guard = 0;
  while (css !== prev && guard < 8) {
    prev = css;
    css = css.replace(DANGEROUS, "/* blocked */");
    guard += 1;
  }
  // Soft length clamp (API also enforces)
  if (css.length > 20000) css = css.slice(0, 20000);
  return css.trim();
}

export const CUSTOM_CSS_TRUST_BLURB_AR =
  "ميزة متقدمة للمستأجر الموثوق. نُصفّي @import وexpression وروابط javascript وغيرها، لكن CSS يبقى قادراً على إعادة تنسيق صفحة موقعك. استهدف .sf-tenant-root. معاينة iframe sandbox في الإعدادات تساعد على التجربة بأمان نسبي. ليس بيئة معزولة بالكامل.";

export const CUSTOM_CSS_TRUST_BLURB_EN =
  "Power-user / trusted-tenant feature. We strip @import, expression(), javascript: URLs, and similar XSS vectors, but CSS can still restyle your published page. Prefer selectors under .sf-tenant-root. Site settings include an iframe sandbox preview (no scripts). Not a full sandbox.";
