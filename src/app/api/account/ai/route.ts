import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseJsonBody, requireSession } from "@/lib/api";
import { encryptSecret } from "@/lib/site-secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  provider: z.enum(["openai", "anthropic", "google", "xai"]).optional(),
  model: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  apiKey: z.string().min(8).max(500).optional().nullable(),
  clearKey: z.boolean().optional(),
});

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfUtcMonth(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const row = await prisma.userAiSettings.findUnique({ where: { userId: auth.user.id } });
  const day = startOfUtcDay();
  const month = startOfUtcMonth();
  const [todayCount, monthCount] = await Promise.all([
    prisma.aiUsageLog.count({
      where: { userId: auth.user.id, createdAt: { gte: day } },
    }),
    prisma.aiUsageLog.count({
      where: { userId: auth.user.id, createdAt: { gte: month } },
    }),
  ]);

  return NextResponse.json({
    settings: row
      ? {
          provider: row.provider,
          model: row.model,
          enabled: row.enabled,
          hasApiKey: Boolean(row.encryptedApiKey),
        }
      : {
          provider: "openai",
          model: "gpt-4o-mini",
          enabled: false,
          hasApiKey: false,
        },
    usage: { today: todayCount, month: monthCount },
  });
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const parsed = await parseJsonBody(req, patchSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;

  const data: Record<string, unknown> = {};
  if (input.provider) data.provider = input.provider;
  if (typeof input.model === "string" && input.model.trim()) {
    data.model = input.model.trim().slice(0, 120);
  }
  if (typeof input.enabled === "boolean") data.enabled = input.enabled;
  if (input.clearKey || input.apiKey === null) {
    data.encryptedApiKey = null;
    data.enabled = false;
  } else if (typeof input.apiKey === "string" && input.apiKey.trim()) {
    data.encryptedApiKey = encryptSecret(input.apiKey.trim());
  }

  const row = await prisma.userAiSettings.upsert({
    where: { userId: auth.user.id },
    update: data,
    create: {
      userId: auth.user.id,
      provider: (input.provider as "openai") || "openai",
      model: (input.model || "gpt-4o-mini").slice(0, 120),
      enabled: typeof input.enabled === "boolean" ? input.enabled : Boolean(data.encryptedApiKey),
      encryptedApiKey: (data.encryptedApiKey as string | null | undefined) ?? null,
    },
  });

  return NextResponse.json({
    settings: {
      provider: row.provider,
      model: row.model,
      enabled: row.enabled,
      hasApiKey: Boolean(row.encryptedApiKey),
    },
  });
}
