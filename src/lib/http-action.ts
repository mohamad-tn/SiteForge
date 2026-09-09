/**
 * External API / HTTP action config for SiteForge blocks (button, form, CTA).
 * Stored in block.props.httpAction — published JSON is visitor-visible.
 */

import { nanoid } from "nanoid";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export type BodyMode = "none" | "json" | "form" | "raw";
export type RunMode = "browser" | "proxy";
export type ClickBehavior = "link" | "http" | "both";

export type KvRow = { id: string; key: string; value: string; secret?: boolean };

export type HttpAction = {
  enabled: boolean;
  method: HttpMethod;
  /** URL may include `{pathParam}` placeholders */
  url: string;
  headers: KvRow[];
  query: KvRow[];
  pathParams: KvRow[];
  bodyMode: BodyMode;
  bodyJson: string;
  bodyRaw: string;
  /** Extra static fields merged into JSON/form body (forms also get live field values) */
  formFields: KvRow[];
  successMessage: string;
  errorMessage: string;
  /** browser = visitor fetch (needs CORS). proxy = SiteForge server (default for forms). */
  runMode: RunMode;
  /** When form + http: also persist FormSubmission locally (default true) */
  saveLocally: boolean;
};

export const PROXY_TIMEOUT_MS = 15_000;
export const PROXY_MAX_RESPONSE_BYTES = 512_000;

export function newKvRow(partial?: Partial<KvRow>): KvRow {
  return {
    id: partial?.id || nanoid(8),
    key: partial?.key ?? "",
    value: partial?.value ?? "",
    secret: partial?.secret ?? false,
  };
}

export function defaultHttpAction(overrides?: Partial<HttpAction>): HttpAction {
  return {
    enabled: false,
    method: "POST",
    url: "",
    headers: [],
    query: [],
    pathParams: [],
    bodyMode: "json",
    bodyJson: "{\n  \n}",
    bodyRaw: "",
    formFields: [],
    successMessage: "",
    errorMessage: "",
    runMode: "proxy",
    saveLocally: true,
    ...overrides,
  };
}

function asRows(raw: unknown): KvRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      return {
        id: typeof o.id === "string" ? o.id : nanoid(8),
        key: typeof o.key === "string" ? o.key : "",
        value: typeof o.value === "string" ? o.value : String(o.value ?? ""),
        secret: o.secret === true,
      } satisfies KvRow;
    })
    .filter(Boolean) as KvRow[];
}

export function parseHttpAction(raw: unknown): HttpAction {
  const base = defaultHttpAction();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const method = String(o.method || "POST").toUpperCase();
  const bodyMode = (["none", "json", "form", "raw"] as const).includes(o.bodyMode as BodyMode)
    ? (o.bodyMode as BodyMode)
    : "json";
  const runMode = o.runMode === "browser" ? "browser" : "proxy";
  return {
    enabled: o.enabled === true,
    method: (HTTP_METHODS as readonly string[]).includes(method) ? (method as HttpMethod) : "POST",
    url: typeof o.url === "string" ? o.url : "",
    headers: asRows(o.headers),
    query: asRows(o.query),
    pathParams: asRows(o.pathParams),
    bodyMode,
    bodyJson: typeof o.bodyJson === "string" ? o.bodyJson : base.bodyJson,
    bodyRaw: typeof o.bodyRaw === "string" ? o.bodyRaw : "",
    formFields: asRows(o.formFields),
    successMessage: typeof o.successMessage === "string" ? o.successMessage : "",
    errorMessage: typeof o.errorMessage === "string" ? o.errorMessage : "",
    runMode,
    saveLocally: o.saveLocally !== false,
  };
}

export function parseClickBehavior(raw: unknown): ClickBehavior {
  if (raw === "http" || raw === "both") return raw;
  return "link";
}

/** Private / loopback / link-local / metadata ranges (SSRF). */
const BLOCKED_HOST_RE =
  /^(localhost|localhost\.)|(\.local)$/i;

function isPrivateOrBlockedIp(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h === "::" || h === "::1" || h === "0:0:0:0:0:0:0:1") {
    return true;
  }
  // IPv4
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const c = Number(m[3]);
    const d = Number(m[4]);
    if ([a, b, c, d].some((n) => n > 255)) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0 && c === 0) return true;
    if (a === 192 && b === 0 && c === 2) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    if (a >= 224) return true; // multicast / reserved
  }
  // IPv6 unique-local / link-local / mapped
  if (h.includes(":")) {
    if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("ff")) return true;
    if (h.startsWith("::ffff:")) {
      const mapped = h.slice(7);
      if (isPrivateOrBlockedIp(mapped)) return true;
    }
  }
  return false;
}

export type SafeUrlResult = { ok: true; url: URL } | { ok: false; error: string };

/**
 * SSRF guard: only http(s), no credentials in URL, block localhost / private / metadata hosts.
 */
export function assertSafeProxyUrl(rawUrl: string): SafeUrlResult {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) return { ok: false, error: "Empty URL" };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only http/https allowed" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "URL credentials not allowed" };
  }
  const host = parsed.hostname;
  if (!host) return { ok: false, error: "Missing host" };
  if (BLOCKED_HOST_RE.test(host) || host.endsWith(".localhost")) {
    return { ok: false, error: "Host not allowed" };
  }
  if (isPrivateOrBlockedIp(host)) {
    return { ok: false, error: "Private or metadata IP not allowed" };
  }
  // Block AWS/GCP metadata hostname
  if (host === "metadata.google.internal" || host === "metadata" || host.endsWith(".internal")) {
    return { ok: false, error: "Internal host not allowed" };
  }
  return { ok: true, url: parsed };
}

export function applyPathParams(urlTemplate: string, pathParams: KvRow[]): string {
  let out = urlTemplate;
  for (const row of pathParams) {
    if (!row.key) continue;
    const token = `{${row.key}}`;
    out = out.split(token).join(encodeURIComponent(row.value));
  }
  return out;
}

/** True if value is a vault placeholder (safe in published JSON; resolve only in proxy). */
export function isVaultSecretRef(value: string): boolean {
  const v = String(value || "");
  if (/^secret:[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v.trim())) return true;
  return /\{\{secret:[A-Za-z][A-Za-z0-9_-]{0,63}\}\}/.test(v);
}

export function rowsToRecord(rows: KvRow[], opts?: { omitSecrets?: boolean }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const k = row.key.trim();
    if (!k) continue;
    // Omit flagged secrets and vault placeholders from browser-visible requests
    if (opts?.omitSecrets && (row.secret || isVaultSecretRef(row.value))) continue;
    out[k] = row.value;
  }
  return out;
}

/** Headers safe to send from the browser (secrets omitted). */
export function clientVisibleHeaders(action: HttpAction): Record<string, string> {
  return rowsToRecord(action.headers, { omitSecrets: true });
}

export function mergeFormBody(
  action: HttpAction,
  formData?: Record<string, unknown>
): { contentType: string | null; body: string | null } {
  const staticExtra = rowsToRecord(action.formFields);
  const live: Record<string, unknown> = { ...staticExtra, ...(formData || {}) };

  if (action.bodyMode === "none" || action.method === "GET" || action.method === "HEAD") {
    return { contentType: null, body: null };
  }

  if (action.bodyMode === "raw") {
    return { contentType: "text/plain; charset=utf-8", body: action.bodyRaw };
  }

  if (action.bodyMode === "form") {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(live)) {
      params.set(k, v == null ? "" : String(v));
    }
    return { contentType: "application/x-www-form-urlencoded; charset=utf-8", body: params.toString() };
  }

  // json (default): template object merged with form fields
  let base: Record<string, unknown> = {};
  const trimmed = action.bodyJson.trim();
  if (trimmed && trimmed !== "{" && trimmed !== "{\n  \n}") {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        base = parsed as Record<string, unknown>;
      } else {
        // non-object template — if no form data, send as-is
        if (!formData || Object.keys(formData).length === 0) {
          return { contentType: "application/json; charset=utf-8", body: JSON.stringify(parsed) };
        }
      }
    } catch {
      // ignore invalid template; fall through to live fields
    }
  }
  const merged = { ...base, ...live };
  return { contentType: "application/json; charset=utf-8", body: JSON.stringify(merged) };
}

export type BuiltRequest = {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body: string | null;
};

/**
 * Build final URL + headers + body for an HttpAction.
 * `omitSecrets` = true for browser mode (never send secret header values from client config).
 */
export function buildRequest(
  action: HttpAction,
  opts?: { formData?: Record<string, unknown>; omitSecrets?: boolean }
): BuiltRequest {
  const withPath = applyPathParams(action.url, action.pathParams);
  const safe = assertSafeProxyUrl(withPath);
  // For buildRequest we still construct URL even if unsafe — callers that proxy must re-check.
  // Client browser mode should also check. We throw on clearly invalid URL parse.
  let urlObj: URL;
  try {
    urlObj = new URL(withPath);
  } catch {
    throw new Error("Invalid URL");
  }
  for (const row of action.query) {
    const k = row.key.trim();
    if (!k) continue;
    urlObj.searchParams.set(k, row.value);
  }

  const headers = rowsToRecord(action.headers, { omitSecrets: opts?.omitSecrets });
  const { contentType, body } = mergeFormBody(action, opts?.formData);
  if (contentType && body != null && !Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) {
    headers["Content-Type"] = contentType;
  }
  if (action.method === "GET" || action.method === "HEAD") {
    return { url: urlObj.toString(), method: action.method, headers, body: null };
  }
  // Prefer validated hostname when available
  void safe;
  return { url: urlObj.toString(), method: action.method, headers, body };
}

/** Redact secret header values for logs. */
export function redactHeadersForLog(headers: Record<string, string>, action: HttpAction): Record<string, string> {
  const secretKeys = new Set(
    action.headers.filter((h) => h.secret).map((h) => h.key.trim().toLowerCase())
  );
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = secretKeys.has(k.toLowerCase()) || /authorization|api[-_]?key|secret|token|password/i.test(k)
      ? "[redacted]"
      : v;
  }
  return out;
}

export function findBlockInContent(
  content: unknown,
  blockId: string
): { type: string; props: Record<string, unknown> } | null {
  if (!content || typeof content !== "object") return null;
  const pages = (content as { pages?: unknown }).pages;
  if (!Array.isArray(pages)) return null;
  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    const blocks = (page as { blocks?: unknown }).blocks;
    if (!Array.isArray(blocks)) continue;
    for (const b of blocks) {
      if (!b || typeof b !== "object") continue;
      const block = b as { id?: string; type?: string; props?: Record<string, unknown> };
      if (block.id === blockId && block.type && block.props) {
        return { type: block.type, props: block.props };
      }
    }
  }
  return null;
}

export const JSON_CONTENT_TYPE_PRESET: KvRow = {
  id: "preset-ct",
  key: "Content-Type",
  value: "application/json",
  secret: false,
};
