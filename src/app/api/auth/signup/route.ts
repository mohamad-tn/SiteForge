import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api";
import { checkRateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import { strongPasswordZod } from "@/lib/password-policy";

const schema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().max(200),
  password: strongPasswordZod,
});

/** Generic message — avoids easy email enumeration. */
const GENERIC_FAIL = "Could not create account";

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const rl = checkRateLimit(`signup:${ip}`, 8, 60_000);
  if (!rl.ok) return jsonError("Too many requests", 429);

  const parsed = await parseJsonBody(req, schema, GENERIC_FAIL);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  try {
    const email = data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return jsonError(GENERIC_FAIL, 400);
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { name: data.name, email, passwordHash },
      select: { id: true, email: true, name: true },
    });
    return NextResponse.json({ user });
  } catch (e) {
    console.error(e);
    return jsonError(GENERIC_FAIL, 500);
  }
}
