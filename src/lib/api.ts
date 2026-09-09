import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import type { Site } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { assertAccessibleSite } from "@/lib/site-access";

export type SessionUser = {
  id: string;
  role: "USER" | "ADMIN";
  email?: string | null;
  name?: string | null;
};

/** Consistent JSON error shape for mutating/auth APIs. */
export function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra || {}) }, { status });
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
  if (auth.user.role !== "ADMIN") {
    return { response: jsonError("Forbidden", 403) };
  }
  return auth;
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
