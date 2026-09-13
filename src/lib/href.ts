/**
 * Safe URL normalization for block/nav/button hrefs.
 * Prevents bare hosts like `www.google.com` from resolving as relative
 * paths under `/editor/.../preview`.
 */

const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

const DANGEROUS_SCHEME =
  /^(javascript|data|vbscript|file|blob|about|chrome|chrome-extension):/i;

/** True when href is absolute http(s) after normalization. */
export function isExternalHttpHref(href: string): boolean {
  const h = (href || "").trim().toLowerCase();
  return h.startsWith("http://") || h.startsWith("https://");
}

/**
 * Normalize a user-entered or stored href for safe navigation.
 *
 * - Trim; empty → `#`
 * - Allow `http:`, `https:`, `mailto:`, `tel:`, `/path`, `#hash`, `?query`
 * - Protocol-relative `//host` → `https://host`
 * - Bare hostname / `www.` / `host/path` → `https://…`
 * - Single-word slug without a dot (e.g. `about`) left as-is (not a domain)
 * - Dangerous schemes → `#`
 */
export function normalizeHref(raw: unknown): string {
  if (raw == null) return "#";
  const trimmed = String(raw).trim();
  if (!trimmed) return "#";

  // Protocol-relative (must run before absolute-path `/` check)
  if (trimmed.startsWith("//")) {
    const rest = trimmed.slice(2);
    if (!rest || /\s/.test(rest)) return "#";
    return `https://${rest}`;
  }

  // Hash / query / absolute path — keep as-is (path may include query/hash)
  if (trimmed.startsWith("#") || trimmed.startsWith("?") || trimmed.startsWith("/")) {
    return trimmed;
  }

  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed);
  if (schemeMatch) {
    const scheme = `${schemeMatch[1].toLowerCase()}:`;
    if (DANGEROUS_SCHEME.test(trimmed)) return "#";
    if (SAFE_SCHEMES.has(scheme)) return trimmed;
    // Unknown schemes (e.g. ftp:) — block to be safe
    return "#";
  }

  // Bare host / www. / host/path (must contain a dot or start with www.)
  // Do NOT treat single-word slugs like `about` as domains.
  const hostish = trimmed.split(/[/?#]/)[0] || "";
  const looksLikeHost =
    hostish.startsWith("www.") ||
    (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(hostish) &&
      hostish.includes("."));

  if (looksLikeHost && !/\s/.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // In-page slug or other relative token — leave unchanged (caller may treat as hash)
  return trimmed;
}

/** Whether resolveBlockHref should open in a new tab. */
export function shouldOpenInNewTab(
  openInNewTab: unknown,
  href: string
): boolean {
  if (openInNewTab === "true" || openInNewTab === true) return true;
  if (openInNewTab === "false" || openInNewTab === false) return false;
  // Unset → external http(s) open in a new tab (Framer-like safer default)
  return isExternalHttpHref(href);
}
