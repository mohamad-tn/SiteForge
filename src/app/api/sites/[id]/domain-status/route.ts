import { NextResponse } from "next/server";
import {
  classifyDomainStatus,
  dnsPointsToRender,
  normalizeHostname,
  recommendDnsRecords,
  toLegacyDomainStatus,
  RENDER_DASHBOARD_URL,
  RENDER_SERVICE_HOST,
  type DnsLookupResult,
  type DomainLiveStatus,
} from "@/lib/domain-ssl";
import { prisma } from "@/lib/prisma";
import { jsonError, requireSession, requireSiteAccess } from "@/lib/api";

async function lookupDns(hostname: string): Promise<DnsLookupResult> {
  const host = normalizeHostname(hostname);
  if (!host) return { cname: [], a: [], error: "empty" };

  async function doh(type: "CNAME" | "A"): Promise<string[]> {
    try {
      const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`;
      const res = await fetch(url, {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { Answer?: { type: number; data: string }[] };
      const want = type === "CNAME" ? 5 : 1;
      return (data.Answer || [])
        .filter((a) => a.type === want && typeof a.data === "string")
        .map((a) => a.data.replace(/\.$/, "").toLowerCase());
    } catch {
      return [];
    }
  }

  try {
    const [cname, a] = await Promise.all([doh("CNAME"), doh("A")]);
    return { cname, a };
  } catch (e) {
    return { cname: [], a: [], error: e instanceof Error ? e.message : "lookup-failed" };
  }
}

async function probeHttps(hostname: string): Promise<boolean | null> {
  const host = normalizeHostname(hostname);
  if (!host) return null;
  try {
    const res = await fetch(`https://${host}/`, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(4500),
      cache: "no-store",
    });
    // Any TLS-successful HTTP response counts (including 3xx/4xx/5xx).
    return res.status > 0;
  } catch {
    return false;
  }
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await requireSiteAccess(id, auth.user);
  if ("response" in access) return access.response;

  const hostname = normalizeHostname(String(access.site.customDomain || ""));
  if (!hostname) {
    return NextResponse.json({
      status: "none" as DomainLiveStatus,
      hostname: "",
      target: RENDER_SERVICE_HOST,
      dashboardUrl: RENDER_DASHBOARD_URL,
      recommendation: null,
      dns: { cname: [], a: [] },
      httpsOk: null,
      hints: ["save-domain-first"],
    });
  }

  const recommendation = recommendDnsRecords(hostname);
  const dns = await lookupDns(hostname);
  const pointed = dnsPointsToRender(dns);
  const httpsOk = pointed || dns.a.length > 0 ? await probeHttps(hostname) : null;
  const status = classifyDomainStatus({ hostname, lookup: dns, httpsOk });

  return NextResponse.json({
    status,
    hostname,
    target: RENDER_SERVICE_HOST,
    dashboardUrl: RENDER_DASHBOARD_URL,
    recommendation,
    dns,
    httpsOk,
    hints: recommendation?.notes || [],
    legacyStatus: toLegacyDomainStatus(status),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Same verify path as GET; optionally persist legacy domainStatus.
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await requireSiteAccess(id, auth.user);
  if ("response" in access) return access.response;

  let persist = true;
  try {
    const body = (await req.json()) as { persist?: boolean };
    if (body && body.persist === false) persist = false;
  } catch {
    // empty body ok
  }

  const hostname = normalizeHostname(String(access.site.customDomain || ""));
  if (!hostname) {
    return NextResponse.json({
      status: "none" as DomainLiveStatus,
      hostname: "",
      target: RENDER_SERVICE_HOST,
      dashboardUrl: RENDER_DASHBOARD_URL,
      recommendation: null,
      dns: { cname: [], a: [] },
      httpsOk: null,
      hints: ["save-domain-first"],
    });
  }

  const recommendation = recommendDnsRecords(hostname);
  const dns = await lookupDns(hostname);
  const pointed = dnsPointsToRender(dns);
  const httpsOk = pointed || dns.a.length > 0 ? await probeHttps(hostname) : null;
  const status = classifyDomainStatus({ hostname, lookup: dns, httpsOk });
  const legacyStatus = toLegacyDomainStatus(status);

  if (persist) {
    try {
      await prisma.site.update({
        where: { id },
        data: { domainStatus: legacyStatus },
      });
    } catch (e) {
      console.error(e);
      return jsonError("Could not update domain status", 500);
    }
  }

  return NextResponse.json({
    status,
    hostname,
    target: RENDER_SERVICE_HOST,
    dashboardUrl: RENDER_DASHBOARD_URL,
    recommendation,
    dns,
    httpsOk,
    hints: recommendation?.notes || [],
    legacyStatus,
  });
}
