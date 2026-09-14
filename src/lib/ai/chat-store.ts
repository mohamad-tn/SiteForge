import { prisma } from "@/lib/prisma";
import { AI_UI_MESSAGE_CAP } from "@/lib/ai/compact-context";

export type ChatMsgStatus = "ok" | "error" | "cancelled" | "partial";

export async function getOrCreateThread(userId: string, siteId: string) {
  return prisma.aiChatThread.upsert({
    where: { userId_siteId: { userId, siteId } },
    update: { deletedAt: null },
    create: { userId, siteId },
  });
}

export async function pruneThreadMessages(threadId: string, keep = AI_UI_MESSAGE_CAP) {
  const count = await prisma.aiChatMessage.count({ where: { threadId } });
  if (count <= keep) return 0;
  const excess = count - keep;
  const oldest = await prisma.aiChatMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    take: excess,
    select: { id: true },
  });
  if (!oldest.length) return 0;
  await prisma.aiChatMessage.deleteMany({
    where: { id: { in: oldest.map((o) => o.id) } },
  });
  return oldest.length;
}

export async function appendChatMessage(input: {
  threadId: string;
  role: string;
  text: string;
  attachmentMeta?: unknown;
  steps?: unknown;
  status?: ChatMsgStatus;
}) {
  const row = await prisma.aiChatMessage.create({
    data: {
      threadId: input.threadId,
      role: input.role,
      text: input.text.slice(0, 16000),
      attachmentMeta: input.attachmentMeta ?? undefined,
      steps: input.steps ?? undefined,
      status: input.status || "ok",
    },
  });
  await pruneThreadMessages(input.threadId);
  return row;
}

export async function listChatMessages(input: {
  threadId: string;
  cursor?: string | null;
  take?: number;
}) {
  const take = Math.min(40, Math.max(1, input.take ?? 20));
  const rows = await prisma.aiChatMessage.findMany({
    where: {
      threadId: input.threadId,
      ...(input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: take + 1,
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  // Return chronological for UI
  const messages = page.reverse();
  const nextCursor = hasMore ? page[0]?.createdAt.toISOString() : null;
  return { messages, nextCursor, hasMore };
}

export async function softDeleteThread(userId: string, siteId: string) {
  await prisma.aiChatThread.updateMany({
    where: { userId, siteId },
    data: { deletedAt: new Date() },
  });
}
