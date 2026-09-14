import { describe, expect, it } from "vitest";
import {
  getFallbackCatalog,
  normalizeModelList,
  clearModelCache,
} from "@/lib/ai/model-catalog";

describe("model catalog", () => {
  it("has curated fallbacks with known chat models", () => {
    const openai = getFallbackCatalog("openai");
    expect(openai.some((m) => m.id === "gpt-4o-mini")).toBe(true);
    expect(openai.find((m) => m.id === "gpt-4o")?.vision).toBe(true);
    expect(getFallbackCatalog("anthropic").some((m) => m.id.includes("claude"))).toBe(true);
    expect(getFallbackCatalog("google").some((m) => m.id.includes("gemini"))).toBe(true);
    expect(getFallbackCatalog("xai").some((m) => m.id.includes("grok"))).toBe(true);
  });

  it("normalizes, dedupes, and prefers chat models", () => {
    clearModelCache();
    const list = normalizeModelList("openai", [
      "gpt-4o",
      "gpt-4o",
      "text-embedding-3-small",
      "whisper-1",
      "gpt-4o-mini",
    ]);
    const ids = list.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("gpt-4o");
    expect(ids).toContain("gpt-4o-mini");
    expect(ids).not.toContain("whisper-1");
    expect(ids).not.toContain("text-embedding-3-small");
  });

  it("strips google models/ prefix", () => {
    const list = normalizeModelList("google", ["models/gemini-1.5-flash", "models/gemini-1.5-pro"]);
    expect(list.every((m) => !m.id.startsWith("models/"))).toBe(true);
    expect(list.map((m) => m.id)).toEqual(expect.arrayContaining(["gemini-1.5-flash", "gemini-1.5-pro"]));
  });
});
