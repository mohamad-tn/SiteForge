/**
 * Parse provider HTTP errors into short user-facing messages.
 * Never dump raw JSON bodies to the UI.
 * Messages follow the current platform language (ar | en); English is the default.
 */

import {
  isPlatformLang,
  tPlatform,
  type PlatformLang,
} from "@/lib/platform-i18n";

export type AiProviderId = "openai" | "anthropic" | "google" | "xai";

export type ProviderErrorLang = PlatformLang;

export type ParsedProviderError = {
  /** Short locale-aware message for the UI */
  message: string;
  /** Stable code for logs / re-formatting */
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

const CODE_TO_I18N: Record<string, string> = {
  key_invalid: "aiErrKeyInvalid",
  quota_exceeded: "aiErrQuota",
  rate_limited: "aiErrRateLimit",
  bad_request: "aiErrBadRequest",
  provider_unavailable: "aiErrProviderUnavailable",
};

function stripNoise(s: string): string {
  return s
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

export function resolveProviderErrorLang(
  lang?: string | null
): ProviderErrorLang {
  return isPlatformLang(lang) ? lang : "en";
}

/**
 * Format a stable provider error code into a single-language UI string.
 * Prefer this over bilingual inline maps.
 */
export function formatProviderError(
  code: string,
  opts?: {
    lang?: string | null;
    status?: number;
    detail?: string;
  }
): string {
  const lang = resolveProviderErrorLang(opts?.lang);
  const i18nKey = CODE_TO_I18N[code] || "aiErrGeneric";
  let base = tPlatform(lang, i18nKey);
  if (i18nKey === "aiErrGeneric") {
    const status = opts?.status ?? (code.startsWith("http_") ? Number(code.slice(5)) : 0);
    base = base.replace("{status}", String(status || "?"));
  }
  const detail = opts?.detail ? stripNoise(opts.detail) : "";
  const msg = detail ? `${base} (${detail})` : base;
  return msg.slice(0, MAX_USER_MSG);
}

function mapStatusCode(
  status: number,
  providerMessage?: string
): { code: string } {
  if (status === 401 || status === 403) {
    return { code: "key_invalid" };
  }
  if (status === 429) {
    const quotaLike =
      /quota|exceeded|billing|rate.?limit|resource.?exhausted/i.test(
        providerMessage || ""
      );
    return { code: quotaLike ? "quota_exceeded" : "rate_limited" };
  }
  if (status === 400 || status === 422) {
    return { code: "bad_request" };
  }
  if (status >= 500 && status < 600) {
    return { code: "provider_unavailable" };
  }
  return { code: `http_${status}` };
}

/** Extract human message from known provider JSON shapes. */
export function extractProviderMessage(
  provider: AiProviderId | string,
  body: string
): string | undefined {
  void provider;
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
    // Anthropic / OpenAI / xAI nested or flat message
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
  body: string,
  lang: string | null = "en"
): ParsedProviderError {
  const raw = (body || "").slice(0, 2000);
  const providerMessage = extractProviderMessage(provider, body);
  const mapped = mapStatusCode(status, providerMessage);
  const message = formatProviderError(mapped.code, {
    lang,
    status,
    detail: providerMessage,
  });
  return {
    message: message.slice(0, MAX_USER_MSG),
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
  body: string,
  lang: string | null = "en"
): never {
  const parsed = parseProviderError(provider, status, body, lang);
  throw new ProviderError(parsed, provider);
}

/** Normalize any thrown value into a short UI-safe string (+ optional code for logs). */
export function toUserFacingAiError(
  err: unknown,
  opts?: { maxLen?: number; lang?: string | null }
): { message: string; code?: string; raw?: string } {
  const max = opts?.maxLen ?? MAX_USER_MSG;
  const lang = resolveProviderErrorLang(opts?.lang);
  if (err instanceof ProviderError) {
    const message = formatProviderError(err.code, {
      lang,
      status: err.status,
      detail: err.providerMessage,
    });
    return {
      message: message.slice(0, max),
      code: err.code,
      raw: err.raw,
    };
  }
  if (err instanceof Error) {
    // Already-clean Error (adapters may set .message to user string)
    const msg = err.message || formatProviderError("generic", { lang, status: 500 });
    // If message still looks like dumped JSON, scrub it
    if (/^\s*\{[\s\S]*"error"/.test(msg) || /error\s+\d+:\s*\{/.test(msg)) {
      const statusMatch = /(?:error|status)\s+(\d{3})/i.exec(msg);
      const status = statusMatch ? Number(statusMatch[1]) : 500;
      const bodyStart = msg.indexOf("{");
      const body = bodyStart >= 0 ? msg.slice(bodyStart) : msg;
      const parsed = parseProviderError("unknown", status, body, lang);
      return { message: parsed.message.slice(0, max), code: parsed.code, raw: msg.slice(0, 2000) };
    }
    return { message: msg.slice(0, max) };
  }
  return {
    message: formatProviderError("generic", { lang, status: 500 }).slice(0, max),
  };
}
