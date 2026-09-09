import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { jsonError, requireSession } from "@/lib/api";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function extFor(mime: string, original: string): string {
  const fromName = path.extname(original || "").toLowerCase();
  if (fromName && fromName.length <= 8) return fromName;
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
  };
  return map[mime] || ".bin";
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return jsonError("No file uploaded", 400);
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return jsonError("File size not allowed (max 8MB)", 400);
    }
    const mime = file.type || "application/octet-stream";
    if (!ALLOWED.has(mime)) {
      return jsonError(
        "Unsupported type. Images: JPG/PNG/WebP/GIF/SVG — Video: MP4/WebM/MOV",
        400
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (mime === "image/svg+xml") {
      const text = bytes.toString("utf8");
      if (/<script|on\w+\s*=|javascript:|data:\s*text\/html|<foreignObject/i.test(text)) {
        return jsonError("Unsafe SVG rejected", 400);
      }
    }

    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${nanoid(10)}${extFor(mime, file.name)}`;
    await writeFile(path.join(dir, name), bytes);
    const url = `/uploads/${name}`;
    const kind = mime.startsWith("video/") ? "video" : "image";
    return NextResponse.json({ url, kind, mime, size: file.size, name });
  } catch (e) {
    console.error(e);
    return jsonError("Upload failed", 500);
  }
}
