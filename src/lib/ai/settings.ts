import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/site-secrets";
import type { AiProvider } from "@prisma/client";

export type AiSettingsPublic = {
  provider: AiProvider;
  model: string;
  enabled: boolean;
  defaultDailyLimit: number;
  maxTokens: number;
  hasApiKey: boolean;
  updatedAt: string;
};

export async function ensurePlatformAiSettings() {
  return prisma.platformAiSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      provider: "openai",
      model: "gpt-4o-mini",
      enabled: false,
      defaultDailyLimit: 20,
      maxTokens: 4096,
    },
  });
}

export function toPublicAiSettings(row: {
  provider: AiProvider;
  model: string;
  enabled: boolean;
  defaultDailyLimit: number;
  maxTokens: number;
  encryptedApiKey: string | null;
  updatedAt: Date;
}): AiSettingsPublic {
  return {
    provider: row.provider,
    model: row.model,
    enabled: row.enabled,
    defaultDailyLimit: row.defaultDailyLimit,
    maxTokens: row.maxTokens,
    hasApiKey: Boolean(row.encryptedApiKey),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getDecryptedPlatformApiKey(): Promise<string | null> {
  const row = await ensurePlatformAiSettings();
  if (!row.encryptedApiKey) return null;
  try {
    return decryptSecret(row.encryptedApiKey);
  } catch {
    return null;
  }
}

export async function updatePlatformAiSettings(input: {
  provider?: AiProvider;
  model?: string;
  enabled?: boolean;
  defaultDailyLimit?: number;
  maxTokens?: number;
  apiKey?: string | null;
}) {
  const data: Record<string, unknown> = {};
  if (input.provider) data.provider = input.provider;
  if (typeof input.model === "string" && input.model.trim()) data.model = input.model.trim().slice(0, 120);
  if (typeof input.enabled === "boolean") data.enabled = input.enabled;
  if (typeof input.defaultDailyLimit === "number") {
    data.defaultDailyLimit = Math.max(0, Math.min(1000, Math.floor(input.defaultDailyLimit)));
  }
  if (typeof input.maxTokens === "number") {
    data.maxTokens = Math.max(256, Math.min(128000, Math.floor(input.maxTokens)));
  }
  if (input.apiKey === null) {
    data.encryptedApiKey = null;
  } else if (typeof input.apiKey === "string" && input.apiKey.trim()) {
    data.encryptedApiKey = encryptSecret(input.apiKey.trim());
  }
  await ensurePlatformAiSettings();
  return prisma.platformAiSettings.update({
    where: { id: "default" },
    data,
  });
}
