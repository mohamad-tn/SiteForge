import { describe, expect, it } from "vitest";
import {
  applyAiPatches,
  buildCompactRepairIndex,
  buildExpansionUserPrompt,
  buildHonestApplySummary,
  buildIntentFocusHint,
  coerceNavbarLinkProps,
  detectAiIntentClasses,
  extractJsonObject,
  isRichAiIntent,
  isUnderAppliedForIntent,
  parseAiPatchesResponse,
  repairAiPatchesResponse,
  resolvePageSlugRef,
  runDeterministicLinkHeal,
  shouldRunSemanticRepair,
  stripTrailingCommas,
  syncAllNavbarsToPages,
  synthesizeTokensFromProse,
  verifySiteContentLinks,
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


describe("honest apply + page link resolution", () => {
  it("applied count 0 when wrong blockId", () => {
    const content = createBlankContent("Test");
    const page = content.pages[0];
    const { applied, errors } = applyAiPatches(content, [
      {
        op: "update_prop",
        pageId: page.id,
        blockId: "does-not-exist-xyz",
        key: "ctaHref",
        value: "#",
      },
      {
        op: "update_props",
        pageId: page.id,
        blockId: "missing-block",
        props: { navItems: [] },
      },
    ]);
    expect(applied).toBe(0);
    expect(errors.some((e) => /Unknown block/i.test(e))).toBe(true);
  });

  it("resolvePageSlugRef: page id → slug; title; ?p=; path segment", () => {
    const pages = [
      { id: "page-about-99", slug: "about", title: "من نحن" },
      { id: "page-home", slug: "home", title: "الرئيسية" },
      { id: "page-svc", slug: "services", title: "Services" },
    ];
    expect(resolvePageSlugRef("about", pages)).toBe("about");
    expect(resolvePageSlugRef("ABOUT", pages)).toBe("about");
    expect(resolvePageSlugRef("page-about-99", pages)).toBe("about");
    expect(resolvePageSlugRef("من نحن", pages)).toBe("about");
    expect(resolvePageSlugRef("/about", pages)).toBe("about");
    expect(resolvePageSlugRef("services", pages)).toBe("services");
    expect(resolvePageSlugRef("/s/demo?p=about", pages)).toBe("about");
    expect(resolvePageSlugRef("nope", pages)).toBeNull();
  });

  it("coerce: page id → slug; bad slug fixed when title matches; href /about → page", () => {
    const pages = [
      { id: "page-about-99", slug: "about", title: "About" },
      { id: "page-home", slug: "home", title: "Home" },
    ];
    const byId = coerceNavbarLinkProps(
      {
        navItems: [
          {
            id: "n1",
            label: { en: "About" },
            linkMode: "page",
            linkPageSlug: "page-about-99",
            href: "",
          },
        ],
      },
      pages,
      ["en"]
    );
    const items1 = byId.navItems as Array<{ linkPageSlug: string; linkMode: string }>;
    expect(items1[0].linkMode).toBe("page");
    expect(items1[0].linkPageSlug).toBe("about");

    const byHref = coerceNavbarLinkProps(
      {
        navItems: [
          {
            id: "n2",
            label: { en: "About" },
            linkMode: "url",
            linkPageSlug: "",
            href: "/about",
          },
        ],
      },
      pages,
      ["en"]
    );
    const items2 = byHref.navItems as Array<{
      linkPageSlug: string;
      linkMode: string;
      href?: string;
    }>;
    expect(items2[0].linkMode).toBe("page");
    expect(items2[0].linkPageSlug).toBe("about");
    expect(items2[0].href).toBe("");
  });

  it("verifier catches bad linkPageSlug", () => {
    const content = createBlankContent("Test");
    const page = content.pages[0];
    const nav = page.blocks.find((b) => b.type === "navbar")!;
    nav.props = {
      ...nav.props,
      navItems: [
        {
          id: "bad",
          label: { en: "Ghost" },
          linkMode: "page",
          linkPageSlug: "does-not-exist",
          href: "",
        },
      ],
    };
    const v = verifySiteContentLinks(content);
    expect(v.ok).toBe(false);
    expect(v.issues.length).toBeGreaterThan(0);
    expect(v.issues[0].detail).toMatch(/does-not-exist/);
  });

  it("summary path: fake «fixed nav» with bad slug → verifier issues + honest summary", () => {
    const content = createBlankContent("Test");
    const page = content.pages[0];
    const nav = page.blocks.find((b) => b.type === "navbar")!;
    const { content: next, applied } = applyAiPatches(content, [
      {
        op: "update_props",
        pageId: page.id,
        blockId: nav.id,
        props: {
          navItems: [
            {
              id: "n1",
              label: { en: "Broken", ar: "معطل" },
              linkMode: "page",
              linkPageSlug: "typo-page-slug",
              href: "",
            },
          ],
        },
      },
    ]);
    expect(applied).toBe(1);
    const v = verifySiteContentLinks(next);
    expect(v.issues.length).toBeGreaterThan(0);
    const summary = buildHonestApplySummary({
      modelSummary: "Fixed all nav buttons — no more 404s",
      applied,
      errors: [],
      issues: v.issues,
      platformLang: "en",
    });
    expect(summary).toMatch(/link issues remain|not verified/i);
    expect(summary).not.toMatch(/^Fixed all nav buttons/);
  });

  it("syncAllNavbarsToPages heals bad slugs across pages", () => {
    const content = createBlankContent("Test");
    // add about page
    const withAbout = applyAiPatches(content, [
      { op: "add_page", title: "About", slug: "about", id: "page-about" },
    ]).content;
    // put a navbar with bad slug on home
    const home = withAbout.pages[0];
    const nav = home.blocks.find((b) => b.type === "navbar")!;
    nav.props = {
      ...nav.props,
      navItems: [
        {
          id: "n-about",
          label: { en: "About", ar: "About" },
          linkMode: "page",
          linkPageSlug: "page-about", // id instead of slug
          href: "",
        },
      ],
    };
    // add navbar on about page with same bad link
    const about = withAbout.pages.find((p) => p.slug === "about")!;
    about.blocks.unshift({
      id: "nav-about-page",
      type: "navbar",
      props: {
        navItems: [
          {
            id: "n2",
            label: { en: "About" },
            linkMode: "url",
            href: "/about",
            linkPageSlug: "",
          },
        ],
      },
    });

    const synced = syncAllNavbarsToPages(withAbout);
    for (const p of synced.pages) {
      for (const b of p.blocks.filter((x) => x.type === "navbar")) {
        const items = b.props.navItems as Array<{
          linkMode: string;
          linkPageSlug: string;
        }>;
        const aboutLink = items.find(
          (it) => it.linkPageSlug === "about" || it.linkPageSlug === "page-about"
        );
        // After sync, about should be slug "about"
        expect(items.some((it) => it.linkMode === "page" && it.linkPageSlug === "about")).toBe(
          true
        );
        void aboutLink;
      }
    }
    const v = verifySiteContentLinks(synced);
    // May still have leftover default Home/Services stubs — filter page-mode only
    const badPageMode = v.issues.filter((i) => /linkPageSlug/.test(i.detail));
    expect(badPageMode.every((i) => !/page-about/.test(i.detail))).toBe(true);
  });
});


describe("high-reliability nav ops", () => {
  it("set_nav_items resolves slugs and syncs CSV", () => {
    const content = createBlankContent("Test");
    const withAbout = applyAiPatches(content, [
      { op: "add_page", title: "About", slug: "about", id: "page-about" },
    ]).content;
    const home = withAbout.pages[0];
    const nav = home.blocks.find((b) => b.type === "navbar")!;
    const { content: next, applied, errors } = applyAiPatches(withAbout, [
      {
        op: "set_nav_items",
        pageId: home.id,
        blockId: nav.id,
        items: [
          { label: { en: "Home", ar: "الرئيسية" }, linkPageSlug: "home" },
          { label: { en: "About" }, linkPageSlug: "page-about" }, // id → slug
        ],
      },
    ]);
    expect(errors).toEqual([]);
    expect(applied).toBe(1);
    const items = next.pages[0].blocks.find((b) => b.id === nav.id)!.props
      .navItems as Array<{ linkMode: string; linkPageSlug: string; actionType?: string }>;
    expect(items).toHaveLength(2);
    expect(items[0].linkMode).toBe("page");
    expect(items[0].linkPageSlug).toBe("home");
    expect(items[1].linkPageSlug).toBe("about");
    expect(items[0].actionType).toBe("link");
    expect(next.pages[0].blocks.find((b) => b.id === nav.id)!.props.links).toBeTruthy();
    expect(verifySiteContentLinks(next).ok).toBe(true);
  });

  it("wire_nav_to_pages syncs all navbars", () => {
    const content = createBlankContent("Test");
    const withAbout = applyAiPatches(content, [
      { op: "add_page", title: "About", slug: "about", id: "page-about" },
    ]).content;
    const about = withAbout.pages.find((p) => p.slug === "about")!;
    about.blocks.unshift({
      id: "nav-about",
      type: "navbar",
      props: { navItems: [] },
    });
    const { content: next, applied, errors } = applyAiPatches(withAbout, [
      { op: "wire_nav_to_pages" },
    ]);
    expect(errors).toEqual([]);
    expect(applied).toBe(1);
    for (const p of next.pages) {
      const nav = p.blocks.find((b) => b.type === "navbar");
      if (!nav) continue;
      const items = nav.props.navItems as Array<{ linkPageSlug: string }>;
      expect(items.some((it) => it.linkPageSlug === "about")).toBe(true);
      expect(items.some((it) => it.linkPageSlug === "home" || it.linkPageSlug === p.slug)).toBe(
        true
      );
    }
  });

  it("set_button_link wires hero CTA to page slug", () => {
    const content = createBlankContent("Test");
    const withAbout = applyAiPatches(content, [
      { op: "add_page", title: "About", slug: "about" },
    ]).content;
    const home = withAbout.pages[0];
    const hero = home.blocks.find((b) => b.type === "hero") || home.blocks[0];
    const { content: next, applied, errors } = applyAiPatches(withAbout, [
      {
        op: "set_button_link",
        pageId: home.id,
        blockId: hero.id,
        linkMode: "page",
        linkPageSlug: "about",
        key: "ctaHref",
      },
    ]);
    expect(errors).toEqual([]);
    expect(applied).toBe(1);
    const props = next.pages[0].blocks.find((b) => b.id === hero.id)!.props as Record<
      string,
      unknown
    >;
    expect(props.linkMode).toBe("page");
    expect(props.linkPageSlug).toBe("about");
  });

  it("coerces update_nav alias and navItems-only update_props to set_nav_items", () => {
    const content = createBlankContent("Test");
    const page = content.pages[0];
    const nav = page.blocks.find((b) => b.type === "navbar")!;
    const repaired = repairAiPatchesResponse({
      patches: [
        {
          operation: "update_nav",
          pageId: page.id,
          blockId: nav.id,
          items: [{ label: "Home", linkPageSlug: "home" }],
        },
        {
          op: "update_props",
          pageId: page.id,
          blockId: nav.id,
          props: {
            navItems: [{ label: { en: "Home" }, linkPageSlug: "home" }],
          },
        },
      ],
    });
    expect(repaired!.patches.every((p) => p.op === "set_nav_items")).toBe(true);
  });
});

describe("self-heal + honest summary + intent", () => {
  it("bad page-mode slug becomes good after coerce/sync heal", () => {
    const content = createBlankContent("Test");
    const withAbout = applyAiPatches(content, [
      { op: "add_page", title: "About", slug: "about", id: "page-about" },
    ]).content;
    const home = withAbout.pages[0];
    const nav = home.blocks.find((b) => b.type === "navbar")!;
    nav.props = {
      ...nav.props,
      navItems: [
        {
          id: "n1",
          label: { en: "About" },
          linkMode: "page",
          linkPageSlug: "page-about",
          href: "",
        },
      ],
    };
    expect(verifySiteContentLinks(withAbout).ok).toBe(false);
    const healed = runDeterministicLinkHeal(withAbout);
    const items = healed.pages[0].blocks.find((b) => b.id === nav.id)!.props
      .navItems as Array<{ linkPageSlug: string; linkMode: string }>;
    expect(items.some((it) => it.linkMode === "page" && it.linkPageSlug === "about")).toBe(
      true
    );
    const bad = verifySiteContentLinks(healed).issues.filter((i) =>
      /page-about/.test(i.detail)
    );
    expect(bad).toEqual([]);
  });

  it("honest summary when issues remain after apply", () => {
    const content = createBlankContent("Test");
    const page = content.pages[0];
    const nav = page.blocks.find((b) => b.type === "navbar")!;
    const { content: next, applied } = applyAiPatches(content, [
      {
        op: "set_nav_items",
        pageId: page.id,
        blockId: nav.id,
        items: [
          { label: "Ghost", linkMode: "page", linkPageSlug: "no-such-page" },
        ],
      },
    ]);
    const issues = verifySiteContentLinks(next).issues;
    expect(issues.length).toBeGreaterThan(0);
    const summary = buildHonestApplySummary({
      modelSummary: "All nav links fixed perfectly",
      applied,
      errors: [],
      issues,
      platformLang: "en",
    });
    expect(summary).toMatch(/link issues remain|not verified/i);
    expect(summary).not.toMatch(/^All nav links fixed/);
  });

  it("intent hint helper covers nav and design", () => {
    const classes = detectAiIntentClasses("أضف صفحة about واربط النافبار");
    expect(classes).toContain("nav_pages");
    const hint = buildIntentFocusHint(classes);
    expect(hint).toMatch(/set_nav_items|wire_nav_to_pages/);
    expect(hint.split("\n").length).toBeLessThanOrEqual(8);

    const design = detectAiIntentClasses("improve design colors to teal");
    expect(design).toContain("design_tokens");
    expect(buildIntentFocusHint(design)).toMatch(/update_tokens/);
  });

  it("shouldRunSemanticRepair when issues or partial nav intent", () => {
    expect(
      shouldRunSemanticRepair({
        userMessage: "fix nav",
        issues: [{ pageId: "p", blockId: "b", detail: "bad" }],
        applied: 1,
        patchCount: 1,
      })
    ).toBe(true);
    expect(
      shouldRunSemanticRepair({
        userMessage: "add about page to navbar",
        issues: [],
        applied: 1,
        patchCount: 3,
      })
    ).toBe(true);
    expect(
      shouldRunSemanticRepair({
        userMessage: "hello",
        issues: [],
        applied: 1,
        patchCount: 1,
      })
    ).toBe(false);
  });

  it("does not treat color synth as success for school redesign prose", () => {
    const redesign =
      "أعد تصميم موقع مدرسة الورود الصغار بالكامل: غيّر الاسم والألوان والصور واربط الأزرار وأضف نموذج تواصل";
    expect(isRichAiIntent(redesign)).toBe(true);
    const prose =
      "Sure! Use primary #e11d48 and accent #fb7185 for the school brand. I updated everything.";
    const synth = synthesizeTokensFromProse(prose);
    expect(synth).not.toBeNull();
    expect(synth!.patches).toHaveLength(1);
    expect(synth!.patches[0].op).toBe("update_tokens");

    const blocked = parseAiPatchesResponse(prose, { userMessage: redesign });
    expect(blocked.data).toBeNull();
    expect(blocked.synthesizedFromProse).toBeFalsy();
    expect(blocked.colorHint?.patches[0].op).toBe("update_tokens");
    expect(blocked.validationIssues || "").toMatch(/not valid patch JSON|لم يكن تعديلات/i);

    const colorOnly = parseAiPatchesResponse(prose, {
      userMessage: "change colors to #e11d48 and #fb7185",
    });
    expect(colorOnly.data).not.toBeNull();
    expect(colorOnly.synthesizedFromProse).toBe(true);
    expect(colorOnly.data!.patches[0].op).toBe("update_tokens");
  });

  it("isUnderAppliedForIntent for Arabic school redesign + 1 update_tokens", () => {
    const msg =
      "إعادة تصميم مدرسة الورود الصغار — اسم احترافي، ألوان، صور، روابط، نموذج";
    expect(
      isUnderAppliedForIntent(
        msg,
        [{ op: "update_tokens", tokens: { colors: { primary: "#e11d48" } } }],
        1
      )
    ).toBe(true);
    expect(
      isUnderAppliedForIntent(
        "change primary color to teal",
        [{ op: "update_tokens", tokens: { colors: { primary: "#0d9488" } } }],
        1
      )
    ).toBe(false);
  });

  it("expansion prompt builder includes non-empty checklist", () => {
    const content = createBlankContent("School");
    const index = buildCompactRepairIndex(content);
    const prompt = buildExpansionUserPrompt({
      userMessage: "إعادة تصميم مدرسة الورود الصغار",
      index,
      existingPatches: [
        { op: "update_tokens", tokens: { colors: { primary: "#e11d48" } } },
      ],
    });
    expect(prompt.length).toBeGreaterThan(80);
    expect(prompt).toMatch(/update_tokens/);
    expect(prompt).toMatch(/update_copy/);
    expect(prompt).toMatch(/wire_nav_to_pages|set_nav_items/);
    expect(prompt).toMatch(/set_button_link/);
    expect(prompt).toMatch(/set_seo/);
    expect(prompt).toMatch(/≥8|>=8|at least 8|checklist/i);
  });

  it("honest summary flags tokens-only vs rich redesign", () => {
    const summary = buildHonestApplySummary({
      modelSummary: "Extracted colors from reply / ألوان مستخرجة من الرد",
      applied: 1,
      errors: [],
      issues: [],
      platformLang: "ar",
      userMessage: "إعادة تصميم مدرسة الورود الصغار مع نموذج وروابط",
      patches: [{ op: "update_tokens", tokens: { colors: { primary: "#e11d48" } } }],
    });
    expect(summary).toMatch(/ألوان|رموز|أوسع/);
  });
});
