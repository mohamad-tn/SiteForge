import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api";
import {
  PROXY_MAX_RESPONSE_BYTES,
  PROXY_TIMEOUT_MS,
  assertSafeProxyUrl,
  buildRequest,
  findBlockInContent,
  parseHttpAction,
  redactHeadersForLog,
} from "@/lib/http-action";
import {
  applySiteSecretsToAction,
  collectSecretNamesFromAction,
  loadSiteSecretMap,
} from "@/lib/site-secrets";

const bodySchema = z.object({
  blockId: z.string().min(1).max(80),
  data: z.record(z.string(), z.unknown()).optional(),
  website: z.string().max(200).optional(), // honeypot
});

const buckets = new Map<string, { count: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const slot = buckets.get(ip);
  if (!slot || now > slot.reset) {
    buckets.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  slot.count += 1;
  return slot.count > 20;
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return jsonError("Too many requests", 429);
  }

  const site = await prisma.site.findUnique({
    where: { slug },
    select: { id: true, publishedAt: true, publishedContent: true },
  });
  if (!site || !site.publishedAt || !site.publishedContent) {
    return jsonError("Not found", 404);
  }

  const parsed = await parseJsonBody(req, bodySchema, "Invalid payload");
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  if (body.website && String(body.website).trim() !== "") {
    return NextResponse.json({ ok: true, proxied: false });
  }

  const block = findBlockInContent(site.publishedContent, body.blockId);
  if (!block) {
    return jsonError("Block not found", 404);
  }

  const action = parseHttpAction(block.props.httpAction);
  if (!action.enabled) {
    return jsonError("HTTP action disabled", 400);
  }
  if (action.runMode !== "proxy") {
    return jsonError("Block is not configured for proxy mode", 400);
  }

  const formData: Record<string, unknown> = {};
  if (body.data) {
    for (const [k, v] of Object.entries(body.data)) {
      if (typeof v === "string") formData[k.slice(0, 60)] = v.slice(0, 4000);
      else if (typeof v === "number" || typeof v === "boolean") formData[k.slice(0, 60)] = v;
    }
  }

  // Resolve vault placeholders server-side only (never in published JSON values)
  let resolvedAction = action;
  const needed = collectSecretNamesFromAction(action);
  if (needed.length > 0) {
    const secretMap = await loadSiteSecretMap(site.id);
    const applied = applySiteSecretsToAction(action, secretMap);
    if (!applied.ok) {
      return jsonError(`Missing site secret: ${applied.missing}`, 400);
    }
    resolvedAction = applied.action;
  }

  let built;
  try {
    built = buildRequest(resolvedAction, { formData, omitSecrets: false });
  } catch {
    return jsonError("Invalid request configuration", 400);
  }

  const safe = assertSafeProxyUrl(built.url);
  if (!safe.ok) {
    return jsonError(safe.error, 400);
  }

  // Optional local FormSubmission when form block + saveLocally
  let savedLocally = false;
  if (block.type === "form" && resolvedAction.saveLocally && Object.keys(formData).length > 0) {
    await prisma.formSubmission.create({
      data: {
        siteId: site.id,
        blockId: body.blockId,
        data: formData as object,
      },
    });
    savedLocally = true;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const upstream = await fetch(built.url, {
      method: built.method,
      headers: built.headers,
      body: built.body ?? undefined,
      redirect: "manual",
      signal: controller.signal,
    });

    const buf = await upstream.arrayBuffer();
    const truncated = buf.byteLength > PROXY_MAX_RESPONSE_BYTES;
    const slice = truncated ? buf.slice(0, PROXY_MAX_RESPONSE_BYTES) : buf;
    const text = new TextDecoder("utf-8", { fatal: false }).decode(slice);

    // Never log secret header values
    if (process.env.NODE_ENV !== "production") {
      console.info("[http-proxy]", {
        slug,
        blockId: body.blockId,
        method: built.method,
        host: safe.url.host,
        status: upstream.status,
        headers: redactHeadersForLog(built.headers, resolvedAction),
      });
    }

    const ok = upstream.status >= 200 && upstream.status < 300;
    return NextResponse.json({
      ok,
      proxied: true,
      savedLocally,
      status: upstream.status,
      truncated,
      // Cap client-visible body preview
      bodyPreview: text.slice(0, 2000),
      message: ok
        ? resolvedAction.successMessage || undefined
        : resolvedAction.errorMessage || `Upstream returned ${upstream.status}`,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      {
        ok: false,
        proxied: true,
        savedLocally,
        error: aborted ? "Upstream timeout" : "Upstream request failed",
        message: resolvedAction.errorMessage || (aborted ? "انتهت مهلة الطلب" : "فشل الاتصال بالـ API"),
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}
