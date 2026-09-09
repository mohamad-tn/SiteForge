import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api";

const schema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, schema, "Invalid payload");
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  try {
    const email = data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return jsonError("Email already in use", 400);
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { name: data.name, email, passwordHash },
      select: { id: true, email: true, name: true },
    });
    return NextResponse.json({ user });
  } catch (e) {
    console.error(e);
    return jsonError("Server error", 500);
  }
}
