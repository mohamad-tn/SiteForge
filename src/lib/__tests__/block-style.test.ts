import { describe, expect, it } from "vitest";
import { blockFrameStyle, defaultStyleProps, STYLE_KEYS, blockMotionAttrs, detectEffectPreset, effectPresetProps, resolveEaseCss, EASE_PRESETS, resolveBlockHref } from "@/lib/block-style";

describe("block-style encode", () => {
  it("defaultStyleProps covers STYLE_KEYS", () => {
    const d = defaultStyleProps();
    for (const k of STYLE_KEYS) {
      expect(d).toHaveProperty(k);
    }
  });

  it("blockFrameStyle maps numeric padding to px", () => {
    const style = blockFrameStyle({ paddingY: "24", bgColor: "#fff", opacity: "50" });
    expect(style.paddingTop).toBe("24px");
    expect(style.paddingBottom).toBe("24px");
    expect(style.background).toBe("#fff");
    expect(style.opacity).toBe(0.5);
  });
});

describe("block motion / effects", () => {
  it("maps effect presets to entrance + hover classes", () => {
    const soft = blockMotionAttrs(effectPresetProps("soft-fade"));
    expect(soft.hasEntrance).toBe(true);
    expect(soft.className).toContain("sf-anim-fade");

    const lift = blockMotionAttrs(effectPresetProps("lift-hover"));
    expect(lift.className).toContain("sf-hover-scale-md");
    expect(lift.className).toContain("sf-hover-shadow");

    const glow = blockMotionAttrs(effectPresetProps("glow-hover"));
    expect(glow.className).toContain("sf-hover-glow");

    const blur = blockMotionAttrs(effectPresetProps("blur-in"));
    expect(blur.className).toContain("sf-anim-blur-in");

    const bounce = blockMotionAttrs(effectPresetProps("bounce-in"));
    expect(bounce.className).toContain("sf-anim-bounce-in");

    const softLift = blockMotionAttrs(effectPresetProps("soft-lift"));
    expect(softLift.className).toContain("sf-anim-slide-up");
    expect(softLift.className).toContain("sf-hover-scale-sm");
  });

  it("detects presets and scrollReveal flag", () => {
    expect(detectEffectPreset(effectPresetProps("float"))).toBe("float");
    const m = blockMotionAttrs({ ...effectPresetProps("slide-up"), scrollReveal: "true" });
    expect(m.scrollReveal).toBe(true);
    expect(m.hasEntrance).toBe(true);
  });

  it("wires per-block delay and optional child stagger", () => {
    const delayed = blockMotionAttrs({
      ...effectPresetProps("soft-fade"),
      animDelay: "120",
      animDuration: "500",
    });
    expect(delayed.style["--sf-anim-delay"]).toBe("120ms");
    expect(delayed.style["--sf-anim-dur"]).toBe("500ms");

    const stagger = blockMotionAttrs({
      entranceAnim: "none",
      staggerChildren: "true",
      staggerMs: "100",
      animDelay: "40",
    });
    expect(stagger.className).toContain("sf-stagger");
    expect(stagger.hasEntrance).toBe(true);
    expect(stagger.style["--sf-stagger-ms"]).toBe("100ms");
    expect(stagger.style["--sf-anim-delay"]).toBe("40ms");
  });

  it("maps easing presets to --sf-ease CSS vars", () => {
    expect(resolveEaseCss("ease-out")).toBe(EASE_PRESETS["ease-out"]);
    expect(resolveEaseCss("springy")).toBe(EASE_PRESETS.springy);
    expect(resolveEaseCss("soft")).toBe(EASE_PRESETS.soft);
    expect(resolveEaseCss("unknown")).toBe(EASE_PRESETS["ease-out"]);

    const springy = blockMotionAttrs({
      ...effectPresetProps("soft-fade"),
      animEase: "springy",
    });
    expect(springy.style["--sf-ease"]).toBe(EASE_PRESETS.springy);

    const softStagger = blockMotionAttrs({
      entranceAnim: "none",
      staggerChildren: "true",
      animEase: "soft",
    });
    expect(softStagger.className).toContain("sf-stagger");
    expect(softStagger.style["--sf-ease"]).toBe(EASE_PRESETS.soft);
  });

});


describe("resolveBlockHref", () => {
  it("resolves page mode to site page URL", () => {
    expect(resolveBlockHref({ linkMode: "page", linkPageSlug: "about" }, "href", "demo").href).toBe(
      "/s/demo?p=about"
    );
  });

  it("builds a real public collection URL with query + hash", () => {
    expect(
      resolveBlockHref(
        { linkMode: "collection", linkPageSlug: "work", linkCollectionSlug: "projects" },
        "href",
        "demo"
      ).href
    ).toBe("/s/demo?p=work&collection=projects#collection-projects");
    expect(
      resolveBlockHref(
        { linkMode: "collection", linkPageSlug: "home", linkCollectionSlug: "team" },
        "ctaHref",
        "acme"
      ).href
    ).toBe("/s/acme?p=home&collection=team#collection-team");
  });

  it("prefers collection item href when set", () => {
    expect(
      resolveBlockHref(
        {
          linkMode: "collection",
          linkPageSlug: "work",
          linkCollectionItemHref: "https://example.com/x",
        },
        "href",
        "demo"
      ).href
    ).toBe("https://example.com/x");
  });

  it("does not apply collection mode to secondaryHref", () => {
    expect(
      resolveBlockHref(
        {
          linkMode: "collection",
          linkPageSlug: "work",
          linkCollectionSlug: "projects",
          secondaryHref: "#about",
        },
        "secondaryHref",
        "demo"
      ).href
    ).toBe("#about");
  });

  it("keeps raw url mode", () => {
    expect(resolveBlockHref({ linkMode: "url", href: "#cta" }, "href", "demo").href).toBe("#cta");
  });

  it("normalizes bare www hosts so preview never appends them", () => {
    expect(resolveBlockHref({ linkMode: "url", href: "www.google.com" }, "href", "demo").href).toBe(
      "https://www.google.com"
    );
    expect(resolveBlockHref({ linkMode: "url", href: "google.com/x" }, "href").href).toBe(
      "https://google.com/x"
    );
  });

  it("opens external urls in a new tab when openInNewTab is unset", () => {
    const r = resolveBlockHref({ linkMode: "url", href: "https://example.com" }, "href");
    expect(r.target).toBe("_blank");
    expect(r.rel).toBe("noopener noreferrer");
  });

  it("honors explicit same-tab for external urls", () => {
    const r = resolveBlockHref(
      { linkMode: "url", href: "https://example.com", openInNewTab: "false" },
      "href"
    );
    expect(r.target).toBeUndefined();
  });

  it("blocks javascript: hrefs", () => {
    expect(resolveBlockHref({ linkMode: "url", href: "javascript:alert(1)" }, "href").href).toBe("#");
  });
});


describe("blockFrameStyle canvas vs flow", () => {
  it("does not absolutize leftover pos on flow", () => {
    const style = blockFrameStyle({ posX: "24", posY: "400", width: "720" });
    expect(style.position).toBeUndefined();
    expect(style.top).toBeUndefined();
    expect(style.left).toBeUndefined();
  });

  it("absolutizes only when canvas option is set", () => {
    const style = blockFrameStyle({ posX: "24", posY: "400" }, { canvas: true });
    expect(style.position).toBe("absolute");
    expect(style.left).toBe("24px");
    expect(style.top).toBe("400px");
  });
});
