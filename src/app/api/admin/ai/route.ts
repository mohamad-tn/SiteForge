import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody, requireAdminSession } from "@/lib/api";
import {
  ensurePlatformAiSettings,
  toPublicAiSettings,
  updatePlatformAiSettings,
} from "@/lib/ai/settings";
import { setUserDailyLimit } from "@/lib/ai/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const putSchema = z.object({
  provider: z.enum(["openai", "anthropic", "google", "xai"]).optional(),
  model: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  defaultDailyLimit: z.number().int().min(0).max(1000).optional(),
  maxTokens: z.number().int().min(256).max(128000).optional(),
  /** Write-only — omit to leave unchanged; null/"" clears */
  apiKey: z.string().max(500).nullable().optional(),
});

const quotaSchema = z.object({
  userId: z.string().min(1),
  dailyLimit: z.number().int().min(0).max(1000).nullable(),
});

export async function GET() {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;
  const row = await ensurePlatformAiSettings();
  const quotas = await prisma.tenantAiQuota.findMany({
    take: 50,
    orderBy: { updatedAt: "desc" },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  return NextResponse.json({
    settings: toPublicAiSettings(row),
    quotas: quotas.map((q) => ({
      userId: q.userId,
      email: q.user.email,
      name: q.user.name,
      dailyLimit: q.dailyLimit,
      usedToday: q.usedToday,
      resetDate: q.resetDate.toISOString(),
    })),
  });
}

export async function PUT(req: Request) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;
  const parsed = await parseJsonBody(req, putSchema);
  if ("response" in parsed) return parsed.response;

  let apiKey: string | null | undefined = undefined;
  if (parsed.data.apiKey === null || parsed.data.apiKey === "") apiKey = null;
  else if (typeof parsed.data.apiKey === "string") apiKey = parsed.data.apiKey;

  const row = await updatePlatformAiSettings({
    provider: parsed.data.provider,
    model: parsed.data.model,
    enabled: parsed.data.enabled,
    defaultDailyLimit: parsed.data.defaultDailyLimit,
    maxTokens: parsed.data.maxTokens,
    apiKey,
  });
  return NextResponse.json({ settings: toPublicAiSettings(row) });
}

export async function PATCH(req: Request) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;
  const parsed = await parseJsonBody(req, quotaSchema);
  if ("response" in parsed) return parsed.response;
  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } });
  if (!user) return jsonError("User not found", 404);
  const row = await setUserDailyLimit(parsed.data.userId, parsed.data.dailyLimit);
  return NextResponse.json({
    ok: true,
    quota: {
      userId: row.userId,
      dailyLimit: row.dailyLimit,
      usedToday: row.usedToday,
    },
  });
}
