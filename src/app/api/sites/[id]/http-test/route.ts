import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBody, requireSession, requireSiteAccess } from "@/lib/api";
import {
  PROXY_MAX_RESPONSE_BYTES,
  PROXY_TIMEOUT_MS,
  assertSafeProxyUrl,
  buildRequest,
  parseHttpAction,
  redactHeadersForLog,
} from "@/lib/http-action";
import {
  applySiteSecretsToAction,
  collectSecretNamesFromAction,
  loadSiteSecretMap,
} from "@/lib/site-secrets";

export const runtime = "nodejs";

const bodySchema = z.object({
  httpAction: z.unknown(),
  sampleData: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Owner-only dry-run of an HttpAction (from editor Test button).
 * Accepts the action payload from the client so unsaved drafts can be tested.
 * Secrets resolve from the site vault server-side only.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await requireSiteAccess(id, auth.user);
  if ("response" in access) return access.response;
  const site = access.site;

  const parsed = await parseJsonBody(req, bodySchema, "Invalid payload");
  if ("response" in parsed) return parsed.response;

  const action = parseHttpAction(parsed.data.httpAction);
  if (!action.url?.trim()) {
    return jsonError("URL required", 400);
  }

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

  const formData: Record<string, unknown> = {};
  if (parsed.data.sampleData) {
    for (const [k, v] of Object.entries(parsed.data.sampleData)) {
      if (typeof v === "string") formData[k.slice(0, 60)] = v.slice(0, 4000);
      else if (typeof v === "number" || typeof v === "boolean") formData[k.slice(0, 60)] = v;
    }
  }

  let built;
  try {
    built = buildRequest(resolvedAction, {
      formData,
      omitSecrets: action.runMode === "browser",
    });
  } catch {
    return jsonError("Invalid request configuration", 400);
  }

  const safe = assertSafeProxyUrl(built.url);
  if (!safe.ok) {
    return jsonError(safe.error, 400);
  }

  const summary = {
    method: built.method,
    url: built.url,
    headers: redactHeadersForLog(built.headers, resolvedAction),
    bodyPreview:
      built.body == null
        ? null
        : typeof built.body === "string"
          ? built.body.slice(0, 800)
          : String(built.body).slice(0, 800),
    runMode: action.runMode,
  };

  // Browser mode: only validate + return summary (browser would CORS-fail from server anyway)
  if (action.runMode === "browser") {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      message: "Browser mode — summary only (no server fetch). Use proxy mode to execute via SiteForge.",
      summary,
      status: null,
      bodyPreview: null,
    });
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
    const ok = upstream.status >= 200 && upstream.status < 300;
    return NextResponse.json({
      ok,
      dryRun: false,
      status: upstream.status,
      truncated,
      summary,
      bodyPreview: text.slice(0, 4000),
      message: ok
        ? resolvedAction.successMessage || "OK"
        : resolvedAction.errorMessage || `Upstream returned ${upstream.status}`,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      {
        ok: false,
        dryRun: false,
        summary,
        status: null,
        bodyPreview: null,
        error: aborted ? "Upstream timeout" : "Upstream request failed",
        message: aborted ? "انتهت مهلة الطلب" : "فشل الاتصال",
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}
