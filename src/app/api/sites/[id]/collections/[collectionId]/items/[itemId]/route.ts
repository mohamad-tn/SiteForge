import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody, requireSession, requireSiteAccess } from "@/lib/api";

const patchSchema = z.object({
  data: z.record(z.string(), z.unknown()).optional(),
  sort: z.number().int().optional(),
  published: z.boolean().optional(),
});

async function ownedItem(
  siteId: string,
  collectionId: string,
  itemId: string,
  user: { id: string; role: "USER" | "ADMIN" }
) {
  const access = await requireSiteAccess(siteId, user);
  if ("response" in access) return { response: access.response };
  const col = await prisma.collection.findFirst({ where: { id: collectionId, siteId } });
  if (!col) return { response: jsonError("Not found", 404) };
  const item = await prisma.collectionItem.findFirst({ where: { id: itemId, collectionId } });
  if (!item) return { response: jsonError("Not found", 404) };
  return { item };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; collectionId: string; itemId: string }> }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id, collectionId, itemId } = await ctx.params;
  const existing = await ownedItem(id, collectionId, itemId, auth.user);
  if ("response" in existing) return existing.response;

  const parsed = await parseJsonBody(req, patchSchema, "Invalid payload");
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  const item = await prisma.collectionItem.update({
    where: { id: itemId },
    data: {
      ...(body.data !== undefined ? { data: body.data as object } : {}),
      ...(body.sort !== undefined ? { sort: body.sort } : {}),
      ...(body.published !== undefined ? { published: body.published } : {}),
    },
  });
  return NextResponse.json({ item });
}

export async function DELETE(
  _: Request,
  ctx: { params: Promise<{ id: string; collectionId: string; itemId: string }> }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id, collectionId, itemId } = await ctx.params;
  const existing = await ownedItem(id, collectionId, itemId, auth.user);
  if ("response" in existing) return existing.response;
  await prisma.collectionItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
