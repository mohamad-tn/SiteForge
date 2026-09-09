import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, requireSession, requireSiteAccess } from "@/lib/api";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await requireSiteAccess(id, auth.user);
  if ("response" in access) return access.response;

  const url = new URL(req.url);
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get("take") || 50)));
  const submissions = await prisma.formSubmission.findMany({
    where: { siteId: id },
    orderBy: { createdAt: "desc" },
    take,
  });
  return NextResponse.json({ submissions });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await requireSiteAccess(id, auth.user);
  if ("response" in access) return access.response;

  const url = new URL(req.url);
  const submissionId = url.searchParams.get("submissionId");
  if (!submissionId) return jsonError("submissionId required", 400);
  const existing = await prisma.formSubmission.findFirst({
    where: { id: submissionId, siteId: id },
  });
  if (!existing) return jsonError("Not found", 404);
  await prisma.formSubmission.delete({ where: { id: submissionId } });
  return NextResponse.json({ ok: true });
}
