import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api";

const bodySchema = z.object({
  blockId: z.string().max(80).optional(),
  data: z.record(z.string(), z.unknown()).refine((o) => Object.keys(o).length <= 40, {
    message: "Too many fields",
  }),
  website: z.string().max(200).optional(), // honeypot
});

const buckets = new Map<string, { count: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const slot = buckets.get(ip);
  if (!slot || now > slot.reset) {
    buckets.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  slot.count += 1;
  return slot.count > 12;
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return jsonError("Too many requests", 429);
  }

  const site = await prisma.site.findUnique({
    where: { slug },
    select: { id: true, publishedAt: true },
  });
  if (!site || !site.publishedAt) {
    return jsonError("Not found", 404);
  }

  const parsed = await parseJsonBody(req, bodySchema, "Invalid payload");
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  if (body.website && String(body.website).trim() !== "") {
    // honeypot filled — pretend success
    return NextResponse.json({ ok: true });
  }

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body.data || {})) {
    if (typeof v === "string") clean[k.slice(0, 60)] = v.slice(0, 4000);
    else if (typeof v === "number" || typeof v === "boolean") clean[k.slice(0, 60)] = v;
  }
  if (Object.keys(clean).length === 0) {
    return jsonError("Empty form", 400);
  }

  await prisma.formSubmission.create({
    data: {
      siteId: site.id,
      blockId: body.blockId || null,
      data: clean as object,
    },
  });
  return NextResponse.json({ ok: true });
}
