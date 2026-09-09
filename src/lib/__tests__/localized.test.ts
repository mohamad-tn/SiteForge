import { describe, expect, it } from "vitest";
import { isLocalizedMap, resolveLocalized, setLocalized } from "@/lib/design";

describe("localized string helpers", () => {
  it("resolves plain strings", () => {
    expect(resolveLocalized("hello", "en")).toBe("hello");
  });

  it("resolves locale map with fallback", () => {
    const map = { ar: "مرحبا", en: "hi" };
    expect(resolveLocalized(map, "en")).toBe("hi");
    expect(resolveLocalized(map, "fr", "ar")).toBe("مرحبا");
  });

  it("setLocalized expands string to all locales then overrides", () => {
    const next = setLocalized("base", "en", "EN", ["ar", "en"]);
    expect(next.ar).toBe("base");
    expect(next.en).toBe("EN");
  });

  it("isLocalizedMap guards", () => {
    expect(isLocalizedMap({ ar: "x" })).toBe(true);
    expect(isLocalizedMap("x")).toBe(false);
    expect(isLocalizedMap(["x"])).toBe(false);
  });
});
