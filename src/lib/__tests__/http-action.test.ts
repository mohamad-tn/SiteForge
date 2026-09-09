import { describe, expect, it } from "vitest";
import {
  assertSafeProxyUrl,
  applyPathParams,
  buildRequest,
  defaultHttpAction,
  mergeFormBody,
  parseHttpAction,
  redactHeadersForLog,
} from "@/lib/http-action";

describe("assertSafeProxyUrl SSRF guard", () => {
  it("allows public https", () => {
    const r = assertSafeProxyUrl("https://hooks.example.com/catch/abc");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url.hostname).toBe("hooks.example.com");
  });

  it("blocks localhost and loopback", () => {
    expect(assertSafeProxyUrl("http://localhost/x").ok).toBe(false);
    expect(assertSafeProxyUrl("http://127.0.0.1/x").ok).toBe(false);
    expect(assertSafeProxyUrl("http://[::1]/x").ok).toBe(false);
  });

  it("blocks private and metadata IPs", () => {
    expect(assertSafeProxyUrl("http://10.0.0.5/a").ok).toBe(false);
    expect(assertSafeProxyUrl("http://192.168.1.1/a").ok).toBe(false);
    expect(assertSafeProxyUrl("http://172.16.0.1/a").ok).toBe(false);
    expect(assertSafeProxyUrl("http://169.254.169.254/latest/meta-data").ok).toBe(false);
    expect(assertSafeProxyUrl("http://metadata.google.internal/").ok).toBe(false);
  });

  it("blocks non-http schemes", () => {
    expect(assertSafeProxyUrl("file:///etc/passwd").ok).toBe(false);
    expect(assertSafeProxyUrl("ftp://example.com/a").ok).toBe(false);
    expect(assertSafeProxyUrl("javascript:alert(1)").ok).toBe(false);
  });

  it("blocks URL credentials", () => {
    expect(assertSafeProxyUrl("https://user:pass@example.com/x").ok).toBe(false);
  });
});

describe("buildRequest", () => {
  it("applies path params, query, and JSON body merge", () => {
    const action = defaultHttpAction({
      enabled: true,
      method: "POST",
      url: "https://api.example.com/hooks/{id}",
      pathParams: [{ id: "1", key: "id", value: "42" }],
      query: [{ id: "2", key: "src", value: "siteforge" }],
      headers: [{ id: "3", key: "X-Test", value: "1" }],
      bodyMode: "json",
      bodyJson: '{"source":"site"}',
      formFields: [{ id: "4", key: "plan", value: "pro" }],
    });
    const built = buildRequest(action, { formData: { email: "a@b.c", name: "Ada" } });
    expect(built.url).toContain("https://api.example.com/hooks/42");
    expect(built.url).toContain("src=siteforge");
    expect(built.method).toBe("POST");
    expect(built.headers["X-Test"]).toBe("1");
    expect(built.headers["Content-Type"]).toMatch(/application\/json/);
    const body = JSON.parse(built.body || "{}");
    expect(body.source).toBe("site");
    expect(body.plan).toBe("pro");
    expect(body.email).toBe("a@b.c");
    expect(body.name).toBe("Ada");
  });

  it("omits secret headers when omitSecrets", () => {
    const action = defaultHttpAction({
      enabled: true,
      url: "https://api.example.com/x",
      method: "GET",
      bodyMode: "none",
      headers: [
        { id: "1", key: "Authorization", value: "Bearer secret", secret: true },
        { id: "2", key: "X-Public", value: "yes" },
      ],
    });
    const built = buildRequest(action, { omitSecrets: true });
    expect(built.headers.Authorization).toBeUndefined();
    expect(built.headers["X-Public"]).toBe("yes");
  });

  it("applyPathParams replaces tokens", () => {
    expect(applyPathParams("/a/{user}/b", [{ id: "1", key: "user", value: "x y" }])).toBe(
      "/a/x%20y/b"
    );
  });
});

describe("parseHttpAction + redact", () => {
  it("parses enabled action", () => {
    const a = parseHttpAction({ enabled: true, method: "PUT", url: "https://x.test" });
    expect(a.enabled).toBe(true);
    expect(a.method).toBe("PUT");
    expect(a.runMode).toBe("proxy");
  });

  it("redacts secret headers in logs", () => {
    const action = defaultHttpAction({
      headers: [{ id: "1", key: "Authorization", value: "Bearer x", secret: true }],
    });
    const red = redactHeadersForLog({ Authorization: "Bearer x", Accept: "json" }, action);
    expect(red.Authorization).toBe("[redacted]");
    expect(red.Accept).toBe("json");
  });

  it("mergeFormBody form mode", () => {
    const action = defaultHttpAction({
      bodyMode: "form",
      formFields: [{ id: "1", key: "token", value: "t" }],
    });
    const { contentType, body } = mergeFormBody(action, { email: "e@x.com" });
    expect(contentType).toMatch(/x-www-form-urlencoded/);
    expect(body).toContain("email=e%40x.com");
    expect(body).toContain("token=t");
  });
});
