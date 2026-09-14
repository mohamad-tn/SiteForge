import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

/** Prefer admin/layout.tsx 403 UI for /admin pages; keep redirect for legacy callers. */
export async function requireAdmin() {
  const user = await requireUser();
  const db = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (!db || db.role !== "ADMIN") redirect("/dashboard");
  return { ...user, role: "ADMIN" as const };
}
