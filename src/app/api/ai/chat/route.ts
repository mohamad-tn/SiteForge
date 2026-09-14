import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody, requireSession, requireSiteAccess } from "@/lib/api";
import { siteContentSchema, type SiteContent } from "@/lib/design";
import {
  AI_REPAIR_PROMPT,
  AI_SYSTEM_PROMPT,
  applyAiPatches,
  parseAiPatchesResponse,
} from "@/lib/ai/patches";
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
  // Only treat abort as cancel when the client explicitly aborts the fetch
  // (Cancel button). Closing the drawer must NOT abort — keep the socket open.
  const abortSignal = req.signal;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* client may have gone; still finish server work */
        }
      };
      const steps: StepRec[] = [];
      let cancelled = false;

      const pushStep = (step: string, message: string) => {
        const rec = { step, message, at: new Date().toISOString() };
        steps.push(rec);
        send({ type: "step", step, message, at: rec.at });
      };

      const onAbort = () => {
        cancelled = true;
      };
      abortSignal.addEventListener("abort", onAbort);

      const throwIfCancelled = () => {
        if (abortSignal.aborted || cancelled) {
          const err = new Error("Aborted");
          err.name = "AbortError";
          throw err;
        }
      };

      try {
        pushStep("thinking", "Analyzing your request… / جاري تحليل طلبك…");

        if (resolved.usePlatformQuota) {
          await consumeQuota(auth.user.id);
        }

        throwIfCancelled();

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

        throwIfCancelled();

        let result = await adapter.complete({
          apiKey: resolved.apiKey,
          model: resolved.model,
          maxTokens: resolved.maxTokens,
          messages: baseMessages,
        });

        // Persist even if client closed the drawer (socket may still be open,
        // or write may fail — work continues).
        const clientGone = abortSignal.aborted || cancelled;

        pushStep("parsing", "Parsing patches… / تحليل التعديلات…");
        let parsedPatches = parseAiPatchesResponse(result.text);

        if (!parsedPatches.data) {
          pushStep(
            "repairing",
            "Repairing invalid patches… / إصلاح التعديلات غير الصالحة…"
          );
          throwIfCancelled();
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
                  content: `${AI_REPAIR_PROMPT}\n\nValidation hint: output must match {"summary":string,"patches":[{op:...}]}.`,
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
            "Model returned invalid patches / النموذج أرجع تعديلات غير صالحة";
          await prisma.aiChatMessage.update({
            where: { id: assistantPartial.id },
            data: { text: errText, status: "error", steps },
          });
          send({
            type: "error",
            error: errText,
            messageId: assistantPartial.id,
            ...(process.env.NODE_ENV === "production"
              ? {}
              : { raw: result.text.slice(0, 1500) }),
          });
          controller.close();
          return;
        }

        if (parsedPatches.repaired) {
          pushStep(
            "repaired",
            "Deterministic repair applied… / طُبّق إصلاح تلقائي…"
          );
        }

        const patchCount = parsedPatches.data.patches.length;
        pushStep(
          "applying",
          `Applying ${patchCount} patch(es)… / تطبيق ${patchCount} تعديلاً…`
        );
        const applied = applyAiPatches(content, parsedPatches.data.patches);

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

        const summary =
          parsedPatches.data.summary ||
          (applied.applied > 0
            ? `Applied ${applied.applied} patch(es)`
            : "No patches applied");

        pushStep(
          "done",
          applied.applied > 0
            ? `Done — ${applied.applied} applied / تم — ${applied.applied} تعديلاً`
            : "Done — nothing applied / تم — بلا تعديلات"
        );

        await prisma.aiChatMessage.update({
          where: { id: assistantPartial.id },
          data: {
            text: summary,
            status: applied.errors.length && !applied.applied ? "error" : "ok",
            steps,
          },
        });

        const nextQuota = resolved.usePlatformQuota
          ? await getQuotaStatus(auth.user.id)
          : quota;

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
      } catch (e) {
        const isAbort = e instanceof Error && e.name === "AbortError";
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
        abortSignal.removeEventListener("abort", onAbort);
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
