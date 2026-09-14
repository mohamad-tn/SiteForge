import { z } from "zod";
import { parseJsonBody, requireSession, requireSiteAccess } from "@/lib/api";
import { markAiChatCancelled } from "@/lib/ai/cancel-registry";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  siteId: z.string().min(1),
  /** Assistant partial message id from SSE `started` event */
  messageId: z.string().min(1).max(64),
});

/**
 * Explicit user Cancel only. Tab close / fetch abort must not hit this.
 * Sets in-memory cancel flag + marks the assistant row cancelled when still partial.
 */
export async function POST(req: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const parsed = await parseJsonBody(req, bodySchema);
  if ("response" in parsed) return parsed.response;

  const access = await requireSiteAccess(parsed.data.siteId, auth.user);
  if ("response" in access) return access.response;

  markAiChatCancelled(parsed.data.messageId);

  const row = await prisma.aiChatMessage.findUnique({
    where: { id: parsed.data.messageId },
    include: { thread: true },
  });
  if (
    row &&
    row.thread.userId === auth.user.id &&
    row.thread.siteId === parsed.data.siteId &&
    row.status === "partial"
  ) {
    await prisma.aiChatMessage
      .update({
        where: { id: row.id },
        data: { status: "cancelled", text: "أُلغي / Cancelled" },
      })
      .catch(() => null);
  }

  return Response.json({ ok: true });
}
