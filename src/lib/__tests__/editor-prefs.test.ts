import { describe, expect, it } from "vitest";
import { parseCollapsedFlag, serializeCollapsedFlag } from "@/lib/editor-prefs";

describe("editor prefs", () => {
  it("parses and serializes collapse flags", () => {
    expect(parseCollapsedFlag("1")).toBe(true);
    expect(parseCollapsedFlag("true")).toBe(true);
    expect(parseCollapsedFlag("0")).toBe(false);
    expect(parseCollapsedFlag(null)).toBe(false);
    expect(serializeCollapsedFlag(true)).toBe("1");
    expect(serializeCollapsedFlag(false)).toBe("0");
  });
});
