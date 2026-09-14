import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/api";

export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const type = (url.searchParams.get("type") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") || 20)));

  const where: Prisma.SiteEventWhereInput = {};
  if (type && type !== "all") where.type = type;
  if (q) {
    where.OR = [
      { path: { contains: q, mode: "insensitive" } },
      { type: { contains: q, mode: "insensitive" } },
      { site: { name: { contains: q, mode: "insensitive" } } },
      { site: { slug: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, events] = await Promise.all([
    prisma.siteEvent.count({ where }),
    prisma.siteEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        path: true,
        createdAt: true,
        site: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);

  return NextResponse.json({
    events,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  });
}
