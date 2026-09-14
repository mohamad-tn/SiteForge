/**
 * Parse provider HTTP errors into short user-facing messages.
 * Never dump raw JSON bodies to the UI.
 */

export type AiProviderId = "openai" | "anthropic" | "google" | "xai";

export type ParsedProviderError = {
  /** Short bilingual (or locale-aware) message for the UI */
  message: string;
  /** Stable code for logs */
  code: string;
  status: number;
  /** Provider message field only, stripped of noise */
  providerMessage?: string;
  raw?: string;
};

export class ProviderError extends Error {
  readonly code: string;
  readonly status: number;
  readonly provider: AiProviderId | string;
  readonly raw?: string;
  readonly providerMessage?: string;

  constructor(
    parsed: ParsedProviderError,
    provider: AiProviderId | string = "unknown"
  ) {
    super(parsed.message);
    this.name = "ProviderError";
    this.code = parsed.code;
    this.status = parsed.status;
    this.provider = provider;
    this.raw = parsed.raw;
    this.providerMessage = parsed.providerMessage;
  }
}

const MAX_USER_MSG = 300;

function stripNoise(s: string): string {
  return s
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function bilingual(en: string, ar: string, detail?: string): string {
  const d = detail ? ` (${stripNoise(detail)})` : "";
  const msg = `${en}${d} / ${ar}${d}`;
  return msg.slice(0, MAX_USER_MSG);
}

function mapStatusCode(
  status: number,
  providerMessage?: string
): { code: string; message: string } {
  if (status === 401 || status === 403) {
    return {
      code: "key_invalid",
      message: bilingual(
        "API key invalid or unauthorized",
        "مفتاح API غير صالح أو غير مصرّح",
        providerMessage
      ),
    };
  }
  if (status === 429) {
    const quotaLike =
      /quota|exceeded|billing|rate.?limit|resource.?exhausted/i.test(
        providerMessage || ""
      );
    return {
      code: quotaLike ? "quota_exceeded" : "rate_limited",
      message: bilingual(
        quotaLike
          ? "Quota or rate limit exceeded"
          : "Too many requests — try again shortly",
        quotaLike
          ? "تم تجاوز الحصة أو حد المعدل"
          : "طلبات كثيرة — أعد المحاولة بعد قليل",
        providerMessage
      ),
    };
  }
  if (status === 400 || status === 422) {
    return {
      code: "bad_request",
      message: bilingual(
        "Bad request to the AI provider",
        "طلب غير صالح لمزوّد الذكاء الاصطناعي",
        providerMessage
      ),
    };
  }
  if (status >= 500 && status < 600) {
    return {
      code: "provider_unavailable",
      message: bilingual(
        "AI provider temporarily unavailable",
        "مزوّد الذكاء الاصطناعي غير متاح مؤقتاً",
        providerMessage
      ),
    };
  }
  return {
    code: `http_${status}`,
    message: bilingual(
      `AI provider error (${status})`,
      `خطأ من مزوّد الذكاء الاصطناعي (${status})`,
      providerMessage
    ),
  };
}

/** Extract human message from known provider JSON shapes. */
export function extractProviderMessage(
  provider: AiProviderId | string,
  body: string
): string | undefined {
  const trimmed = (body || "").trim();
  if (!trimmed) return undefined;
  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    // Google: { error: { code, message, status } }
    if (json.error && typeof json.error === "object" && !Array.isArray(json.error)) {
      const err = json.error as Record<string, unknown>;
      if (typeof err.message === "string" && err.message.trim()) {
        return stripNoise(err.message);
      }
    }
    // Anthropic: { type, error: { type, message } } — same nested path often
    // OpenAI / xAI: { error: { message, type, code } }
    if (typeof json.message === "string" && json.message.trim()) {
      return stripNoise(json.message);
    }
  } catch {
    // not JSON — take a short plain slice, drop braces noise
    const plain = stripNoise(trimmed.replace(/[{}\[\]"]/g, " "));
    if (plain.length > 8) return plain.slice(0, 180);
  }
  return undefined;
}

/**
 * Parse HTTP status + body into a clean user-facing error.
 * Prefer the provider `message` field; never return raw JSON.
 */
export function parseProviderError(
  provider: AiProviderId | string,
  status: number,
  body: string
): ParsedProviderError {
  const raw = (body || "").slice(0, 2000);
  const providerMessage = extractProviderMessage(provider, body);
  const mapped = mapStatusCode(status, providerMessage);
  return {
    message: mapped.message.slice(0, MAX_USER_MSG),
    code: mapped.code,
    status,
    providerMessage,
    raw,
  };
}

/** Throw a ProviderError from an HTTP response. */
export function throwProviderHttpError(
  provider: AiProviderId | string,
  status: number,
  body: string
): never {
  const parsed = parseProviderError(provider, status, body);
  throw new ProviderError(parsed, provider);
}

/** Normalize any thrown value into a short UI-safe string (+ optional code for logs). */
export function toUserFacingAiError(
  err: unknown,
  opts?: { maxLen?: number }
): { message: string; code?: string; raw?: string } {
  const max = opts?.maxLen ?? MAX_USER_MSG;
  if (err instanceof ProviderError) {
    return {
      message: err.message.slice(0, max),
      code: err.code,
      raw: err.raw,
    };
  }
  if (err instanceof Error) {
    // Already-clean Error (adapters may set .message to user string)
    const msg = err.message || "AI request failed";
    // If message still looks like dumped JSON, scrub it
    if (/^\s*\{[\s\S]*"error"/.test(msg) || /error\s+\d+:\s*\{/.test(msg)) {
      const statusMatch = /(?:error|status)\s+(\d{3})/i.exec(msg);
      const status = statusMatch ? Number(statusMatch[1]) : 500;
      const bodyStart = msg.indexOf("{");
      const body = bodyStart >= 0 ? msg.slice(bodyStart) : msg;
      const parsed = parseProviderError("unknown", status, body);
      return { message: parsed.message.slice(0, max), code: parsed.code, raw: msg.slice(0, 2000) };
    }
    return { message: msg.slice(0, max) };
  }
  return { message: "AI request failed / تعذّر طلب الذكاء الاصطناعي".slice(0, max) };
}
