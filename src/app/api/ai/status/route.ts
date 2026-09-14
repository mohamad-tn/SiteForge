import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/api";
import { getAiAvailability } from "@/lib/ai/resolve-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  try {
    const status = await getAiAvailability(auth.user.id);
    return NextResponse.json({
      available: status.available,
      reason: status.reason,
      source: status.source,
      hasUserKey: status.hasUserKey,
      platformEnabled: status.platformEnabled,
    });
  } catch (e) {
    console.error(e);
    return jsonError("Failed to read AI status", 500);
  }
}
