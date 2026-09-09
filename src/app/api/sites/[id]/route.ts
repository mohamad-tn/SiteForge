import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureContentDefaults, siteContentSchema } from "@/lib/design";
import { sanitizeCustomCss } from "@/lib/sanitize-css";
import { isZodError, jsonError, parseJsonBody, requireSession, requireSiteAccess } from "@/lib/api";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await requireSiteAccess(id, auth.user);
  if ("response" in access) return access.response;
  return NextResponse.json({ site: access.site });
}

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  draftContent: siteContentSchema.optional(),
  publish: z.boolean().optional(),
  seoTitle: z.string().max(120).nullable().optional(),
  seoDescription: z.string().max(320).nullable().optional(),
  ogImage: z.string().max(500).nullable().optional(),
  favicon: z.string().max(500).nullable().optional(),
  customCss: z.string().max(20000).nullable().optional(),
  customDomain: z
    .union([
      z.literal(""),
      z
        .string()
        .max(253)
        .regex(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i, "Invalid domain"),
      z.null(),
    ])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  domainStatus: z.enum(["none", "pending", "active", "error"]).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await requireSiteAccess(id, auth.user);
  if ("response" in access) return access.response;
  const existing = access.site;

  const parsed = await parseJsonBody(req, patchSchema, "Invalid content");
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  try {
    const data: Record<string, unknown> = {};
    if (body.name) data.name = body.name;
    if (body.draftContent) data.draftContent = ensureContentDefaults(body.draftContent);
    if (body.seoTitle !== undefined) data.seoTitle = body.seoTitle;
    if (body.seoDescription !== undefined) data.seoDescription = body.seoDescription;
    if (body.ogImage !== undefined) data.ogImage = body.ogImage;
    if (body.favicon !== undefined) data.favicon = body.favicon;
    if (body.customCss !== undefined) data.customCss = sanitizeCustomCss(body.customCss) || null;
    if (body.customDomain !== undefined) {
      const domain = body.customDomain ? String(body.customDomain).toLowerCase().trim() : null;
      data.customDomain = domain;
      if (!domain) data.domainStatus = "none";
      else if (body.domainStatus === undefined) data.domainStatus = "pending";
    }
    if (body.domainStatus !== undefined) data.domainStatus = body.domainStatus;
    if (body.publish) {
      const content = ensureContentDefaults(
        body.draftContent || siteContentSchema.parse(existing.draftContent)
      );
      data.publishedContent = content;
      data.publishedAt = new Date();
      if (!body.draftContent) data.draftContent = content;
    }
    const site = await prisma.site.update({ where: { id }, data });
    return NextResponse.json({ site });
  } catch (e) {
    if (isZodError(e)) return jsonError("Invalid content", 400);
    console.error(e);
    return jsonError("Server error", 500);
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await requireSiteAccess(id, auth.user);
  if ("response" in access) return access.response;
  await prisma.site.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
