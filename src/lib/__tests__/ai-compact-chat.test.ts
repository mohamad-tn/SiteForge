import { describe, expect, it } from "vitest";
import {
  compactSiteForModel,
  selectRecentChatTurns,
  AI_UI_MESSAGE_CAP,
} from "@/lib/ai/compact-context";
import { createBlankContent, defaultPropsFor } from "@/lib/design";
import { applyAiPatches, AI_SYSTEM_PROMPT } from "@/lib/ai/patches";
import {
  SITEFORGE_PLAYBOOK,
  SITEFORGE_PLAYBOOK_CHARS,
} from "@/lib/ai/siteforge-playbook";

describe("compact site context", () => {
  it("strips heavy fields and keeps active locale copy", () => {
    const content = createBlankContent("Test");
    const page = content.pages[0];
    page.blocks[0] = {
      id: "b1",
      type: "hero",
      props: {
        ...defaultPropsFor("hero"),
        headline: { ar: "عنوان", en: "Title" },
        customCss: "body{display:none}",
        httpAction: { url: "https://evil.test" },
      },
    };
    const compact = compactSiteForModel(content, "ar") as {
      index: {
        pages: { id: string; slug: string; layout: string; blockCount: number }[];
        navbars: unknown[];
        tokens: Record<string, unknown>;
        locales: string[];
        defaultLocale: string;
        blocksByPage: Record<string, { id: string; type: string; key?: string }[]>;
        components: unknown[];
      };
      pages: { blocks: { props: Record<string, unknown> }[] }[];
    };
    expect(compact.index.pages.length).toBeGreaterThan(0);
    expect(compact.index.pages[0].slug).toBeTruthy();
    expect(compact.index.pages[0]).toMatchObject({
      layout: expect.any(String),
      blockCount: expect.any(Number),
    });
    expect(Array.isArray(compact.index.navbars)).toBe(true);
    expect(compact.index.tokens).toMatchObject({
      primary: expect.anything(),
      accent: expect.anything(),
      background: expect.anything(),
      fontHeading: expect.anything(),
      fontBody: expect.anything(),
    });
    expect(Array.isArray(compact.index.locales)).toBe(true);
    expect(compact.index.defaultLocale).toBeTruthy();
    expect(compact.index.blocksByPage).toBeTruthy();
    expect(Array.isArray(compact.index.components)).toBe(true);
    const pageId = content.pages[0].id;
    expect(compact.index.blocksByPage[pageId]?.length).toBeGreaterThan(0);
    expect(compact.index.blocksByPage[pageId][0]).toMatchObject({
      id: expect.any(String),
      type: expect.any(String),
    });
    const props = compact.pages[0].blocks[0].props;
    expect(props.customCss).toBeUndefined();
    expect(props.httpAction).toBeUndefined();
    expect(props.headline).toBe("عنوان");
  });

  it("keeps index keys when truncated and prefers active page detail", () => {
    const content = createBlankContent("Test");
    content.pages.push({
      id: "page-about",
      title: "About",
      slug: "about",
      layout: "flow",
      blocks: [
        {
          id: "about-hero",
          type: "hero",
          props: {
            ...defaultPropsFor("hero"),
            headline: { ar: "من نحن", en: "About us" },
          },
        },
      ],
    });
    const compact = compactSiteForModel(content, "en", {
      maxJsonChars: 2_500,
      activePageId: "page-about",
    }) as {
      index: {
        tokens: Record<string, unknown>;
        locales: string[];
        blocksByPage: Record<string, unknown[]>;
        pages: { id: string }[];
      };
      pages: { id: string; blocks: { props: Record<string, unknown> }[] }[];
    };
    expect(compact.index.tokens).toBeTruthy();
    expect(compact.index.locales.length).toBeGreaterThan(0);
    expect(compact.index.blocksByPage).toBeTruthy();
    expect(compact.pages[0].id).toBe("page-about");
    // Active page should retain props when others may be slimmed
    expect(compact.pages[0].blocks[0].props.headline).toBeTruthy();
  });

  it("selects last ~6 turns", () => {
    const msgs = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      text: String(i),
    }));
    const recent = selectRecentChatTurns(msgs, 6);
    expect(recent.length).toBe(12);
    expect(recent[0].text).toBe("8");
  });

  it("documents UI cap constant", () => {
    expect(AI_UI_MESSAGE_CAP).toBe(40);
  });
});

describe("expanded AI patches", () => {
  it("add_page rename set_seo reorder propose_domain", () => {
    const content = createBlankContent("Test");
    const pageId = content.pages[0].id;
    const blockIds = content.pages[0].blocks.map((b) => b.id);
    const { content: next, applied, errors } = applyAiPatches(content, [
      {
        op: "add_page",
        title: "About",
        slug: "about-us",
      },
      {
        op: "rename_page",
        pageId,
        title: "Home Renamed",
      },
      {
        op: "set_page_slug",
        pageId,
        slug: "home-new",
      },
      {
        op: "set_seo",
        pageId,
        seoTitle: "SEO Title",
        seoDescription: "SEO Desc",
      },
      {
        op: "reorder_blocks",
        pageId,
        blockIds: [...blockIds].reverse(),
      },
      {
        op: "propose_domain",
        domain: "https://Example.COM/path",
      },
    ]);
    expect(errors).toEqual([]);
    expect(applied).toBe(6);
    expect(next.pages.some((p) => p.slug === "about-us")).toBe(true);
    expect(next.pages.find((p) => p.id === pageId)?.title).toBe("Home Renamed");
    expect(next.pages.find((p) => p.id === pageId)?.slug).toBe("home-new");
    expect(next.pages.find((p) => p.id === pageId)?.seoTitle).toBe("SEO Title");
    expect(next.meta?.domainProposal).toBe("example.com");
  });
});

/** Pure prune helper mirrored for unit test without DB. */
function pruneIds(ids: string[], keep: number) {
  if (ids.length <= keep) return { kept: ids, deleted: [] as string[] };
  const excess = ids.length - keep;
  return { deleted: ids.slice(0, excess), kept: ids.slice(excess) };
}

describe("chat prune", () => {
  it("keeps last N=40", () => {
    const ids = Array.from({ length: 45 }, (_, i) => `m${i}`);
    const { kept, deleted } = pruneIds(ids, 40);
    expect(deleted.length).toBe(5);
    expect(kept.length).toBe(40);
    expect(kept[0]).toBe("m5");
  });
});

describe("add_page + navItems page linking", () => {
  it("applies add_page and update_props navItems with linkMode page", () => {
    const content = createBlankContent("Test");
    const home = content.pages[0];
    const navbar = home.blocks.find((b) => b.type === "navbar") || home.blocks[0];
    navbar.type = "navbar";
    const { content: next, applied, errors } = applyAiPatches(content, [
      { op: "add_page", title: "About", slug: "about" },
      {
        op: "update_props",
        pageId: home.id,
        blockId: navbar.id,
        props: {
          navItems: [
            {
              id: "n1",
              label: { ar: "الرئيسية", en: "Home" },
              linkMode: "page",
              linkPageSlug: "home",
              href: "",
            },
            {
              id: "n2",
              label: { ar: "من نحن", en: "About" },
              linkMode: "page",
              linkPageSlug: "about",
              href: "",
            },
          ],
        },
      },
    ]);
    expect(errors).toEqual([]);
    expect(applied).toBe(2);
    expect(next.pages.some((p) => p.slug === "about")).toBe(true);
    const nav = next.pages
      .find((p) => p.id === home.id)!
      .blocks.find((b) => b.id === navbar.id)!;
    const items = nav.props.navItems as Array<{
      linkMode: string;
      linkPageSlug: string;
    }>;
    expect(items).toHaveLength(2);
    expect(items[0].linkMode).toBe("page");
    expect(items[0].linkPageSlug).toBe("home");
    expect(items[1].linkMode).toBe("page");
    expect(items[1].linkPageSlug).toBe("about");
  });
});


describe("siteforge playbook / AI_SYSTEM_PROMPT", () => {
  it("exports non-empty playbook under size budget", () => {
    expect(SITEFORGE_PLAYBOOK.length).toBeGreaterThan(800);
    expect(SITEFORGE_PLAYBOOK_CHARS).toBe(SITEFORGE_PLAYBOOK.length);
    // ~4k tokens ≈ 16k chars; keep headroom under ~20k chars
    expect(SITEFORGE_PLAYBOOK_CHARS).toBeLessThan(20_000);
  });

  it("AI_SYSTEM_PROMPT includes critical ontology keywords", () => {
    expect(AI_SYSTEM_PROMPT).toBe(SITEFORGE_PLAYBOOK);
    for (const kw of [
      "navItems",
      "linkMode",
      "partStyles",
      "locales",
      "tokens",
      "canvas",
      "update_tokens",
      "update_copy",
      "collection",
      "actionType",
      "set_block_flags",
      "propose_domain",
    ]) {
      expect(AI_SYSTEM_PROMPT).toContain(kw);
    }
  });
});
