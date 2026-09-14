import { describe, expect, it } from "vitest";
import {
  compactSiteForModel,
  selectRecentChatTurns,
  AI_UI_MESSAGE_CAP,
} from "@/lib/ai/compact-context";
import { createBlankContent, defaultPropsFor } from "@/lib/design";
import { applyAiPatches } from "@/lib/ai/patches";

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
      pages: { blocks: { props: Record<string, unknown> }[] }[];
    };
    const props = compact.pages[0].blocks[0].props;
    expect(props.customCss).toBeUndefined();
    expect(props.httpAction).toBeUndefined();
    expect(props.headline).toBe("عنوان");
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
