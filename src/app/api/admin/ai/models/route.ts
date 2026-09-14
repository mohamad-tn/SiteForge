import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api";
import { getDecryptedPlatformApiKey, ensurePlatformAiSettings } from "@/lib/ai/settings";
import {
  fetchLiveModels,
  getCachedModels,
  getFallbackCatalog,
  isAiProviderId,
  setCachedModels,
  type CatalogModel,
} from "@/lib/ai/model-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ai/models?provider=openai|anthropic|google|xai
 * Live list when encrypted platform key matches provider; else curated fallback.
 * Anthropic has no public models.list — always curated (documented).
 */
export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const providerRaw = url.searchParams.get("provider") || "openai";
  if (!isAiProviderId(providerRaw)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const cached = getCachedModels(providerRaw);
  if (cached) {
    return NextResponse.json({
      provider: providerRaw,
      source: cached.source,
      models: cached.models,
      cached: true,
    });
  }

  const settings = await ensurePlatformAiSettings();
  const key = await getDecryptedPlatformApiKey();
  let models: CatalogModel[] | null = null;
  let source: "live" | "fallback" = "fallback";

  if (key && settings.provider === providerRaw && providerRaw !== "anthropic") {
    models = await fetchLiveModels(providerRaw, key);
    if (models && models.length) source = "live";
  }

  if (!models || !models.length) {
    models = getFallbackCatalog(providerRaw);
    source = "fallback";
  }

  setCachedModels(providerRaw, models, source);
  return NextResponse.json({
    provider: providerRaw,
    source,
    models,
    cached: false,
    note:
      providerRaw === "anthropic"
        ? "Anthropic has no public models.list API — curated fallback catalog."
        : undefined,
  });
}
