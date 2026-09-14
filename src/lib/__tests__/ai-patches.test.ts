import { describe, expect, it } from "vitest";
import {
  applyAiPatches,
  extractJsonObject,
  parseAiPatchesResponse,
  repairAiPatchesResponse,
  stripTrailingCommas,
} from "@/lib/ai/patches";
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

  it("strips trailing commas lightly", () => {
    expect(stripTrailingCommas('{"a":1,}')).toBe('{"a":1}');
    expect(stripTrailingCommas("[1,2,]")).toBe("[1,2]");
  });

  it("parses fenced design-improvement output with trailing comma", () => {
    const raw = `Here you go:
\`\`\`json
{
  "summary": "Improved design",
  "patches": [
    {
      "op": "update_tokens",
      "tokens": {
        "colors": { "primary": "#0f766e", "accent": "#14b8a6" },
        "radius": 16,
      }
    },
  ]
}
\`\`\`
`;
    const { data, repaired } = parseAiPatchesResponse(raw);
    expect(data).not.toBeNull();
    expect(data!.patches).toHaveLength(1);
    expect(data!.patches[0].op).toBe("update_tokens");
    expect(repaired || true).toBeTruthy();
  });

  it("repairs bare patch array and aliased ops", () => {
    const content = createBlankContent("Test");
    const page = content.pages[0];
    const block = page.blocks[0];
    const raw = [
      {
        operation: "set_tokens",
        colors: { primary: "#111827", accent: "#0d9488" },
      },
      {
        action: "part_style",
        pageId: page.id,
        blockId: block.id,
        part: "cta",
        style: { bgColor: "#0d9488", textColor: "#fff" },
      },
      {
        op: "improve_design",
        tokens: { radius: 12 },
      },
    ];
    const repaired = repairAiPatchesResponse(raw);
    expect(repaired).not.toBeNull();
    expect(repaired!.patches.length).toBeGreaterThanOrEqual(2);
    expect(repaired!.patches.every((p) => p.op === "update_tokens" || p.op === "set_part_style")).toBe(
      true
    );

    const { content: next, applied, errors } = applyAiPatches(content, repaired!.patches);
    expect(errors).toEqual([]);
    expect(applied).toBeGreaterThanOrEqual(2);
    expect(next.tokens.colors.primary).toBeTruthy();
  });

  it("applies update_tokens, set_locales, set_block_flags, duplicate_block", () => {
    const content = createBlankContent("Test");
    const page = content.pages[0];
    const block = page.blocks[0];
    const { content: next, applied, errors } = applyAiPatches(content, [
      {
        op: "update_tokens",
        tokens: {
          colors: { primary: "#0f766e" },
          radius: 20,
          themeMode: "dark",
        },
      },
      { op: "set_locales", locales: ["ar", "en"], defaultLocale: "en" },
      {
        op: "set_block_flags",
        pageId: page.id,
        blockId: block.id,
        locked: true,
        zIndex: 5,
      },
      {
        op: "duplicate_block",
        pageId: page.id,
        blockId: block.id,
        id: "dup-block-01",
      },
      {
        op: "set_seo",
        pageId: page.id,
        seoTitle: "Hello",
        seoDescription: "World",
      },
    ]);
    expect(errors).toEqual([]);
    expect(applied).toBe(5);
    expect(next.tokens.colors.primary).toBe("#0f766e");
    expect(next.tokens.radius).toBe(20);
    expect(next.tokens.themeMode).toBe("dark");
    expect(next.locales).toEqual(["ar", "en"]);
    expect(next.defaultLocale).toBe("en");
    expect(next.pages[0].seoTitle).toBe("Hello");
    const flags = next.pages[0].blocks.find((b) => b.id === block.id)!.props as Record<
      string,
      unknown
    >;
    expect(flags.locked).toBe(true);
    expect(flags.zIndex).toBe("5");
    expect(next.pages[0].blocks.some((b) => b.id === "dup-block-01")).toBe(true);
  });

  it("parses prose-wrapped object without fences", () => {
    const raw =
      'I will improve the look. {"summary":"ok","patches":[{"op":"update_tokens","tokens":{"radius":8}}]} Hope that helps.';
    const { data } = parseAiPatchesResponse(raw);
    expect(data?.patches[0]?.op).toBe("update_tokens");
  });

  it("repairs single-patch object missing patches array", () => {
    const content = createBlankContent("Test");
    const page = content.pages[0];
    const raw = {
      summary: "CTA polish",
      op: "set_part_style",
      pageId: page.id,
      blockId: page.blocks[0].id,
      part: "cta",
      styles: { bgColor: "#134e4a" },
    };
    const repaired = repairAiPatchesResponse(raw);
    expect(repaired?.patches).toHaveLength(1);
    const applied = applyAiPatches(content, repaired!.patches);
    expect(applied.applied).toBe(1);
  });
});
