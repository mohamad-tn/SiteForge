import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody, requireSession, requireSiteAccess } from "@/lib/api";
import {
  encryptSecret,
  isValidSecretName,
  toSecretMeta,
} from "@/lib/site-secrets";

const metaSelect = { id: true, name: true, createdAt: true, updatedAt: true } as const;

/** List secret names/ids for the site owner — never returns plaintext or ciphertext. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await requireSiteAccess(id, auth.user);
  if ("response" in access) return access.response;

  const rows = await prisma.siteSecret.findMany({
    where: { siteId: id },
    select: metaSelect,
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ secrets: rows.map(toSecretMeta) });
}

const upsertSchema = z.object({
  name: z.string().min(1).max(64),
  value: z.string().min(1).max(8000),
});

/**
 * Create or replace a secret by name.
 * Response metadata only — raw value is never echoed.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await requireSiteAccess(id, auth.user);
  if ("response" in access) return access.response;

  const parsed = await parseJsonBody(req, upsertSchema, "Invalid secret");
  if ("response" in parsed) return parsed.response;
  const name = parsed.data.name.trim();
  if (!isValidSecretName(name)) {
    return jsonError("Invalid secret name (use A-Z, a-z, 0-9, _ , -; start with a letter)", 400);
  }
  const valueEnc = encryptSecret(parsed.data.value);

  const row = await prisma.siteSecret.upsert({
    where: { siteId_name: { siteId: id, name } },
    create: { siteId: id, name, valueEnc },
    update: { valueEnc },
    select: metaSelect,
  });

  return NextResponse.json({ secret: toSecretMeta(row) }, { status: 201 });
}

/** Delete by secretId or name query param. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await requireSiteAccess(id, auth.user);
  if ("response" in access) return access.response;

  const url = new URL(req.url);
  const secretId = url.searchParams.get("secretId");
  const name = url.searchParams.get("name");
  if (!secretId && !name) return jsonError("secretId or name required", 400);

  const existing = await prisma.siteSecret.findFirst({
    where: secretId ? { id: secretId, siteId: id } : { siteId: id, name: String(name) },
    select: { id: true },
  });
  if (!existing) return jsonError("Not found", 404);
  await prisma.siteSecret.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
