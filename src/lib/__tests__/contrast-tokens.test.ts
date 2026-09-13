import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  ensureReadableText,
  contrastCorrectPalette,
  contrastForSectionBg,
  tokensForRender,
  defaultTokens,
  defaultLightColors,
} from "@/lib/design";

describe("contrast helpers", () => {
  it("detects poor contrast for pale muted on cream", () => {
    const ratio = contrastRatio("#c4b5a5", "#faf8f5");
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeLessThan(4.5);
  });

  it("clamps pale text to dark readable on light bg", () => {
    expect(ensureReadableText("#c4b5a5", "#faf8f5")).toBe("#1c1917");
    expect(ensureReadableText("#44403c", "#ffffff")).toBe("#44403c");
  });

  it("contrastCorrectPalette fixes light-mode muted/text", () => {
    const fixed = contrastCorrectPalette(
      { ...defaultLightColors, text: "#c4b5a5", muted: "#d6d3d1" },
      "light"
    );
    expect(fixed.text).toBe("#1c1917");
    expect(fixed.muted).toBe("#44403c");
    expect(contrastRatio(fixed.muted, fixed.background)!).toBeGreaterThanOrEqual(4.5);
  });

  it("tokensForRender uses light palette (not colorsDark) in light mode and corrects contrast", () => {
    const tokens = {
      ...defaultTokens,
      colors: { ...defaultLightColors, muted: "#c4b5a5", text: "#e7e5e4" },
      colorsDark: {
        ...defaultTokens.colorsDark!,
        text: "#fafaf9",
        muted: "#a8a29e",
        background: "#0c0a09",
      },
    };
    const light = tokensForRender(tokens, "light", "ar");
    expect(light.colors.background).not.toBe("#0c0a09");
    expect(light.colors.text).toBe("#1c1917");
    expect(light.colors.muted).toBe("#44403c");
    const dark = tokensForRender(tokens, "dark", "ar");
    expect(dark.colors.background).toBe("#0c0a09");
  });

  it("contrastForSectionBg picks dark text on light footer luminance (no ghost #cbd5e1/#fff)", () => {
    const lightFoot = contrastForSectionBg("#ffffff", undefined, defaultLightColors, "surface");
    expect(lightFoot.background).toBe("#ffffff");
    expect(lightFoot.color).toBe("#1c1917");
    expect(contrastRatio(lightFoot.color, lightFoot.background)!).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(lightFoot.muted, lightFoot.background)!).toBeGreaterThanOrEqual(3.5);
    // Pale user text on cream still corrected
    const ghost = contrastForSectionBg("#faf8f5", "#cbd5e1", defaultLightColors, "surface");
    expect(ghost.color).toBe("#1c1917");
    expect(ghost.color).not.toBe("#fff");
    expect(ghost.color).not.toBe("#cbd5e1");
  });

  it("contrastForSectionBg picks light text on dark footer luminance", () => {
    const darkFoot = contrastForSectionBg("#0c0a09", undefined, defaultLightColors, "surface");
    expect(darkFoot.color).toBe("#fafaf9");
    expect(contrastRatio(darkFoot.color, darkFoot.background)!).toBeGreaterThanOrEqual(4.5);
  });

  it("contrastForSectionBg defaults to surface (not secondary) when userBg missing", () => {
    const chrome = contrastForSectionBg(undefined, undefined, defaultLightColors, "surface");
    expect(chrome.background).toBe(defaultLightColors.surface);
    expect(chrome.color).toBe("#1c1917");
  });
});
