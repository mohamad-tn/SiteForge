import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/site-secrets";
import {
  ensurePlatformAiSettings,
  getDecryptedPlatformApiKey,
} from "@/lib/ai/settings";
import type { AiProvider } from "@prisma/client";

export type KeySource = "platform" | "user";

export type ResolvedAiKey =
  | {
      available: true;
      source: KeySource;
      provider: AiProvider;
      model: string;
      apiKey: string;
      maxTokens: number;
      /** Platform daily quota applies only when source === platform */
      usePlatformQuota: boolean;
    }
  | {
      available: false;
      reason: "no_key" | "disabled";
      source: null;
    };

export async function resolveAiKeyForUser(userId: string): Promise<ResolvedAiKey> {
  const userSettings = await prisma.userAiSettings.findUnique({ where: { userId } });
  if (userSettings?.enabled && userSettings.encryptedApiKey) {
    try {
      const apiKey = decryptSecret(userSettings.encryptedApiKey);
      if (apiKey) {
        const platform = await ensurePlatformAiSettings();
        return {
          available: true,
          source: "user",
          provider: userSettings.provider,
          model: userSettings.model || platform.model,
          apiKey,
          maxTokens: platform.maxTokens,
          usePlatformQuota: false,
        };
      }
    } catch {
      /* fall through to platform */
    }
  }

  const platform = await ensurePlatformAiSettings();
  const apiKey = await getDecryptedPlatformApiKey();
  if (platform.enabled && apiKey) {
    return {
      available: true,
      source: "platform",
      provider: platform.provider,
      model: platform.model,
      apiKey,
      maxTokens: platform.maxTokens,
      usePlatformQuota: true,
    };
  }

  return {
    available: false,
    reason: !apiKey && !userSettings?.encryptedApiKey ? "no_key" : "disabled",
    source: null,
  };
}

export async function getAiAvailability(userId: string): Promise<{
  available: boolean;
  reason: string | null;
  source: KeySource | null;
  hasUserKey: boolean;
  platformEnabled: boolean;
}> {
  const resolved = await resolveAiKeyForUser(userId);
  const userSettings = await prisma.userAiSettings.findUnique({
    where: { userId },
    select: { encryptedApiKey: true, enabled: true },
  });
  const platform = await ensurePlatformAiSettings();
  if (resolved.available) {
    return {
      available: true,
      reason: null,
      source: resolved.source,
      hasUserKey: Boolean(userSettings?.encryptedApiKey),
      platformEnabled: platform.enabled && Boolean(platform.encryptedApiKey),
    };
  }
  return {
    available: false,
    reason: resolved.reason,
    source: null,
    hasUserKey: Boolean(userSettings?.encryptedApiKey),
    platformEnabled: platform.enabled && Boolean(platform.encryptedApiKey),
  };
}
