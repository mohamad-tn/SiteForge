import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PLATFORM_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "siteforge.local",
  "www.siteforge.local",
]);

function hostOf(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-host");
  const raw = (xf || req.headers.get("host") || "").split(",")[0].trim().toLowerCase();
  return raw.replace(/:\d+$/, "");
}

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const needsAuth =
    path.startsWith("/dashboard") || path.startsWith("/editor") || path.startsWith("/admin");

  if (needsAuth) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(login);
    }
    if (path.startsWith("/admin") && token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  const host = hostOf(req);
  if (
    host &&
    !PLATFORM_HOSTS.has(host) &&
    !host.endsWith(".localhost") &&
    !path.startsWith("/api") &&
    !path.startsWith("/_next") &&
    !path.startsWith("/s/") &&
    !path.startsWith("/login") &&
    !path.startsWith("/signup") &&
    !path.startsWith("/uploads")
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/s/by-domain";
    const res = NextResponse.rewrite(url);
    res.headers.set("x-siteforge-domain", host);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/editor/:path*",
    "/admin/:path*",
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
