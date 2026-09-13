import { prisma } from "@/lib/prisma";
import { transparentPngResponse } from "@/lib/media/placeholder";

export const runtime = "nodejs";

let loggedMissing = false;

/**
 * Legacy /uploads/<filename> URLs — look up MediaAsset by original name.
 * Missing files return a tiny placeholder so broken published pages stay quiet.
 */
export async function GET(_: Request, ctx: { params: Promise<{ name: string[] }> }) {
  try {
    const { name: parts } = await ctx.params;
    const name = (parts || []).map((p) => decodeURIComponent(p)).join("/");
    if (!name || name.includes("..") || name.length > 200) {
      return transparentPngResponse(404);
    }

    const asset = await prisma.mediaAsset.findFirst({
      where: { name },
      orderBy: { createdAt: "desc" },
      select: { bytes: true, mime: true },
    });
    if (!asset) {
      if (!loggedMissing) {
        loggedMissing = true;
        console.warn("[uploads] missing legacy file (further misses silenced):", name);
      }
      return transparentPngResponse(404);
    }

    const body = Buffer.from(asset.bytes);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": asset.mime || "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
        "Content-Length": String(body.length),
      },
    });
  } catch (e) {
    console.error("[uploads]", e);
    return transparentPngResponse(404);
  }
}
