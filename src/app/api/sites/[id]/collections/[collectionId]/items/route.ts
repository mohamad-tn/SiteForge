import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody, requireSession, requireSiteAccess } from "@/lib/api";

const createSchema = z.object({
  data: z.record(z.string(), z.unknown()).refine((o) => Object.keys(o).length <= 40, {
    message: "Too many fields",
  }),
  sort: z.number().int().optional(),
  published: z.boolean().optional(),
});

async function assertCollection(
  siteId: string,
  collectionId: string,
  user: { id: string; role: "USER" | "ADMIN" }
) {
  const access = await requireSiteAccess(siteId, user);
  if ("response" in access) return { response: access.response };
  const col = await prisma.collection.findFirst({ where: { id: collectionId, siteId } });
  if (!col) return { response: jsonError("Not found", 404) };
  return { col };
}

export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string; collectionId: string }> }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id, collectionId } = await ctx.params;
  const check = await assertCollection(id, collectionId, auth.user);
  if ("response" in check) return check.response;
  const items = await prisma.collectionItem.findMany({
    where: { collectionId },
    orderBy: { sort: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; collectionId: string }> }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id, collectionId } = await ctx.params;
  const check = await assertCollection(id, collectionId, auth.user);
  if ("response" in check) return check.response;

  const parsed = await parseJsonBody(req, createSchema, "Invalid payload");
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  const max = await prisma.collectionItem.aggregate({
    where: { collectionId },
    _max: { sort: true },
  });
  const item = await prisma.collectionItem.create({
    data: {
      collectionId,
      data: body.data as object,
      sort: body.sort ?? (max._max.sort ?? 0) + 1,
      published: body.published ?? true,
    },
  });
  return NextResponse.json({ item }, { status: 201 });
}
