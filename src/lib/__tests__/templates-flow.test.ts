import { describe, expect, it } from "vitest";
import { builtinTemplateContent } from "@/lib/builtin-templates";
import { createBlankContent, ensureContentDefaults } from "@/lib/design";

describe("new sites default to flow without canvas leftovers", () => {
  it("blank / portfolio / cv have flow pages and no pos", () => {
    for (const slug of ["blank", "portfolio", "cv"] as const) {
      const c = builtinTemplateContent(slug, "T");
      expect(c).toBeTruthy();
      for (const page of c!.pages) {
        expect(page.layout === "canvas").toBe(false);
        for (const b of page.blocks) {
          expect(b.props.posX).toBeFalsy();
          expect(b.props.posY).toBeFalsy();
          expect(String(b.props.width || "")).not.toMatch(/^720(px)?$/);
        }
      }
    }
  });

  it("ensureContentDefaults strips leftover canvas geometry on flow", () => {
    const raw = createBlankContent("X");
    raw.pages[0].blocks[0].props.posX = "0";
    raw.pages[0].blocks[0].props.posY = "80";
    raw.pages[0].blocks[0].props.width = "720";
    const next = ensureContentDefaults(raw);
    expect(next.pages[0].layout).toBe("flow");
    expect(next.pages[0].blocks[0].props.posX).toBeUndefined();
    expect(next.pages[0].blocks[0].props.posY).toBeUndefined();
    expect(next.pages[0].blocks[0].props.width).toBeUndefined();
  });
});
