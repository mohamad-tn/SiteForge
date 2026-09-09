import { describe, expect, it } from "vitest";
import {
  applySiteSecretsToAction,
  collectSecretNamesFromAction,
  encryptSecret,
  decryptSecret,
  isValidSecretName,
  referencesSiteSecret,
  resolveSecretRefs,
} from "@/lib/site-secrets";
import { defaultHttpAction, buildRequest, isVaultSecretRef } from "@/lib/http-action";

describe("vault crypto", () => {
  it("round-trips encrypt/decrypt", () => {
    const plain = "sk_live_example_🔑";
    const enc = encryptSecret(plain);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain(plain);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it("validates secret names", () => {
    expect(isValidSecretName("API_KEY")).toBe(true);
    expect(isValidSecretName("a")).toBe(true);
    expect(isValidSecretName("1bad")).toBe(false);
    expect(isValidSecretName("has space")).toBe(false);
  });
});

describe("secret placeholder resolution", () => {
  const secrets = { API_TOKEN: "tok_abc", WEBHOOK: "wh_secret" };

  it("resolves secret:NAME prefix", () => {
    const r = resolveSecretRefs("secret:API_TOKEN", secrets);
    expect(r).toEqual({ ok: true, value: "tok_abc" });
  });

  it("resolves {{secret:NAME}} templates", () => {
    const r = resolveSecretRefs("Bearer {{secret:API_TOKEN}}", secrets);
    expect(r).toEqual({ ok: true, value: "Bearer tok_abc" });
  });

  it("reports missing secrets", () => {
    const r = resolveSecretRefs("secret:MISSING", secrets);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toBe("MISSING");
  });

  it("detects vault refs", () => {
    expect(referencesSiteSecret("secret:API_TOKEN")).toBe(true);
    expect(referencesSiteSecret("Bearer {{secret:API_TOKEN}}")).toBe(true);
    expect(referencesSiteSecret("Bearer raw")).toBe(false);
    expect(isVaultSecretRef("secret:API_TOKEN")).toBe(true);
  });

  it("collects names from action and applies map", () => {
    const action = defaultHttpAction({
      enabled: true,
      url: "https://api.example.com/h/{{secret:WEBHOOK}}",
      headers: [
        { id: "1", key: "Authorization", value: "Bearer {{secret:API_TOKEN}}", secret: true },
        { id: "2", key: "X-Key", value: "secret:API_TOKEN" },
      ],
      bodyMode: "none",
      method: "GET",
    });
    const names = collectSecretNamesFromAction(action);
    expect(names.sort()).toEqual(["API_TOKEN", "WEBHOOK"]);

    const applied = applySiteSecretsToAction(action, secrets);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.action.url).toBe("https://api.example.com/h/wh_secret");
    expect(applied.action.headers[0].value).toBe("Bearer tok_abc");
    expect(applied.action.headers[1].value).toBe("tok_abc");
    expect(applied.action.headers[0].secret).toBe(true);

    const built = buildRequest(applied.action, { omitSecrets: false });
    expect(built.headers.Authorization).toBe("Bearer tok_abc");
    expect(built.url).toContain("wh_secret");
  });

  it("omits vault refs from browser-visible headers", () => {
    const action = defaultHttpAction({
      enabled: true,
      url: "https://api.example.com/x",
      method: "GET",
      bodyMode: "none",
      headers: [
        { id: "1", key: "Authorization", value: "secret:API_TOKEN" },
        { id: "2", key: "X-Public", value: "yes" },
      ],
    });
    const built = buildRequest(action, { omitSecrets: true });
    expect(built.headers.Authorization).toBeUndefined();
    expect(built.headers["X-Public"]).toBe("yes");
  });

  it("keeps published placeholder intact until apply", () => {
    const action = defaultHttpAction({
      headers: [{ id: "1", key: "Authorization", value: "secret:API_TOKEN" }],
    });
    // Published JSON would serialize this — value is NOT the raw secret
    expect(JSON.stringify(action.headers)).toContain("secret:API_TOKEN");
    expect(JSON.stringify(action.headers)).not.toContain("tok_abc");
  });
});
