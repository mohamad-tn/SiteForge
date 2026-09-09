import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api";

const schema = z.object({
  slug: z.string().min(1).max(80),
  path: z.string().max(500).optional(),
  locale: z.string().max(16).optional(),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, schema, "Invalid payload");
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  const site = await prisma.site.findUnique({
    where: { slug: body.slug },
    select: { id: true, publishedAt: true },
  });
  if (!site || !site.publishedAt) return jsonError("Not found", 404);

  await prisma.siteEvent.create({
    data: {
      siteId: site.id,
      type: "page_view",
      path: body.path || "/",
      locale: body.locale,
    },
  });
  return NextResponse.json({ ok: true });
}
