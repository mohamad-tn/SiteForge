import { prisma } from "@/lib/prisma";
import { transparentPngResponse } from "@/lib/media/placeholder";

export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!id || id.length > 64) return transparentPngResponse(404);

    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
      select: { bytes: true, mime: true },
    });
    if (!asset) return transparentPngResponse(404);

    const body = Buffer.from(asset.bytes);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": asset.mime || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(body.length),
      },
    });
  } catch (e) {
    console.error("[media]", e);
    return transparentPngResponse(404);
  }
}
