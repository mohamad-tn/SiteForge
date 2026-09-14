import { describe, expect, it } from "vitest";
import {
  extractProviderMessage,
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
  it("parses Google 429 quota sample into clean bilingual message", () => {
    const parsed = parseProviderError("google", 429, GOOGLE_429);
    expect(parsed.code).toBe("quota_exceeded");
    expect(parsed.message).not.toMatch(/\{/);
    expect(parsed.message).toMatch(/Quota|حصة|rate/i);
    expect(parsed.providerMessage).toMatch(/exceeded your current quota/i);
    expect(parsed.message.length).toBeLessThanOrEqual(300);
  });

  it("parses OpenAI 401 key error", () => {
    const parsed = parseProviderError("openai", 401, OPENAI_401);
    expect(parsed.code).toBe("key_invalid");
    expect(parsed.message).toMatch(/API key|مفتاح/i);
    expect(parsed.message).not.toContain("invalid_api_key");
  });

  it("parses Anthropic 400 bad request", () => {
    const parsed = parseProviderError("anthropic", 400, ANTHROPIC_400);
    expect(parsed.code).toBe("bad_request");
    expect(parsed.providerMessage).toMatch(/max_tokens/i);
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
      throwProviderHttpError("xai", 503, '{"error":{"message":"overloaded"}}');
    } catch (e) {
      const err = e as ProviderError;
      expect(err.code).toBe("provider_unavailable");
      expect(err.message).not.toMatch(/\{/);
      expect(err.raw).toContain("overloaded");
    }
  });

  it("toUserFacingAiError scrubs dumped JSON Error messages", () => {
    const raw = `Google error 429: ${GOOGLE_429}`;
    const facing = toUserFacingAiError(new Error(raw));
    expect(facing.message).not.toMatch(/"status":/);
    expect(facing.message.length).toBeLessThanOrEqual(300);
    expect(facing.code).toBe("quota_exceeded");
  });
});
