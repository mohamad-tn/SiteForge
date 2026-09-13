import { describe, expect, it } from "vitest";
import {
  classifyDomainStatus,
  classifyHostname,
  normalizeHostname,
  recommendDnsRecords,
  RENDER_SERVICE_HOST,
  toLegacyDomainStatus,
} from "@/lib/domain-ssl";

describe("domain-ssl", () => {
  it("normalizeHostname strips scheme/path/port", () => {
    expect(normalizeHostname("https://WWW.Example.com/path")).toBe("www.example.com");
    expect(normalizeHostname("example.com:443")).toBe("example.com");
    expect(normalizeHostname("")).toBe("");
    expect(normalizeHostname("not a domain!!")).toBe("");
  });

  it("classifyHostname apex vs subdomain", () => {
    expect(classifyHostname("example.com")).toBe("apex");
    expect(classifyHostname("www.example.com")).toBe("subdomain");
    expect(classifyHostname("app.shop.example.com")).toBe("subdomain");
  });

  it("recommendDnsRecords for subdomain CNAME to Render host", () => {
    const rec = recommendDnsRecords("www.example.com");
    expect(rec?.kind).toBe("subdomain");
    expect(rec?.records[0]).toMatchObject({
      type: "CNAME",
      host: "www.example.com",
      value: RENDER_SERVICE_HOST,
    });
  });

  it("recommendDnsRecords for apex prefers www + ALIAS note", () => {
    const rec = recommendDnsRecords("example.com");
    expect(rec?.kind).toBe("apex");
    expect(rec?.records.some((r) => r.host === "www.example.com" && r.type === "CNAME")).toBe(true);
    expect(rec?.records.some((r) => r.type === "ALIAS")).toBe(true);
    expect(rec?.notes).toContain("apex-prefer-www");
  });

  it("classifyDomainStatus ladder", () => {
    expect(classifyDomainStatus({ hostname: "" })).toBe("none");
    expect(
      classifyDomainStatus({ hostname: "www.example.com", lookup: { cname: [], a: [] } })
    ).toBe("dns-pending");
    expect(
      classifyDomainStatus({
        hostname: "www.example.com",
        lookup: { cname: [RENDER_SERVICE_HOST], a: [] },
        httpsOk: false,
      })
    ).toBe("ssl-pending");
    expect(
      classifyDomainStatus({
        hostname: "www.example.com",
        lookup: { cname: [RENDER_SERVICE_HOST], a: [] },
        httpsOk: true,
      })
    ).toBe("active");
    expect(toLegacyDomainStatus("ssl-pending")).toBe("pending");
    expect(toLegacyDomainStatus("active")).toBe("active");
  });
});
