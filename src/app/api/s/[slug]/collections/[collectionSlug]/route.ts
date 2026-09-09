import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ slug: string; collectionSlug: string }> }
) {
  const { slug, collectionSlug } = await ctx.params;
  const site = await prisma.site.findUnique({
    where: { slug },
    select: { id: true, publishedAt: true },
  });
  if (!site || !site.publishedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const collection = await prisma.collection.findFirst({
    where: { siteId: site.id, slug: collectionSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      fields: true,
      items: {
        where: { published: true },
        orderBy: { sort: "asc" },
        select: { id: true, data: true, sort: true },
      },
    },
  });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ collection });
}
