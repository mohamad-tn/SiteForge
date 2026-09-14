/**
 * Fallback + live model catalog normalization for admin AI settings.
 * Live lists come from provider APIs when a key is available; otherwise curated fallback.
 */

import type { AiProviderId } from "@/lib/ai/providers";

export type CatalogModel = {
  id: string;
  label: string;
  vision?: boolean;
};

const FALLBACK: Record<AiProviderId, CatalogModel[]> = {
  openai: [
    { id: "gpt-4o", label: "GPT-4o", vision: true },
    { id: "gpt-4o-mini", label: "GPT-4o mini", vision: true },
    { id: "o4-mini", label: "o4-mini" },
    { id: "gpt-4.1", label: "GPT-4.1", vision: true },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini", vision: true },
    { id: "o3-mini", label: "o3-mini" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", vision: true },
    { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", vision: true },
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", vision: true },
    { id: "claude-3-opus-20240229", label: "Claude 3 Opus", vision: true },
  ],
  google: [
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", vision: true },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", vision: true },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", vision: true },
    { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", vision: true },
  ],
  xai: [
    { id: "grok-2", label: "Grok 2" },
    { id: "grok-2-vision", label: "Grok 2 Vision", vision: true },
    { id: "grok-2-latest", label: "Grok 2 Latest" },
    { id: "grok-beta", label: "Grok Beta" },
  ],
};

export function getFallbackCatalog(provider: AiProviderId): CatalogModel[] {
  return FALLBACK[provider].map((m) => ({ ...m }));
}

const CHAT_HINT =
  /gpt|o[0-9]|claude|gemini|grok|chat|instruct|sonnet|haiku|opus|flash|pro|mini|vision/i;
const SKIP_HINT =
  /embedding|whisper|tts|dall-e|davinci|curie|babbage|ada|moderation|realtime|audio|transcribe|image-1|codex/i;

function looksVision(id: string): boolean {
  return /vision|gpt-4o|gpt-4\.1|gemini|claude|grok-2-vision/i.test(id);
}

function prettyLabel(id: string): string {
  return id
    .replace(/^models\//, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Normalize raw provider model ids into a sorted, deduped chat-oriented list.
 */
export function normalizeModelList(
  provider: AiProviderId,
  rawIds: string[]
): CatalogModel[] {
  const seen = new Set<string>();
  const out: CatalogModel[] = [];
  for (const raw of rawIds) {
    let id = String(raw || "").trim();
    if (!id) continue;
    if (provider === "google") id = id.replace(/^models\//, "");
    if (seen.has(id)) continue;
    if (SKIP_HINT.test(id) && !CHAT_HINT.test(id)) continue;
    if (!CHAT_HINT.test(id) && provider !== "xai") continue;
    seen.add(id);
    const fallback = FALLBACK[provider].find((m) => m.id === id);
    out.push({
      id,
      label: fallback?.label || prettyLabel(id),
      vision: fallback?.vision ?? (looksVision(id) ? true : undefined),
    });
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

export function isAiProviderId(v: unknown): v is AiProviderId {
  return v === "openai" || v === "anthropic" || v === "google" || v === "xai";
}

/** In-memory cache ~10 minutes per provider. */
type CacheEntry = { at: number; models: CatalogModel[]; source: "live" | "fallback" };
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 10 * 60 * 1000;

export function getCachedModels(provider: AiProviderId): CacheEntry | null {
  const hit = cache.get(provider);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(provider);
    return null;
  }
  return hit;
}

export function setCachedModels(
  provider: AiProviderId,
  models: CatalogModel[],
  source: "live" | "fallback"
) {
  cache.set(provider, { at: Date.now(), models, source });
}

/** Test helper */
export function clearModelCache() {
  cache.clear();
}

export async function fetchLiveModels(
  provider: AiProviderId,
  apiKey: string
): Promise<CatalogModel[] | null> {
  try {
    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { data?: Array<{ id?: string }> };
      const ids = (data.data || []).map((m) => m.id || "").filter(Boolean);
      return normalizeModelList("openai", ids);
    }
    if (provider === "xai") {
      const res = await fetch("https://api.x.ai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { data?: Array<{ id?: string }> };
      const ids = (data.data || []).map((m) => m.id || "").filter(Boolean);
      return normalizeModelList("xai", ids);
    }
    if (provider === "google") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
      };
      const ids = (data.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m) => (m.name || "").replace(/^models\//, ""))
        .filter(Boolean);
      return normalizeModelList("google", ids);
    }
    if (provider === "anthropic") {
      // Anthropic has no stable public models.list — curated catalog only.
      // Optional lightweight probe: Messages API with max_tokens=1 is expensive; skip.
      return null;
    }
  } catch {
    return null;
  }
  return null;
}
