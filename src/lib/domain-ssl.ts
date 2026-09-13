/**
 * Custom domain + DNS/SSL onboarding helpers (pure — no secrets).
 * Live host: siteforge-pup5.onrender.com (Render Free + Let's Encrypt after attach).
 */

export const RENDER_SERVICE_HOST = "siteforge-pup5.onrender.com";
export const RENDER_DASHBOARD_URL =
  "https://dashboard.render.com/web/srv-dagn0sqd0e5s73d6sr80";

export type DomainKind = "apex" | "subdomain";

export type DnsRecordRecommendation = {
  kind: DomainKind;
  hostname: string;
  records: {
    type: "CNAME" | "ALIAS" | "ANAME";
    host: string;
    value: string;
    note?: string;
  }[];
  /** Human-readable product notes (codes for i18n on the client). */
  notes: string[];
};

export type DomainLiveStatus = "none" | "dns-pending" | "ssl-pending" | "active" | "error";

export type DnsLookupResult = {
  cname: string[];
  a: string[];
  error?: string;
};

/** Strip scheme/path/port and lowercase. Returns "" if empty/invalid. */
export function normalizeHostname(input: string): string {
  let s = String(input || "").trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/^https?:\/\//i, "");
  s = s.split("/")[0] || "";
  s = s.split("?")[0] || "";
  s = s.split("#")[0] || "";
  // strip trailing dot / port
  s = s.replace(/\.$/, "");
  if (s.includes(":")) s = s.split(":")[0] || "";
  s = s.replace(/^\.+|\.+$/g, "");
  if (!s) return "";
  // basic hostname shape
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(s)) return "";
  if (s.length > 253) return "";
  return s;
}

/** Apex = exactly two labels (example.com). Subdomain = www.example.com etc. */
export function classifyHostname(hostname: string): DomainKind {
  const host = normalizeHostname(hostname);
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return "apex";
  return "subdomain";
}

export function recommendDnsRecords(hostname: string): DnsRecordRecommendation | null {
  const host = normalizeHostname(hostname);
  if (!host) return null;
  const kind = classifyHostname(host);

  if (kind === "subdomain") {
    return {
      kind,
      hostname: host,
      records: [
        {
          type: "CNAME",
          host,
          value: RENDER_SERVICE_HOST,
        },
      ],
      notes: ["cname-subdomain", "render-attach-required", "ssl-auto-after-dns"],
    };
  }

  // Apex: recommend www CNAME + note that apex needs ALIAS/ANAME or Render apex docs.
  const www = host.startsWith("www.") ? host : `www.${host}`;
  return {
    kind: "apex",
    hostname: host,
    records: [
      {
        type: "CNAME",
        host: www,
        value: RENDER_SERVICE_HOST,
        note: "prefer-www",
      },
      {
        type: "ALIAS",
        host,
        value: RENDER_SERVICE_HOST,
        note: "apex-alias-or-aname",
      },
    ],
    notes: ["apex-prefer-www", "apex-alias-note", "render-attach-required", "ssl-auto-after-dns"],
  };
}

function stripDot(s: string): string {
  return s.replace(/\.$/, "").toLowerCase();
}

/** Whether DNS already points at our Render service (CNAME) or has any A (apex pending verify). */
export function dnsPointsToRender(lookup: DnsLookupResult): boolean {
  const target = RENDER_SERVICE_HOST.toLowerCase();
  return lookup.cname.some((c) => stripDot(c) === target || stripDot(c).endsWith(`.${target}`));
}

/**
 * Classify live status from DNS + optional HTTPS probe.
 * - none: empty hostname
 * - dns-pending: no matching CNAME/A yet
 * - ssl-pending: DNS looks good but HTTPS probe failed / not ready
 * - active: HTTPS OK (or DNS CNAME matches and probe skipped/ok)
 * - error: lookup failed hard
 */
export function classifyDomainStatus(opts: {
  hostname: string;
  lookup?: DnsLookupResult | null;
  httpsOk?: boolean | null;
}): DomainLiveStatus {
  const host = normalizeHostname(opts.hostname);
  if (!host) return "none";
  if (opts.lookup?.error && !opts.lookup.cname.length && !opts.lookup.a.length) {
    return "error";
  }
  const lookup = opts.lookup || { cname: [], a: [] };
  const cnameOk = dnsPointsToRender(lookup);
  const hasAny = cnameOk || lookup.a.length > 0;
  if (!hasAny) return "dns-pending";
  if (opts.httpsOk === true) return "active";
  if (opts.httpsOk === false) return "ssl-pending";
  // DNS looks pointed (CNAME) but we didn't probe — treat as ssl-pending until verify.
  if (cnameOk) return "ssl-pending";
  // Apex with only A records — still waiting for Render attach / ALIAS clarity
  return "dns-pending";
}

/** Map live status → legacy DB enum used by Site.domainStatus. */
export function toLegacyDomainStatus(
  live: DomainLiveStatus
): "none" | "pending" | "active" | "error" {
  if (live === "none") return "none";
  if (live === "active") return "active";
  if (live === "error") return "error";
  return "pending";
}
