import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody, requireSession, requireSiteAccess } from "@/lib/api";

const fieldSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  type: z.enum(["text", "richtext", "image", "url"]),
});

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  fields: z.array(fieldSchema).min(1).max(20).optional(),
});

async function ownedCollection(siteId: string, collectionId: string, user: { id: string; role: "USER" | "ADMIN" }) {
  const access = await requireSiteAccess(siteId, user);
  if ("response" in access) return { response: access.response as NextResponse };
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, siteId },
    include: { items: { orderBy: { sort: "asc" } } },
  });
  if (!collection) return { response: jsonError("Not found", 404) };
  return { collection };
}

export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string; collectionId: string }> }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id, collectionId } = await ctx.params;
  const result = await ownedCollection(id, collectionId, auth.user);
  if ("response" in result) return result.response;
  return NextResponse.json({ collection: result.collection });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; collectionId: string }> }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id, collectionId } = await ctx.params;
  const existing = await ownedCollection(id, collectionId, auth.user);
  if ("response" in existing) return existing.response;

  const parsed = await parseJsonBody(req, patchSchema, "Invalid payload");
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  const collection = await prisma.collection.update({
    where: { id: collectionId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.slug !== undefined ? { slug: body.slug } : {}),
      ...(body.fields !== undefined ? { fields: body.fields } : {}),
    },
  });
  return NextResponse.json({ collection });
}

export async function DELETE(
  _: Request,
  ctx: { params: Promise<{ id: string; collectionId: string }> }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id, collectionId } = await ctx.params;
  const existing = await ownedCollection(id, collectionId, auth.user);
  if ("response" in existing) return existing.response;
  await prisma.collection.delete({ where: { id: collectionId } });
  return NextResponse.json({ ok: true });
}
