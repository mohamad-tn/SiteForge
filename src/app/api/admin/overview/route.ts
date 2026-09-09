import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/api";

export async function GET() {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
  const [users, sites, published, views7d, recentEvents, recentUsers] = await Promise.all([
    prisma.user.count(),
    prisma.site.count(),
    prisma.site.count({ where: { publishedAt: { not: null } } }),
    prisma.siteEvent.count({ where: { type: "page_view", createdAt: { gte: since } } }),
    prisma.siteEvent.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { site: { select: { name: true, slug: true, ownerId: true } } },
    }),
    prisma.user.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, role: true, createdAt: true, lastLoginAt: true },
    }),
  ]);

  return NextResponse.json({
    metrics: { users, sites, published, views7d },
    recentEvents,
    recentUsers,
  });
}
