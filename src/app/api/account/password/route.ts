import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody, requireSession } from "@/lib/api";
import { changePasswordBodySchema } from "@/lib/password-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const parsed = await parseJsonBody(req, changePasswordBodySchema);
  if ("response" in parsed) return parsed.response;

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { id: true, passwordHash: true },
  });
  if (!user) return jsonError("Unauthorized", 401);

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return jsonError("Current password is incorrect", 400);

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return jsonError("New password must differ from current", 400);
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
}
