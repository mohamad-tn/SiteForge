/**
 * Tenant → AI attachment validation (MIME/size/count).
 * Never executes uploaded files; text is sanitized/truncated for the model.
 */

import { z } from "zod";

export const AI_MAX_ATTACHMENTS = 3;
export const AI_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const AI_TEXT_MAX_BYTES = 200 * 1024;
export const AI_TEXT_MODEL_CHARS = 12_000;

export const AI_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export const AI_TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "application/json",
  "text/css",
  "text/html",
  "application/javascript",
  "text/javascript",
]);

export const aiAttachmentSchema = z.object({
  type: z.enum(["image", "text"]),
  name: z.string().min(1).max(200),
  mime: z.string().min(3).max(120),
  text: z.string().max(AI_TEXT_MAX_BYTES).optional(),
  mediaUrl: z
    .string()
    .max(500)
    .regex(/^\/api\/media\/[a-zA-Z0-9_-]+$/)
    .optional(),
  /** data:<mime>;base64,... — for vision; capped ~4MB decoded */
  dataUrl: z.string().max(6_000_000).optional(),
});

export type AiAttachment = z.infer<typeof aiAttachmentSchema>;

export const aiAttachmentsField = z
  .array(aiAttachmentSchema)
  .max(AI_MAX_ATTACHMENTS)
  .optional()
  .default([]);

export function validateAttachmentLimits(att: AiAttachment): string | null {
  if (att.type === "image") {
    if (!AI_IMAGE_MIMES.has(att.mime)) return "Unsupported image type";
    if (att.dataUrl) {
      const b64 = att.dataUrl.includes(",") ? att.dataUrl.split(",")[1] || "" : att.dataUrl;
      const approx = Math.floor((b64.length * 3) / 4);
      if (approx > AI_IMAGE_MAX_BYTES) return "Image too large (max ~4MB)";
      if (!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(att.dataUrl) && att.dataUrl.startsWith("data:")) {
        return "Invalid image data URL";
      }
    }
    if (!att.dataUrl && !att.mediaUrl) return "Image needs mediaUrl or dataUrl";
    return null;
  }
  if (att.type === "text") {
    if (!AI_TEXT_MIMES.has(att.mime) && !att.mime.startsWith("text/")) {
      return "Unsupported text type";
    }
    if (!att.text || !att.text.length) return "Text attachment empty";
    const bytes = typeof TextEncoder !== "undefined"
      ? new TextEncoder().encode(att.text).length
      : att.text.length;
    if (bytes > AI_TEXT_MAX_BYTES) {
      return "Text file too large (max ~200KB)";
    }
    return null;
  }
  return "Invalid attachment type";
}

/** Strip control chars / truncate for model context. */
export function sanitizeTextForModel(text: string, maxChars = AI_TEXT_MODEL_CHARS): string {
  const cleaned = text
    .replace(/\u0000/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .slice(0, maxChars);
  return cleaned.length < text.length ? `${cleaned}\n…[truncated]` : cleaned;
}

export function buildAttachmentPromptParts(attachments: AiAttachment[]): {
  textBlocks: string[];
  imageDataUrls: string[];
  mediaUrls: string[];
} {
  const textBlocks: string[] = [];
  const imageDataUrls: string[] = [];
  const mediaUrls: string[] = [];
  for (const a of attachments) {
    const err = validateAttachmentLimits(a);
    if (err) continue;
    if (a.type === "text" && a.text) {
      textBlocks.push(
        `Attached file "${a.name}" (${a.mime}):\n\`\`\`\n${sanitizeTextForModel(a.text)}\n\`\`\``
      );
    } else if (a.type === "image") {
      if (a.mediaUrl) mediaUrls.push(a.mediaUrl);
      if (a.dataUrl) imageDataUrls.push(a.dataUrl);
      else if (a.mediaUrl) {
        textBlocks.push(
          `Attached image "${a.name}" stored at site media URL ${a.mediaUrl}. Prefer placing it in an image/hero block via that URL if you cannot see the pixels.`
        );
      }
    }
  }
  return { textBlocks, imageDataUrls, mediaUrls };
}
