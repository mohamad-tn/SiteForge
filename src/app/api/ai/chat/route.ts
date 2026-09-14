import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody, requireSession, requireSiteAccess } from "@/lib/api";
import { ensureContentDefaults, siteContentSchema, type SiteContent } from "@/lib/design";
import {
  AI_EMPTY_PATCHES_HINT,
  AI_SYSTEM_PROMPT,
  applyAiPatches,
  buildAiRepairUserPrompt,
  parseAiPatchesResponse,
} from "@/lib/ai/patches";
import {
  clearAiChatCancelled,
  isAiChatCancelled,
} from "@/lib/ai/cancel-registry";
import {
  getProviderAdapter,
  modelLikelySupportsVision,
  type AiChatMessage,
  type AiContentPart,
  type AiProviderId,
} from "@/lib/ai/providers";
import { consumeQuota, getQuotaStatus } from "@/lib/ai/quota";
import {
  aiAttachmentsField,
  buildAttachmentPromptParts,
  validateAttachmentLimits,
  type AiAttachment,
} from "@/lib/ai/attachments";
import { checkRateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import {
  compactSiteForModel,
  selectRecentChatTurns,
} from "@/lib/ai/compact-context";
import {
  appendChatMessage,
  getOrCreateThread,
  listChatMessages,
} from "@/lib/ai/chat-store";
import { resolveAiKeyForUser } from "@/lib/ai/resolve-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  siteId: z.string().min(1),
  message: z.string().min(1).max(4000),
  content: siteContentSchema,
  locale: z.string().min(2).max(12).optional(),
  attachments: aiAttachmentsField,
  /** Client message id for cancel/partial tracking */
  clientMessageId: z.string().max(64).optional(),
  /** When true, client is cancelling — only then should work stop early */
  clientCancel: z.boolean().optional(),
});

function attachmentMeta(atts: AiAttachment[]) {
  return atts.map((a) => ({
    type: a.type,
    name: a.name,
    mime: a.mime,
    mediaUrl: a.mediaUrl || null,
    thumb: a.type === "image" ? a.mediaUrl || (a.dataUrl ? a.dataUrl.slice(0, 120) + "…" : null) : null,
    previewUrl: a.type === "image" ? a.mediaUrl || a.dataUrl || null : null,
  }));
}

type StepRec = { step: string; message: string; at?: string };

export async function GET(req: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const url = new URL(req.url);
  const siteId = url.searchParams.get("siteId");
  const cursor = url.searchParams.get("cursor");
  if (!siteId) return jsonError("siteId required", 400);
  const access = await requireSiteAccess(siteId, auth.user);
  if ("response" in access) return access.response;

  const thread = await getOrCreateThread(auth.user.id, siteId);
  const page = await listChatMessages({
    threadId: thread.id,
    cursor,
    take: 20,
  });
  return Response.json({
    threadId: thread.id,
    messages: page.messages.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      status: m.status,
      attachmentMeta: m.attachmentMeta,
      steps: m.steps,
      createdAt: m.createdAt.toISOString(),
    })),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  });
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const ip = clientIpFromRequest(req);
  const rl = checkRateLimit(`ai:${auth.user.id}:${ip}`, 30, 60_000);
  if (!rl.ok) return jsonError("Too many requests", 429);

  const parsed = await parseJsonBody(req, bodySchema);
  if ("response" in parsed) return parsed.response;

  const attachments = (parsed.data.attachments || []) as AiAttachment[];
  for (const a of attachments) {
    const err = validateAttachmentLimits(a);
    if (err) return jsonError(err, 400);
  }

  const access = await requireSiteAccess(parsed.data.siteId, auth.user);
  if ("response" in access) return access.response;

  const resolved = await resolveAiKeyForUser(auth.user.id);
  if (!resolved.available) {
    return jsonError("AI_DISABLED", 503, {
      message: "AI is not configured. Add a personal key or ask a platform admin.",
      reason: resolved.reason,
    });
  }

  let quota = null as Awaited<ReturnType<typeof getQuotaStatus>> | null;
  if (resolved.usePlatformQuota) {
    quota = await getQuotaStatus(auth.user.id);
    if (quota.remaining <= 0) {
      return jsonError("QUOTA_EXCEEDED", 429, { quota });
    }
  }

  const content = parsed.data.content as SiteContent;
  const locale = parsed.data.locale || content.defaultLocale;
  const compact = compactSiteForModel(content, locale);

  const thread = await getOrCreateThread(auth.user.id, parsed.data.siteId);
  const historyPage = await listChatMessages({ threadId: thread.id, take: 20 });
  const historyForModel = selectRecentChatTurns(
    historyPage.messages.map((m) => ({ role: m.role, text: m.text }))
  );

  const userMsg = await appendChatMessage({
    threadId: thread.id,
    role: "user",
    text: parsed.data.message,
    attachmentMeta: attachmentMeta(attachments),
    status: "ok",
  });

  const assistantPartial = await appendChatMessage({
    threadId: thread.id,
    role: "assistant",
    text: "",
    steps: [],
    status: "partial",
  });

  const attParts = buildAttachmentPromptParts(attachments);
  const visionOk = modelLikelySupportsVision(resolved.model);
  /**
   * Durable AI run:
   * - req.signal abort (tab hide / SSE disconnect / fetch kill) ONLY stops writing SSE.
   * - Model call + patch apply + draft persist + assistant message ALWAYS continue.
   * - Explicit Cancel: Cancel button → POST /api/ai/chat/cancel → isAiChatCancelled(id).
   * Do NOT wire req.signal into cancelled work flags.
   */
  const disconnectSignal = req.signal;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let sseOpen = true;
      const send = (obj: unknown) => {
        if (!sseOpen) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          sseOpen = false;
        }
      };
      const steps: StepRec[] = [];

      const pushStep = (step: string, message: string) => {
        const rec = { step, message, at: new Date().toISOString() };
        steps.push(rec);
        send({ type: "step", step, message, at: rec.at });
      };

      // Disconnect ≠ cancel — only stop enqueueing SSE frames.
      const onDisconnect = () => {
        sseOpen = false;
      };
      disconnectSignal.addEventListener("abort", onDisconnect);

      const throwIfUserCancelled = () => {
        if (isAiChatCancelled(assistantPartial.id)) {
          const err = new Error("Aborted");
          err.name = "AbortError";
          throw err;
        }
      };

      try {
        // Tell client the assistant row id so Cancel can target it after disconnect.
        send({ type: "started", messageId: assistantPartial.id, userMessageId: userMsg.id });
        pushStep("thinking", "Analyzing your request… / جاري تحليل طلبك…");

        if (resolved.usePlatformQuota) {
          await consumeQuota(auth.user.id);
        }

        throwIfUserCancelled();

        pushStep(
          "planning",
          `Planning edits with ${resolved.provider}… / التخطيط عبر ${resolved.provider}…`
        );

        const adapter = getProviderAdapter(resolved.provider as AiProviderId);

        const userText = [
          `Site id: ${parsed.data.siteId}`,
          `Preferred locale: ${locale}`,
          `Enabled locales: ${(content.locales || []).join(", ")}`,
          `Default locale: ${content.defaultLocale}`,
          `User goal:\n${parsed.data.message}`,
          attParts.textBlocks.length ? `Attachments:\n${attParts.textBlocks.join("\n\n")}` : "",
          attParts.mediaUrls.length
            ? `Site media URLs (prefer these in image blocks): ${attParts.mediaUrls.join(", ")}`
            : "",
          `Current draft (compact JSON):\n${JSON.stringify(compact)}`,
        ]
          .filter(Boolean)
          .join("\n\n");

        let userContent: string | AiContentPart[] = userText;
        if (visionOk && attParts.imageDataUrls.length) {
          userContent = [
            { type: "text", text: userText },
            ...attParts.imageDataUrls.map(
              (url): AiContentPart => ({ type: "image_url", image_url: { url } })
            ),
          ];
        }

        const baseMessages: AiChatMessage[] = [
          { role: "system", content: AI_SYSTEM_PROMPT },
          ...historyForModel
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({
              role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
              content: m.text.slice(0, 2000),
            })),
          { role: "user", content: userContent },
        ];

        pushStep(
          "calling_model",
          `Calling ${resolved.provider} (${resolved.source})… / استدعاء النموذج…`
        );

        throwIfUserCancelled();

        let result = await adapter.complete({
          apiKey: resolved.apiKey,
          model: resolved.model,
          maxTokens: resolved.maxTokens,
          messages: baseMessages,
        });

        const clientGone = !sseOpen || disconnectSignal.aborted;

        pushStep("parsing", "Parsing patches… / تحليل التعديلات…");
        let parsedPatches = parseAiPatchesResponse(result.text);

        if (!parsedPatches.data) {
          pushStep(
            "repairing",
            "Repairing invalid patches… / إصلاح التعديلات غير الصالحة…"
          );
          throwIfUserCancelled();
          try {
            const repairResult = await adapter.complete({
              apiKey: resolved.apiKey,
              model: resolved.model,
              maxTokens: Math.min(resolved.maxTokens, 2048),
              messages: [
                { role: "system", content: AI_SYSTEM_PROMPT },
                { role: "user", content: userText.slice(0, 12000) },
                { role: "assistant", content: result.text.slice(0, 6000) },
                {
                  role: "user",
                  content: buildAiRepairUserPrompt(
                    result.text,
                    parsedPatches.validationIssues
                  ),
                },
              ],
            });
            result = {
              text: repairResult.text,
              tokensIn: (result.tokensIn || 0) + (repairResult.tokensIn || 0),
              tokensOut: (result.tokensOut || 0) + (repairResult.tokensOut || 0),
            };
            parsedPatches = parseAiPatchesResponse(result.text);
          } catch (repairErr) {
            if (
              repairErr instanceof Error &&
              repairErr.name === "AbortError"
            ) {
              throw repairErr;
            }
            // fall through with prior parse
          }
        }

        if (!parsedPatches.data) {
          const rawSnippet = result.text.slice(0, 400).replace(/\s+/g, " ");
          const hint =
            parsedPatches.validationIssues ||
            'styles values must be strings (paddingX:"24") / قيم styles يجب أن تكون نصوصاً';
          steps.push({
            step: "raw_snippet",
            message: `Model raw (truncated): ${rawSnippet}`,
            at: new Date().toISOString(),
          });
          await prisma.aiUsageLog.create({
            data: {
              userId: auth.user.id,
              siteId: parsed.data.siteId,
              provider: resolved.provider,
              model: resolved.model,
              tokensIn: result.tokensIn || 0,
              tokensOut: result.tokensOut || 0,
              ok: false,
              error: "Invalid model JSON",
              keySource: resolved.source,
            },
          });
          const errText =
            `Model returned invalid patches — ${hint} / النموذج أرجع تعديلات غير صالحة`;
          await prisma.aiChatMessage.update({
            where: { id: assistantPartial.id },
            data: { text: errText.slice(0, 16000), status: "error", steps },
          });
          send({
            type: "error",
            error: errText.slice(0, 800),
            messageId: assistantPartial.id,
            hint,
            rawSnippet,
            steps,
          });
          try {
            controller.close();
          } catch {
            /* */
          }
          return;
        }

        if (parsedPatches.repaired) {
          pushStep(
            "repaired",
            "Deterministic repair applied… / طُبّق إصلاح تلقائي…"
          );
        }

        throwIfUserCancelled();

        const patchCount = parsedPatches.data.patches.length;
        pushStep(
          "applying",
          `Applying ${patchCount} patch(es)… / تطبيق ${patchCount} تعديلاً…`
        );
        const applied = applyAiPatches(content, parsedPatches.data.patches);

        // Persist draft on server so tab-disconnect does not lose applied edits.
        if (applied.applied > 0) {
          await prisma.site
            .update({
              where: { id: parsed.data.siteId },
              data: { draftContent: ensureContentDefaults(applied.content) as object },
            })
            .catch((e) => console.error("AI draft persist failed", e));
        }

        await prisma.aiUsageLog.create({
          data: {
            userId: auth.user.id,
            siteId: parsed.data.siteId,
            provider: resolved.provider,
            model: resolved.model,
            tokensIn: result.tokensIn || 0,
            tokensOut: result.tokensOut || 0,
            ok: applied.applied > 0,
            error: applied.errors.length ? applied.errors.join("; ").slice(0, 500) : null,
            keySource: resolved.source,
          },
        });

        const emptySoft =
          applied.applied === 0 &&
          (patchCount === 0 || applied.errors.length > 0);
        const summary = emptySoft
          ? AI_EMPTY_PATCHES_HINT
          : parsedPatches.data.summary ||
            (applied.applied > 0
              ? `Applied ${applied.applied} patch(es)`
              : AI_EMPTY_PATCHES_HINT);

        pushStep(
          "done",
          applied.applied > 0
            ? `Done — ${applied.applied} applied / تم — ${applied.applied} تعديلاً`
            : "Done — nothing applied / تم — بلا تعديلات"
        );

        const status =
          isAiChatCancelled(assistantPartial.id)
            ? "cancelled"
            : emptySoft || (applied.errors.length && !applied.applied)
              ? "error"
              : "ok";

        await prisma.aiChatMessage.update({
          where: { id: assistantPartial.id },
          data: {
            text: summary.slice(0, 16000),
            status,
            steps,
          },
        });

        const nextQuota = resolved.usePlatformQuota
          ? await getQuotaStatus(auth.user.id)
          : quota;

        if (status === "cancelled") {
          send({
            type: "cancelled",
            error: "أُلغي",
            messageId: assistantPartial.id,
            steps,
          });
        } else if (emptySoft) {
          send({
            type: "error",
            error: summary.slice(0, 800),
            messageId: assistantPartial.id,
            applied: 0,
            steps,
          });
        } else {
          send({
            type: "result",
            summary,
            applied: applied.applied,
            errors: applied.errors,
            content: applied.content,
            quota: nextQuota,
            messageId: assistantPartial.id,
            userMessageId: userMsg.id,
            keySource: resolved.source,
            clientGone,
            steps,
          });
        }
      } catch (e) {
        const isAbort =
          (e instanceof Error && e.name === "AbortError") ||
          isAiChatCancelled(assistantPartial.id);
        const msg = e instanceof Error ? e.message : "AI failed";
        if (!isAbort) console.error(e);
        await prisma.aiUsageLog
          .create({
            data: {
              userId: auth.user.id,
              siteId: parsed.data.siteId,
              provider: resolved.provider,
              model: resolved.model,
              ok: false,
              error: (isAbort ? "cancelled" : msg).slice(0, 500),
              keySource: resolved.source,
            },
          })
          .catch(() => null);
        await prisma.aiChatMessage
          .update({
            where: { id: assistantPartial.id },
            data: {
              text: isAbort ? "أُلغي / Cancelled" : msg.slice(0, 500),
              status: isAbort ? "cancelled" : "error",
              steps,
            },
          })
          .catch(() => null);
        send({
          type: isAbort ? "cancelled" : "error",
          error: isAbort
            ? "أُلغي"
            : process.env.NODE_ENV === "production"
              ? "AI request failed"
              : msg.slice(0, 300),
          messageId: assistantPartial.id,
          steps,
        });
      } finally {
        clearAiChatCancelled(assistantPartial.id);
        disconnectSignal.removeEventListener("abort", onDisconnect);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
