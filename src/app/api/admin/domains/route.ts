import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/api";

export async function GET() {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;
  const sites = await prisma.site.findMany({
    where: { customDomain: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      customDomain: true,
      domainStatus: true,
      updatedAt: true,
      owner: { select: { email: true, name: true } },
    },
  });
  return NextResponse.json({ domains: sites });
}
