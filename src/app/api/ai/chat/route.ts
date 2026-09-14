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
import { getProviderAdapter, type AiProviderId } from "@/lib/ai/providers";
import { consumeQuota, getQuotaStatus } from "@/lib/ai/quota";
import { ensurePlatformAiSettings, getDecryptedPlatformApiKey } from "@/lib/ai/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  siteId: z.string().min(1),
  message: z.string().min(1).max(4000),
  content: siteContentSchema,
  locale: z.string().min(2).max(12).optional(),
});

/** Simple in-memory rate limit per user (best-effort; not multi-instance). */
const hits = new Map<string, { n: number; t: number }>();
function rateLimit(userId: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const row = hits.get(userId);
  if (!row || now - row.t > windowMs) {
    hits.set(userId, { n: 1, t: now });
    return true;
  }
  if (row.n >= max) return false;
  row.n += 1;
  return true;
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  if (!rateLimit(auth.user.id)) return jsonError("Too many requests", 429);

  const parsed = await parseJsonBody(req, bodySchema);
  if ("response" in parsed) return parsed.response;

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

        const result = await adapter.complete({
          apiKey,
          model: settings.model,
          maxTokens: settings.maxTokens,
          messages: [
            { role: "system", content: AI_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                `Site id: ${parsed.data.siteId}`,
                `Preferred locale: ${parsed.data.locale || content.defaultLocale}`,
                `User goal:\n${parsed.data.message}`,
                `Current draft (JSON):\n${JSON.stringify(compact).slice(0, 120_000)}`,
              ].join("\n\n"),
            },
          ],
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
            raw: result.text.slice(0, 1500),
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
        send({ type: "error", error: msg });
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
