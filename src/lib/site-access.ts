import { prisma } from "@/lib/prisma";

/** Strict owner check (no admin bypass). */
export async function getOwnedSite(id: string, userId: string) {
  return prisma.site.findFirst({ where: { id, ownerId: userId } });
}

export async function assertOwnedSite(id: string, userId: string) {
  return getOwnedSite(id, userId);
}

/**
 * Tenant isolation with admin override for platform ops.
 * Never trust client-supplied ownership — always resolve from session + DB.
 */
export async function assertAccessibleSite(
  id: string,
  userId: string,
  role: "USER" | "ADMIN" = "USER"
) {
  if (role === "ADMIN") {
    return prisma.site.findFirst({ where: { id } });
  }
  return getOwnedSite(id, userId);
}
