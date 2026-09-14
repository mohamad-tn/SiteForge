import { describe, expect, it } from "vitest";
import { applyAiPatches, extractJsonObject } from "@/lib/ai/patches";
import { createBlankContent, defaultPropsFor } from "@/lib/design";
import { normalizeHref } from "@/lib/href";

describe("ai patches", () => {
  it("applies update_copy and set_part_style", () => {
    const content = createBlankContent("Test");
    const page = content.pages[0];
    if (!page.blocks.length) {
      page.blocks.push({
        id: "b1",
        type: "hero",
        props: { ...defaultPropsFor("hero"), headline: { ar: "قديم", en: "Old" } },
      });
    }
    const block = page.blocks.find((b) => b.type === "hero") || page.blocks[0];
    const { content: next, applied, errors } = applyAiPatches(content, [
      {
        op: "update_copy",
        pageId: page.id,
        blockId: block.id,
        key: "headline",
        locale: "ar",
        value: "عنوان جديد",
      },
      {
        op: "set_part_style",
        pageId: page.id,
        blockId: block.id,
        part: "cta",
        styles: { bgColor: "#0d9488", maxWidth: "240" },
      },
    ]);
    expect(errors).toEqual([]);
    expect(applied).toBe(2);
    const b = next.pages[0].blocks.find((x) => x.id === block.id)!;
    const headline = b.props.headline as Record<string, string>;
    expect(headline.ar).toBe("عنوان جديد");
    const partStyles = b.props.partStyles as Record<string, { bgColor?: string }>;
    expect(partStyles.cta.bgColor).toBe("#0d9488");
  });

  it("normalizes dangerous href and blocks customCss", () => {
    const content = createBlankContent("Test");
    const page = content.pages[0];
    const blockId = page.blocks[0].id;
    const { content: next } = applyAiPatches(content, [
      {
        op: "update_prop",
        pageId: page.id,
        blockId,
        key: "href",
        value: "javascript:alert(1)",
      },
      {
        op: "update_prop",
        pageId: page.id,
        blockId,
        key: "customCss",
        value: "body{display:none}",
      },
    ]);
    const props = next.pages[0].blocks[0].props as Record<string, unknown>;
    expect(props.href).toBe(normalizeHref("javascript:alert(1)"));
    expect(props.customCss).toBeUndefined();
  });

  it("extracts fenced json", () => {
    const raw = 'Sure.\n```json\n{"summary":"ok","patches":[]}\n```\n';
    expect(extractJsonObject(raw)).toEqual({ summary: "ok", patches: [] });
  });
});
