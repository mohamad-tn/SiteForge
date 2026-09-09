import { describe, expect, it } from "vitest";
import { blockFrameStyle, defaultStyleProps, STYLE_KEYS, blockMotionAttrs, detectEffectPreset, effectPresetProps, resolveEaseCss, EASE_PRESETS } from "@/lib/block-style";

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
