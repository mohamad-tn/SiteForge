/**
 * Explicit AI chat cancel flags (Cancel button / POST /api/ai/chat/cancel).
 *
 * Browser tab hide / SSE disconnect must NOT cancel model work — only this
 * registry (or a future durable job queue) should flip `cancelled`.
 * Entries expire so a crashed client cannot leave sticky cancels forever.
 */
const flags = new Map<string, number>();
const TTL_MS = 15 * 60_000;

export function markAiChatCancelled(messageId: string) {
  if (!messageId) return;
  flags.set(messageId, Date.now() + TTL_MS);
}

export function isAiChatCancelled(messageId: string): boolean {
  const exp = flags.get(messageId);
  if (exp == null) return false;
  if (Date.now() > exp) {
    flags.delete(messageId);
    return false;
  }
  return true;
}

export function clearAiChatCancelled(messageId: string) {
  flags.delete(messageId);
}
