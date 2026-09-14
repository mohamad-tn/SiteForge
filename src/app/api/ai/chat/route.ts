import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody, requireSession, requireSiteAccess } from "@/lib/api";
import { siteContentSchema, type SiteContent } from "@/lib/design";
import {
  AI_SYSTEM_PROMPT,
  applyAiPatches,
  aiPatchesResponseSchema,
  extractJsonObject,
} from "@/lib/ai/patches";
import {
  getProviderAdapter,
  modelLikelySupportsVision,
  type AiChatMessage,
  type AiContentPart,
  type AiProviderId,
} from "@/lib/ai/providers";
import { consumeQuota, getQuotaStatus } from "@/lib/ai/quota";
import { ensurePlatformAiSettings, getDecryptedPlatformApiKey } from "@/lib/ai/settings";
import {
  aiAttachmentsField,
  buildAttachmentPromptParts,
  validateAttachmentLimits,
  type AiAttachment,
} from "@/lib/ai/attachments";
import { checkRateLimit, clientIpFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  siteId: z.string().min(1),
  message: z.string().min(1).max(4000),
  content: siteContentSchema,
  locale: z.string().min(2).max(12).optional(),
  attachments: aiAttachmentsField,
});

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

  const settings = await ensurePlatformAiSettings();
  const apiKey = await getDecryptedPlatformApiKey();
  if (!settings.enabled || !apiKey) {
    return jsonError("AI_DISABLED", 503, {
      message: "AI is not configured. Ask a platform admin to enable it.",
    });
  }

  const quota = await getQuotaStatus(auth.user.id);
  if (quota.remaining <= 0) {
    return jsonError("QUOTA_EXCEEDED", 429, { quota });
  }

  const content = parsed.data.content as SiteContent;
  const compact = {
    locales: content.locales,
    defaultLocale: content.defaultLocale,
    pages: content.pages.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      blocks: p.blocks.map((b) => ({
        id: b.id,
        type: b.type,
        props: b.props,
      })),
    })),
  };

  const attParts = buildAttachmentPromptParts(attachments);
  const visionOk = modelLikelySupportsVision(settings.model);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        send({ type: "step", step: "thinking", message: "Planning edits…" });
        await consumeQuota(auth.user.id);

        const adapter = getProviderAdapter(settings.provider as AiProviderId);
        send({ type: "step", step: "calling_model", message: `Calling ${settings.provider}…` });

        const userText = [
          `Site id: ${parsed.data.siteId}`,
          `Preferred locale: ${parsed.data.locale || content.defaultLocale}`,
          `User goal:\n${parsed.data.message}`,
          attParts.textBlocks.length ? `Attachments:\n${attParts.textBlocks.join("\n\n")}` : "",
          attParts.mediaUrls.length
            ? `Site media URLs (prefer these in image blocks): ${attParts.mediaUrls.join(", ")}`
            : "",
          `Current draft (JSON):\n${JSON.stringify(compact).slice(0, 120_000)}`,
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

        const messages: AiChatMessage[] = [
          { role: "system", content: AI_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ];

        const result = await adapter.complete({
          apiKey,
          model: settings.model,
          maxTokens: settings.maxTokens,
          messages,
        });

        send({ type: "step", step: "parsing", message: "Parsing patches…" });
        const raw = extractJsonObject(result.text);
        const validated = aiPatchesResponseSchema.safeParse(raw);
        if (!validated.success) {
          await prisma.aiUsageLog.create({
            data: {
              userId: auth.user.id,
              siteId: parsed.data.siteId,
              provider: settings.provider,
              model: settings.model,
              tokensIn: result.tokensIn || 0,
              tokensOut: result.tokensOut || 0,
              ok: false,
              error: "Invalid model JSON",
            },
          });
          send({
            type: "error",
            error: "Model returned invalid patches",
            ...(process.env.NODE_ENV === "production"
              ? {}
              : { raw: result.text.slice(0, 1500) }),
          });
          controller.close();
          return;
        }

        send({ type: "step", step: "applying", message: "Applying validated patches…" });
        const applied = applyAiPatches(content, validated.data.patches);

        await prisma.aiUsageLog.create({
          data: {
            userId: auth.user.id,
            siteId: parsed.data.siteId,
            provider: settings.provider,
            model: settings.model,
            tokensIn: result.tokensIn || 0,
            tokensOut: result.tokensOut || 0,
            ok: applied.applied > 0,
            error: applied.errors.length ? applied.errors.join("; ").slice(0, 500) : null,
          },
        });

        const nextQuota = await getQuotaStatus(auth.user.id);
        send({
          type: "result",
          summary: validated.data.summary || "",
          applied: applied.applied,
          errors: applied.errors,
          content: applied.content,
          quota: nextQuota,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "AI failed";
        console.error(e);
        await prisma.aiUsageLog
          .create({
            data: {
              userId: auth.user.id,
              siteId: parsed.data.siteId,
              provider: settings.provider,
              model: settings.model,
              ok: false,
              error: msg.slice(0, 500),
            },
          })
          .catch(() => null);
        // Never stream stack traces to the client
        send({
          type: "error",
          error: process.env.NODE_ENV === "production" ? "AI request failed" : msg.slice(0, 300),
        });
      } finally {
        controller.close();
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
