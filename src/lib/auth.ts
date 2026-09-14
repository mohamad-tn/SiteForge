import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(100),
});

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 14,
  },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse({
          email: credentials?.email,
          password: credentials?.password,
        });
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase().trim();
        const rl = checkRateLimit(`login:${email}`, 12, 60_000);
        if (!rl.ok) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = ((user as { role?: "USER" | "ADMIN" }).role || "USER") as "USER" | "ADMIN";
        token.roleCheckedAt = Date.now();
      } else if (typeof token.id === "string") {
        // Refresh role from DB every ~5 minutes so demotions take effect without waiting for JWT expiry.
        const checkedAt = typeof token.roleCheckedAt === "number" ? token.roleCheckedAt : 0;
        if (Date.now() - checkedAt > 5 * 60 * 1000) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: token.id },
              select: { role: true },
            });
            token.role = (dbUser?.role || "USER") as "USER" | "ADMIN";
          } catch {
            token.role = "USER";
          }
          token.roleCheckedAt = Date.now();
        }
      }
      // Missing/invalid role → non-admin
      if (token.role !== "ADMIN" && token.role !== "USER") {
        token.role = "USER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role === "ADMIN" ? "ADMIN" : "USER";
      }
      return session;
    },
  },
};
