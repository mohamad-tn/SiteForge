import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createBlankContent, ensureContentDefaults, siteContentSchema } from "@/lib/design";
import { slugify } from "@/lib/utils";
import { nanoid } from "nanoid";
import { jsonError, parseJsonBody, requireSession } from "@/lib/api";

export async function GET(req: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const status = url.searchParams.get("status") || "all";
  const sort = url.searchParams.get("sort") || "updated";
  const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") || 9)));

  const where: Prisma.SiteWhereInput = { ownerId: auth.user.id };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status === "published") where.publishedAt = { not: null };
  if (status === "draft") where.publishedAt = null;

  const orderBy: Prisma.SiteOrderByWithRelationInput =
    sort === "name"
      ? { name: order }
      : sort === "created"
        ? { createdAt: order }
        : { updatedAt: order };

  const [total, sites] = await Promise.all([
    prisma.site.count({ where }),
    prisma.site.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        publishedAt: true,
        updatedAt: true,
        createdAt: true,
        seoTitle: true,
        favicon: true,
      },
    }),
  ]);

  return NextResponse.json({
    sites,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(60).optional(),
  templateSlug: z.string().optional(),
  importContent: siteContentSchema.optional(),
});

export async function POST(req: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const parsed = await parseJsonBody(req, createSchema, "Invalid payload");
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  try {
    const baseSlug = slugify(body.slug || body.name);
    let slug = baseSlug;
    let i = 0;
    while (await prisma.site.findUnique({ where: { slug } })) {
      i += 1;
      slug = `${baseSlug}-${nanoid(4).toLowerCase()}`;
      if (i > 8) break;
    }

    let content = createBlankContent(body.name);
    if (body.importContent) {
      content = ensureContentDefaults(body.importContent);
    } else if (body.templateSlug) {
      const template = await prisma.template.findUnique({ where: { slug: body.templateSlug } });
      if (template) content = ensureContentDefaults(siteContentSchema.parse(template.content));
    }

    const site = await prisma.site.create({
      data: {
        name: body.name,
        slug,
        ownerId: auth.user.id,
        draftContent: content as object,
        seoTitle: body.name,
      },
    });
    return NextResponse.json({ site });
  } catch (e) {
    console.error(e);
    return jsonError("Server error", 500);
  }
}
