import { describe, expect, it } from "vitest";
import { getPartStyles, setPartStyles, partStyleToCss, editingTargetLabel } from "@/lib/block-parts";

describe("extended partStyles", () => {
  it("persists bgColor maxWidth borderRadius opacity boxShadow", () => {
    let props: Record<string, unknown> = {};
    props = setPartStyles(props, "cta", {
      bgColor: "#0d9488",
      textColor: "#fff",
      maxWidth: "280",
      borderRadius: "14",
      opacity: "0.95",
      boxShadow: "md",
      paddingX: "20",
      paddingY: "10",
      fontWeight: "700",
    });
    const ps = getPartStyles(props, "cta");
    expect(ps.bgColor).toBe("#0d9488");
    expect(ps.maxWidth).toBe("280");
    expect(ps.boxShadow).toBe("md");
    const css = partStyleToCss(ps);
    expect(css.background).toBe("#0d9488");
    expect(css.maxWidth).toBe("280px");
    expect(css.borderRadius).toBe("14px");
    expect(String(css.boxShadow)).toContain("rgba");
  });

  it("editingTargetLabel distinguishes part vs section", () => {
    expect(editingTargetLabel(null, "ar")).toContain("القسم بالكامل");
    expect(editingTargetLabel("cta", "ar")).toContain("زر CTA");
    expect(editingTargetLabel("cta", "en")).toMatch(/CTA/i);
  });
});
