import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const q = (url.searchParams.get("q") || "").trim();
  const where: Record<string, unknown> = {};
  if (category && category !== "all") where.category = category;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { nameAr: { contains: q, mode: "insensitive" } },
      { descriptionAr: { contains: q, mode: "insensitive" } },
    ];
  }
  const templates = await prisma.template.findMany({
    where,
    orderBy: { nameAr: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      nameAr: true,
      description: true,
      descriptionAr: true,
      category: true,
      thumbnail: true,
    },
  });
  const categories = await prisma.template.findMany({
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return NextResponse.json({
    templates,
    categories: categories.map((c) => c.category),
  });
}
