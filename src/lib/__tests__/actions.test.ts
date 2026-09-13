import { describe, expect, it } from "vitest";
import { normalizeActionType, sanitizeActionTarget, BUTTON_ACTION_TYPES } from "@/lib/design";

describe("allowlisted button actions", () => {
  it("includes openModal and scrollTo", () => {
    expect(BUTTON_ACTION_TYPES).toContain("openModal");
    expect(BUTTON_ACTION_TYPES).toContain("scrollTo");
  });

  it("normalizes known action types", () => {
    expect(normalizeActionType("openModal")).toBe("openModal");
    expect(normalizeActionType("scrollTo")).toBe("scrollTo");
    expect(normalizeActionType("evil")).toBe("link");
  });

  it("sanitizes action targets", () => {
    expect(sanitizeActionTarget("hero-1")).toBe("hero-1");
    expect(sanitizeActionTarget("#section_2")).toBe("section_2");
    expect(sanitizeActionTarget("javascript:alert(1)")).toBe("");
    expect(sanitizeActionTarget("../etc")).toBe("");
  });
});
