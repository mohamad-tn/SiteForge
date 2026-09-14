import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import type { Site } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { assertAccessibleSite } from "@/lib/site-access";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  role: "USER" | "ADMIN";
  email?: string | null;
  name?: string | null;
};

/**
 * Consistent JSON error shape for mutating/auth APIs.
 * Never attach stack traces — log server-side only.
 */
export function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  const safe: Record<string, unknown> = { error };
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (k === "stack" || k === "cause") continue;
      if (process.env.NODE_ENV === "production" && (k === "details" || k === "raw")) continue;
      safe[k] = v;
    }
  }
  return NextResponse.json(safe, { status });
}

/** Production-safe catch: log full error, return generic message (no stack in JSON). */
export function jsonServerError(e: unknown, publicMessage = "Server error") {
  console.error(e);
  return jsonError(publicMessage, 500);
}

export async function requireSession(): Promise<
  { user: SessionUser } | { response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { response: jsonError("Unauthorized", 401) };
  }
  return {
    user: {
      id: session.user.id,
      role: session.user.role || "USER",
      email: session.user.email,
      name: session.user.name,
    },
  };
}

export async function requireAdminSession(): Promise<
  { user: SessionUser } | { response: NextResponse }
> {
  const auth = await requireSession();
  if ("response" in auth) return auth;
  // Never trust JWT alone for admin — refresh role from DB.
  const db = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { role: true },
  });
  if (!db || db.role !== "ADMIN") {
    return { response: jsonError("Forbidden", 403) };
  }
  return { user: { ...auth.user, role: "ADMIN" } };
}

/** Owner or platform admin may access the site row. */
export async function requireSiteAccess(
  siteId: string,
  user: SessionUser
): Promise<{ site: Site } | { response: NextResponse }> {
  const site = await assertAccessibleSite(siteId, user.id, user.role);
  if (!site) return { response: jsonError("Not found", 404) };
  return { site };
}

export async function parseJsonBody<T>(
  req: Request,
  schema: z.ZodType<T>,
  invalidMessage = "Invalid payload"
): Promise<{ data: T } | { response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { response: jsonError("Invalid JSON", 400) };
  }
  try {
    return { data: schema.parse(raw) };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { response: jsonError(invalidMessage, 400) };
    }
    return { response: jsonError(invalidMessage, 400) };
  }
}

export function isZodError(e: unknown): e is z.ZodError {
  return e instanceof z.ZodError;
}
