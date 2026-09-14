import { describe, expect, it } from "vitest";
import {
  AI_MAX_ATTACHMENTS,
  aiAttachmentSchema,
  aiAttachmentsField,
  buildAttachmentPromptParts,
  sanitizeTextForModel,
  validateAttachmentLimits,
} from "@/lib/ai/attachments";

describe("AI attachments", () => {
  it("caps array length at 3", () => {
    expect(AI_MAX_ATTACHMENTS).toBe(3);
    const tooMany = aiAttachmentsField.safeParse([
      { type: "text", name: "a.txt", mime: "text/plain", text: "a" },
      { type: "text", name: "b.txt", mime: "text/plain", text: "b" },
      { type: "text", name: "c.txt", mime: "text/plain", text: "c" },
      { type: "text", name: "d.txt", mime: "text/plain", text: "d" },
    ]);
    expect(tooMany.success).toBe(false);
  });

  it("validates image and text limits", () => {
    expect(
      validateAttachmentLimits({
        type: "image",
        name: "x.png",
        mime: "image/png",
        mediaUrl: "/api/media/abc",
      })
    ).toBeNull();
    expect(
      validateAttachmentLimits({
        type: "image",
        name: "x.png",
        mime: "image/svg+xml",
        mediaUrl: "/api/media/abc",
      })
    ).toMatch(/Unsupported/);
    expect(
      validateAttachmentLimits({
        type: "text",
        name: "a.txt",
        mime: "text/plain",
        text: "hello",
      })
    ).toBeNull();
    expect(
      validateAttachmentLimits({
        type: "text",
        name: "a.txt",
        mime: "text/plain",
      })
    ).toMatch(/empty/i);
  });

  it("rejects non-media mediaUrl paths", () => {
    const bad = aiAttachmentSchema.safeParse({
      type: "image",
      name: "x.png",
      mime: "image/png",
      mediaUrl: "https://evil.example/x.png",
    });
    expect(bad.success).toBe(false);
  });

  it("sanitizes and builds prompt parts", () => {
    const cleaned = sanitizeTextForModel("hi\u0000there" + "x".repeat(20_000), 100);
    expect(cleaned).not.toContain("\u0000");
    expect(cleaned).toMatch(/truncated/);
    const parts = buildAttachmentPromptParts([
      { type: "text", name: "n.md", mime: "text/markdown", text: "# Title" },
      {
        type: "image",
        name: "p.png",
        mime: "image/png",
        mediaUrl: "/api/media/mid1",
        dataUrl: "data:image/png;base64,aaa",
      },
    ]);
    expect(parts.textBlocks.some((t) => t.includes("Title"))).toBe(true);
    expect(parts.imageDataUrls).toHaveLength(1);
    expect(parts.mediaUrls).toContain("/api/media/mid1");
  });
});
