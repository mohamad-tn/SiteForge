import { describe, expect, it } from "vitest";
import {
  extractProviderMessage,
  formatProviderError,
  parseProviderError,
  ProviderError,
  toUserFacingAiError,
  throwProviderHttpError,
} from "@/lib/ai/provider-errors";

const GOOGLE_429 = `{
  "error": {
    "code": 429,
    "message": "You exceeded your current quota, please check your plan and billing details.",
    "status": "RESOURCE_EXHAUSTED"
  }
}`;

const OPENAI_401 = `{
  "error": {
    "message": "Incorrect API key provided",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}`;

const ANTHROPIC_400 = `{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "max_tokens: field required"
  }
}`;

describe("provider-errors", () => {
  it("formats Google 429 quota in English vs Arabic (single language)", () => {
    const en = parseProviderError("google", 429, GOOGLE_429, "en");
    const ar = parseProviderError("google", 429, GOOGLE_429, "ar");
    expect(en.code).toBe("quota_exceeded");
    expect(ar.code).toBe("quota_exceeded");
    expect(en.message).toMatch(/Quota|rate/i);
    expect(en.message).not.toMatch(/حصة|تجاوز/);
    expect(ar.message).toMatch(/حصة|معدل|تجاوز/);
    expect(ar.message).not.toMatch(/Quota exceeded/i);
    expect(en.message).not.toMatch(/\{/);
    expect(ar.message).not.toMatch(/\{/);
    expect(en.providerMessage).toMatch(/exceeded your current quota/i);
    expect(en.message.length).toBeLessThanOrEqual(300);
    expect(ar.message.length).toBeLessThanOrEqual(300);
  });

  it("formatProviderError prefers current lang with English default", () => {
    expect(formatProviderError("key_invalid", { lang: "ar" })).toMatch(/مفتاح/);
    expect(formatProviderError("key_invalid", { lang: "en" })).toMatch(/API key/i);
    expect(formatProviderError("key_invalid", { lang: "fr" })).toMatch(/API key/i);
    expect(formatProviderError("http_418", { lang: "en", status: 418 })).toMatch(/418/);
  });

  it("parses OpenAI 401 key error", () => {
    const parsed = parseProviderError("openai", 401, OPENAI_401, "en");
    expect(parsed.code).toBe("key_invalid");
    expect(parsed.message).toMatch(/API key/i);
    expect(parsed.message).not.toContain("invalid_api_key");
  });

  it("parses Anthropic 400 bad request", () => {
    const parsed = parseProviderError("anthropic", 400, ANTHROPIC_400, "ar");
    expect(parsed.code).toBe("bad_request");
    expect(parsed.providerMessage).toMatch(/max_tokens/i);
    expect(parsed.message).toMatch(/طلب غير صالح|مزوّد/);
    expect(parsed.message).not.toMatch(/"type":/);
  });

  it("extractProviderMessage reads nested shapes", () => {
    expect(extractProviderMessage("google", GOOGLE_429)).toMatch(/quota/i);
    expect(extractProviderMessage("openai", OPENAI_401)).toMatch(/Incorrect API key/i);
    expect(extractProviderMessage("anthropic", ANTHROPIC_400)).toMatch(/max_tokens/i);
  });

  it("throwProviderHttpError raises ProviderError with clean message", () => {
    expect(() => throwProviderHttpError("xai", 503, '{"error":{"message":"overloaded"}}')).toThrow(
      ProviderError
    );
    try {
      throwProviderHttpError("xai", 503, '{"error":{"message":"overloaded"}}', "en");
    } catch (e) {
      const err = e as ProviderError;
      expect(err.code).toBe("provider_unavailable");
      expect(err.message).not.toMatch(/\{/);
      expect(err.raw).toContain("overloaded");
    }
  });

  it("toUserFacingAiError reformats ProviderError into requested lang", () => {
    let thrown: ProviderError | null = null;
    try {
      throwProviderHttpError("google", 429, GOOGLE_429, "en");
    } catch (e) {
      thrown = e as ProviderError;
    }
    expect(thrown).toBeTruthy();
    const ar = toUserFacingAiError(thrown, { lang: "ar" });
    const en = toUserFacingAiError(thrown, { lang: "en" });
    expect(ar.code).toBe("quota_exceeded");
    expect(ar.message).toMatch(/حصة|معدل|تجاوز/);
    expect(en.message).toMatch(/Quota|rate/i);
    expect(ar.message).not.toMatch(/Quota exceeded/i);
  });

  it("toUserFacingAiError scrubs dumped JSON Error messages", () => {
    const raw = `Google error 429: ${GOOGLE_429}`;
    const facing = toUserFacingAiError(new Error(raw), { lang: "en" });
    expect(facing.message).not.toMatch(/"status":/);
    expect(facing.message.length).toBeLessThanOrEqual(300);
    expect(facing.code).toBe("quota_exceeded");
  });
});
