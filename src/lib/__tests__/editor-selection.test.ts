import { describe, expect, it } from "vitest";
import {
  add,
  clear,
  isHiddenProp,
  isLockedProp,
  primaryOf,
  replaceSelection,
  selectAll,
  selectAllIds,
  toggleInSet,
  toggleSelection,
  unlockedIds,
} from "@/lib/editor-selection";
import { blockFrameStyle, defaultStyleProps, STYLE_KEYS, isStyleFlag } from "@/lib/block-style";

describe("editor-selection", () => {
  it("toggleInSet / add / clear / selectAllIds", () => {
    expect(clear()).toEqual([]);
    expect(add([], "a")).toEqual(["a"]);
    expect(add(["a"], "a")).toEqual(["a"]);
    expect(add(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleInSet(["a", "b"], "b")).toEqual(["a"]);
    expect(toggleInSet(["a"], "b")).toEqual(["a", "b"]);
    expect(selectAllIds(["x", "y", "z"])).toEqual(["x", "y", "z"]);
  });

  it("replaceSelection and toggleSelection keep primary for inspector", () => {
    expect(replaceSelection(null)).toEqual({ selectedId: null, selectedIds: [] });
    expect(replaceSelection("a")).toEqual({ selectedId: "a", selectedIds: ["a"] });
    const toggled = toggleSelection({ selectedId: "a", selectedIds: ["a"] }, "b");
    expect(toggled.selectedIds).toEqual(["a", "b"]);
    expect(toggled.selectedId).toBe("b");
    const removed = toggleSelection(toggled, "b");
    expect(removed.selectedIds).toEqual(["a"]);
    expect(removed.selectedId).toBe("a");
  });

  it("selectAll and primaryOf", () => {
    const all = selectAll(["1", "2", "3"]);
    expect(all.selectedIds).toEqual(["1", "2", "3"]);
    expect(all.selectedId).toBe("1");
    expect(primaryOf(["a", "b"], "b")).toBe("b");
    expect(primaryOf(["a", "b"], "z")).toBe("b");
    expect(primaryOf([], null)).toBeNull();
  });

  it("unlockedIds skips locked blocks", () => {
    const blocks = [
      { id: "a", props: { locked: "false" } },
      { id: "b", props: { locked: "true" } },
      { id: "c", props: {} },
    ];
    expect(unlockedIds(["a", "b", "c"], blocks)).toEqual(["a", "c"]);
  });

  it("isLockedProp / isHiddenProp", () => {
    expect(isLockedProp({ locked: "true" })).toBe(true);
    expect(isLockedProp({ locked: "false" })).toBe(false);
    expect(isHiddenProp({ hidden: "true" })).toBe(true);
    expect(isHiddenProp({})).toBe(false);
  });
});

describe("locked + optional free layout style keys", () => {
  it("includes locked/posX/posY in STYLE_KEYS defaults", () => {
    expect(STYLE_KEYS).toContain("locked");
    expect(STYLE_KEYS).toContain("posX");
    expect(STYLE_KEYS).toContain("posY");
    const d = defaultStyleProps();
    expect(d.locked).toBe("false");
    expect(d.hidden).toBe("false");
    expect(d.posX).toBe("");
    expect(d.posY).toBe("");
  });

  it("isStyleFlag reads locked/hidden", () => {
    expect(isStyleFlag({ locked: "true" }, "locked")).toBe(true);
    expect(isStyleFlag({ hidden: "false" }, "hidden")).toBe(false);
  });

  it("absolutizes leftover pos only on canvas pages, never on flow", () => {
    const leftover = blockFrameStyle({ posX: "12", posY: "8" });
    expect(leftover.position).toBeUndefined();
    const xOnly = blockFrameStyle({ posX: "12" }, { canvas: true });
    expect(xOnly.position).toBe("absolute");
    expect(xOnly.left).toBe("12px");
    expect(xOnly.top).toBe("0px");
    const yOnly = blockFrameStyle({ posY: "8" }, { canvas: true });
    expect(yOnly.position).toBe("absolute");
    expect(yOnly.top).toBe("8px");
    const both = blockFrameStyle({ posX: "12", posY: "8" }, { canvas: true });
    expect(both.position).toBe("absolute");
    expect(both.left).toBe("12px");
    expect(both.top).toBe("8px");
    const forced = blockFrameStyle({}, { canvas: true });
    expect(forced.position).toBe("absolute");
  });
});
