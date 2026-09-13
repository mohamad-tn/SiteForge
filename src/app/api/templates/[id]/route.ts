import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, requireAdminSession } from "@/lib/api";

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (!id) return jsonError("Not found", 404);

  const existing = await prisma.template.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return jsonError("Not found", 404);

  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
