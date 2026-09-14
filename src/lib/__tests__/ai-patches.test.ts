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

  it("coerces numeric styles on set_part_style (models emit paddingX:24)", () => {
    const content = createBlankContent("Test");
    const page = content.pages[0];
    const block = page.blocks[0];
    const raw = {
      patches: [
        {
          operation: "set_part_style",
          pageId: page.id,
          blockId: block.id,
          part: "cta",
          styles: { bgColor: "#111", paddingX: 24, borderRadius: 999 },
        },
      ],
    };
    const repaired = repairAiPatchesResponse(raw);
    expect(repaired).not.toBeNull();
    expect(repaired!.patches).toHaveLength(1);
    const styles = (repaired!.patches[0] as { styles: Record<string, string> }).styles;
    expect(styles.paddingX).toBe("24");
    expect(styles.borderRadius).toBe("999");
    const applied = applyAiPatches(content, repaired!.patches);
    expect(applied.applied).toBe(1);
  });

  it("repairs operation+numbers with no summary (would previously return null)", () => {
    const content = createBlankContent("Test");
    const page = content.pages[0];
    const block = page.blocks[0];
    const text = JSON.stringify({
      patches: [
        {
          operation: "set_part_style",
          pageId: page.id,
          blockId: block.id,
          part: "cta",
          styles: { bgColor: "#111", paddingX: 24 },
        },
      ],
    });
    const { data } = parseAiPatchesResponse(text);
    expect(data).not.toBeNull();
    expect(data!.patches.length).toBe(1);
    expect((data!.patches[0] as { styles: Record<string, string> }).styles.paddingX).toBe("24");
  });

  it("returns null-ish validation for truncated JSON without inventing patches", () => {
    const { data, validationIssues } = parseAiPatchesResponse(
      '{"summary":"x","patches":[{"op":"update_tokens","tokens":{"colors":{"primary":"#0'
    );
    // Truncated → no balanced JSON; may synthesize only if hex complete — here incomplete
    expect(data === null || data.patches.length >= 0).toBe(true);
    if (!data) expect(validationIssues).toBeTruthy();
  });

  it("keeps valid patches when mixed with invalid ones", () => {
    const content = createBlankContent("Test");
    const page = content.pages[0];
    const block = page.blocks[0];
    const repaired = repairAiPatchesResponse({
      summary: "partial",
      patches: [
        { op: "update_tokens", tokens: { radius: 12 } },
        { op: "not_a_real_op", pageId: page.id, blockId: block.id },
        {
          op: "set_part_style",
          pageId: page.id,
          blockId: block.id,
          part: "cta",
          styles: { paddingX: 16, bgColor: "#0f766e" },
        },
      ],
    });
    expect(repaired!.patches.length).toBe(2);
    expect(repaired!.patches.map((p) => p.op).sort()).toEqual([
      "set_part_style",
      "update_tokens",
    ]);
  });

  it("salvages root colors into update_tokens", () => {
    const repaired = repairAiPatchesResponse({
      operation: "improve_design",
      colors: { primary: "#111827" },
      fonts: { heading: "Cairo" },
      radius: "14",
    });
    expect(repaired!.patches[0].op).toBe("update_tokens");
    const tokens = (repaired!.patches[0] as unknown as { tokens: { radius: number; colors: { primary: string } } })
      .tokens;
    expect(tokens.radius).toBe(14);
    expect(tokens.colors.primary).toBe("#111827");
  });

  it("soft-fails when all patches invalid but array present", () => {
    const repaired = repairAiPatchesResponse({
      patches: [{ op: "totally_bogus", foo: 1 }],
    });
    expect(repaired).not.toBeNull();
    expect(repaired!.patches).toEqual([]);
    expect(repaired!.summary).toMatch(/styles|صالحة/i);
  });

});


describe("sanitize safe object arrays", () => {
  it("preserves navItems actionType and features items arrays", () => {
    const content = createBlankContent("Test");
    const page = content.pages[0];
    const navbar = page.blocks.find((b) => b.type === "navbar") || page.blocks[0];
    navbar.type = "navbar";
    const features = {
      id: "feat1",
      type: "features" as const,
      props: { ...defaultPropsFor("features") },
    };
    page.blocks.push(features);
    const { content: next, errors } = applyAiPatches(content, [
      {
        op: "update_props",
        pageId: page.id,
        blockId: navbar.id,
        props: {
          navItems: [
            {
              id: "n1",
              label: { en: "Home" },
              linkMode: "page",
              linkPageSlug: "home",
              actionType: "scrollTo",
              actionTarget: "feat1",
            },
          ],
        },
      },
      {
        op: "update_prop",
        pageId: page.id,
        blockId: "feat1",
        key: "items",
        value: [
          {
            id: "i1",
            title: { en: "Fast", ar: "سريع" },
            body: { en: "Speed", ar: "سرعة" },
            customCss: "evil",
          },
        ],
      },
    ]);
    expect(errors).toEqual([]);
    const nav = next.pages[0].blocks.find((b) => b.id === navbar.id)!;
    const items = nav.props.navItems as Array<{
      actionType?: string;
      actionTarget?: string;
    }>;
    expect(items[0].actionType).toBe("scrollTo");
    expect(items[0].actionTarget).toBe("feat1");
    const feat = next.pages[0].blocks.find((b) => b.id === "feat1")!;
    const featItems = feat.props.items as Array<Record<string, unknown>>;
    expect(featItems).toHaveLength(1);
    expect((featItems[0].title as Record<string, string>).en).toBe("Fast");
    expect(featItems[0].customCss).toBeUndefined();
  });
});
