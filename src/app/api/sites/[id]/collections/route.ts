import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody, requireSession, requireSiteAccess } from "@/lib/api";

const fieldSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  type: z.enum(["text", "richtext", "image", "url"]),
});

const createSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  fields: z.array(fieldSchema).min(1).max(20),
});

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await requireSiteAccess(id, auth.user);
  if ("response" in access) return access.response;

  const collections = await prisma.collection.findMany({
    where: { siteId: id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { items: true } } },
  });
  return NextResponse.json({ collections });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await requireSiteAccess(id, auth.user);
  if ("response" in access) return access.response;

  const parsed = await parseJsonBody(req, createSchema, "Invalid payload");
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  try {
    const collection = await prisma.collection.create({
      data: {
        siteId: id,
        name: body.name,
        slug: body.slug,
        fields: body.fields,
      },
    });
    return NextResponse.json({ collection }, { status: 201 });
  } catch (e) {
    console.error(e);
    return jsonError("Server error", 500);
  }
}
