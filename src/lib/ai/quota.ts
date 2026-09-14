import { prisma } from "@/lib/prisma";
import { ensurePlatformAiSettings } from "@/lib/ai/settings";

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export type QuotaStatus = {
  allowed: boolean;
  dailyLimit: number;
  usedToday: number;
  remaining: number;
};

export async function getQuotaStatus(userId: string): Promise<QuotaStatus> {
  const settings = await ensurePlatformAiSettings();
  const today = startOfUtcDay();
  let row = await prisma.tenantAiQuota.findUnique({ where: { userId } });
  if (!row) {
    row = await prisma.tenantAiQuota.create({
      data: { userId, usedToday: 0, resetDate: today },
    });
  } else if (row.resetDate < today) {
    row = await prisma.tenantAiQuota.update({
      where: { userId },
      data: { usedToday: 0, resetDate: today },
    });
  }
  const dailyLimit = row.dailyLimit ?? settings.defaultDailyLimit;
  const usedToday = row.usedToday;
  const remaining = Math.max(0, dailyLimit - usedToday);
  return {
    allowed: settings.enabled && remaining > 0,
    dailyLimit,
    usedToday,
    remaining,
  };
}

export async function consumeQuota(userId: string): Promise<QuotaStatus> {
  const before = await getQuotaStatus(userId);
  if (!before.allowed) return before;
  await prisma.tenantAiQuota.update({
    where: { userId },
    data: { usedToday: { increment: 1 } },
  });
  return getQuotaStatus(userId);
}

export async function setUserDailyLimit(userId: string, dailyLimit: number | null) {
  const today = startOfUtcDay();
  return prisma.tenantAiQuota.upsert({
    where: { userId },
    update: {
      dailyLimit: dailyLimit === null ? null : Math.max(0, Math.min(1000, Math.floor(dailyLimit))),
    },
    create: {
      userId,
      dailyLimit: dailyLimit === null ? null : Math.max(0, Math.min(1000, Math.floor(dailyLimit))),
      usedToday: 0,
      resetDate: today,
    },
  });
}
