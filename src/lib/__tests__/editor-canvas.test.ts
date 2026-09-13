import { describe, expect, it } from "vitest";
import {
  alignRects,
  applyResizeDelta,
  artboardHeightFromBlocks,
  autoPlaceBlocks,
  clearBlockPositions,
  clampResizeSize,
  clampZoom,
  clientToCanvasLocal,
  createStackGroup,
  detachStackMember,
  distributeRects,
  defaultInsertPosition,
  formatPos,
  applyPositions,
  applySizePatches,
  isInvalidCanvasSize,
  layoutStack,
  pointerMovedPastThreshold,
  sanitizeFlowBlocks,
  marqueeHitTest,
  measureRectToLocal,
  normalizeMarquee,
  nudgeRects,
  pageUsesCanvas,
  parsePos,
  readBlockRect,
  reflowStackBlocks,
  resizeAnchor,
  scaleGroupRects,
  snapRect,
  snapResizeRect,
  snapToGrid,
  unionBounds,
} from "@/lib/editor-canvas";
import type { Block } from "@/lib/design";

function block(id: string, type: Block["type"], props: Record<string, unknown> = {}): Block {
  return { id, type, props };
}

describe("editor-canvas math", () => {
  it("parsePos / formatPos / snapToGrid", () => {
    expect(parsePos("12")).toBe(12);
    expect(parsePos("12px")).toBe(12);
    expect(formatPos(8.2)).toBe("8.2");
    expect(snapToGrid(10)).toBe(8);
    expect(snapToGrid(12)).toBe(16);
  });

  it("autoPlaceBlocks stacks unpositioned blocks", () => {
    const next = autoPlaceBlocks([
      block("a", "navbar"),
      block("b", "hero"),
      block("c", "text", { posX: "100", posY: "900" }),
    ]);
    expect(next[0].props.posX).toBe("0");
    expect(next[0].props.posY).toBe("0");
    expect(next[0].props.width).toBe("100%");
    expect(next[1].props.posY).toBeTruthy();
    expect(next[2].props.posX).toBe("100");
    expect(next[2].props.posY).toBe("900");
  });

  it("defaultInsertPosition sits below lowest block", () => {
    const pos = defaultInsertPosition([
      block("a", "heading", { posX: "24", posY: "72", width: "400", height: "40" }),
    ]);
    expect(Number(pos.posY)).toBeGreaterThan(72);
  });

  it("snapRect snaps to peer edges and emits guides", () => {
    const peers = [{ id: "p", x: 100, y: 50, w: 200, h: 80 }];
    const r = snapRect({ x: 103, y: 200, w: 120, h: 40 }, peers, { threshold: 6 });
    expect(r.x).toBe(100);
    expect(r.guides.some((g) => g.orientation === "v" && g.at === 100)).toBe(true);
  });

  it("snapRect respects disableSnap", () => {
    const r = snapRect({ x: 103, y: 51, w: 10, h: 10 }, [{ id: "p", x: 100, y: 50, w: 20, h: 20 }], {
      disableSnap: true,
    });
    expect(r.x).toBe(103);
    expect(r.guides).toEqual([]);
  });

  it("marqueeHitTest intersects unlocked only", () => {
    const box = normalizeMarquee(0, 0, 120, 120);
    const hits = marqueeHitTest(box, [
      { id: "a", x: 10, y: 10, w: 50, h: 50 },
      { id: "b", x: 10, y: 10, w: 50, h: 50, locked: true },
      { id: "c", x: 400, y: 400, w: 10, h: 10 },
    ]);
    expect(hits).toEqual(["a"]);
  });

  it("nudgeRects and alignRects", () => {
    const rects = [
      { id: "a", x: 10, y: 20, w: 40, h: 20 },
      { id: "b", x: 80, y: 60, w: 40, h: 20 },
    ];
    expect(nudgeRects(rects, ["a", "b"], 1, 0)).toEqual([
      { id: "a", x: 11, y: 20 },
      { id: "b", x: 81, y: 60 },
    ]);
    const aligned = alignRects(rects, ["a", "b"], "left");
    expect(aligned.every((p) => p.x === 10)).toBe(true);
  });

  it("distributeRects spaces three blocks", () => {
    const rects = [
      { id: "a", x: 0, y: 0, w: 10, h: 10 },
      { id: "b", x: 20, y: 0, w: 10, h: 10 },
      { id: "c", x: 90, y: 0, w: 10, h: 10 },
    ];
    const out = distributeRects(rects, ["a", "b", "c"], "horizontal");
    expect(out).toHaveLength(3);
    const mid = out.find((p) => p.id === "b");
    expect(mid?.x).toBe(45);
  });

  it("pageUsesCanvas requires explicit canvas layout", () => {
    expect(pageUsesCanvas({ layout: "canvas", blocks: [] })).toBe(true);
    expect(pageUsesCanvas({ layout: "flow", blocks: [] })).toBe(false);
    expect(
      pageUsesCanvas({
        blocks: [block("a", "text", { posX: "1", posY: "2" })],
      } as never)
    ).toBe(false);
    expect(pageUsesCanvas(null)).toBe(false);
  });

  it("readBlockRect falls back to estimates", () => {
    const r = readBlockRect(block("x", "hero"));
    expect(r.w).toBeGreaterThan(100);
    expect(r.h).toBeGreaterThan(100);
  });
});


describe("DOM measure / resize / zoom", () => {
  it("measureRectToLocal maps client box into canvas-local coords", () => {
    const local = measureRectToLocal(
      { left: 140, top: 220, width: 200, height: 80 },
      { left: 40, top: 100 },
      10,
      20,
      1
    );
    expect(local.x).toBe(110); // 140-40+10
    expect(local.y).toBe(140); // 220-100+20
    expect(local.w).toBe(200);
    expect(local.h).toBe(80);
  });

  it("clientToCanvasLocal respects zoom", () => {
    const p = clientToCanvasLocal(140, 220, { left: 40, top: 100 }, 0, 0, 2);
    expect(p.x).toBe(50);
    expect(p.y).toBe(60);
  });

  it("clampZoom stays within 25%–200%", () => {
    expect(clampZoom(0.1)).toBe(0.25);
    expect(clampZoom(3)).toBe(2);
    expect(clampZoom(1.1)).toBe(1);
  });

  it("clampResizeSize enforces ~40×40 minimum", () => {
    expect(clampResizeSize(10, 12)).toEqual({ w: 40, h: 40 });
    expect(clampResizeSize(120, 80)).toEqual({ w: 120, h: 80 });
  });

  it("applyResizeDelta grows e/s/se from origin", () => {
    const o = { x: 10, y: 20, w: 100, h: 50 };
    expect(applyResizeDelta(o, 20, 0, "e").w).toBe(120);
    expect(applyResizeDelta(o, 0, 30, "s").h).toBe(80);
    const se = applyResizeDelta(o, 20, 30, "se");
    expect(se.w).toBe(120);
    expect(se.h).toBe(80);
  });

  it("snapResizeRect snaps right edge to peer", () => {
    const r = snapResizeRect(
      { x: 0, y: 0, w: 98, h: 40 },
      [{ id: "p", x: 100, y: 0, w: 50, h: 40 }],
      "e",
      { threshold: 6 }
    );
    expect(r.w).toBe(100);
    expect(r.guides.some((g) => g.orientation === "v" && g.at === 100)).toBe(true);
  });

  it("applyResizeDelta anchors opposite edge for w/n/nw", () => {
    const o = { x: 10, y: 20, w: 100, h: 50 };
    const w = applyResizeDelta(o, -20, 0, "w");
    expect(w.w).toBe(120);
    expect(w.x).toBe(-10);
    expect(w.y).toBe(20);
    const n = applyResizeDelta(o, 0, -10, "n");
    expect(n.h).toBe(60);
    expect(n.y).toBe(10);
    const nw = applyResizeDelta(o, -20, -10, "nw");
    expect(nw.w).toBe(120);
    expect(nw.h).toBe(60);
    expect(nw.x + nw.w).toBe(110);
    expect(nw.y + nw.h).toBe(70);
  });

  it("resizeAnchor returns opposite corner/edge", () => {
    const r = { x: 0, y: 0, w: 100, h: 40 };
    expect(resizeAnchor(r, "se")).toEqual({ x: 0, y: 0 });
    expect(resizeAnchor(r, "nw")).toEqual({ x: 100, y: 40 });
    expect(resizeAnchor(r, "e")).toEqual({ x: 0, y: 20 });
    expect(resizeAnchor(r, "se", true)).toEqual({ x: 50, y: 20 });
  });

  it("scaleGroupRects scales about opposite BB corner and clamps min", () => {
    const origins = {
      a: { x: 0, y: 0, w: 40, h: 40 },
      b: { x: 60, y: 0, w: 40, h: 40 },
    };
    // Grow SE by 100 → bounds 100x40 → 200x40, sx=2
    const grown = scaleGroupRects(origins, ["a", "b"], "se", 100, 0);
    expect(grown).toHaveLength(2);
    const a = grown.find((p) => p.id === "a")!;
    const b = grown.find((p) => p.id === "b")!;
    expect(a.w).toBe(80);
    expect(b.w).toBe(80);
    expect(a.x).toBe(0);
    expect(b.x).toBe(120);

    // Shrink hard toward min clamp
    const tiny = scaleGroupRects(
      { a: { x: 0, y: 0, w: 80, h: 80 }, b: { x: 100, y: 0, w: 80, h: 80 } },
      ["a", "b"],
      "se",
      -200,
      -200
    );
    expect(tiny.every((p) => p.w >= 40 && p.h >= 40)).toBe(true);
  });

  it("scaleGroupRects aboutCenter keeps BB center", () => {
    const origins = {
      a: { x: 0, y: 0, w: 50, h: 50 },
      b: { x: 50, y: 0, w: 50, h: 50 },
    };
    const bounds0 = unionBounds(Object.values(origins));
    const cx0 = bounds0.x + bounds0.w / 2;
    const out = scaleGroupRects(origins, ["a", "b"], "e", 50, 0, { aboutCenter: true });
    const bounds1 = unionBounds(out);
    const cx1 = bounds1.x + bounds1.w / 2;
    expect(Math.abs(cx1 - cx0)).toBeLessThan(0.01);
  });

  it("snapResizeRect snaps left edge for w handle", () => {
    const r = snapResizeRect(
      { x: 102, y: 0, w: 80, h: 40 },
      [{ id: "p", x: 100, y: 0, w: 20, h: 40 }],
      "w",
      { threshold: 6 }
    );
    expect(r.x).toBe(100);
    expect(r.guides.some((g) => g.orientation === "v" && g.at === 100)).toBe(true);
  });
});


describe("layoutStack / stack detach", () => {
  it("layoutStack packs vertically with gap from min origin", () => {
    const rects = [
      { id: "a", x: 40, y: 100, w: 80, h: 20 },
      { id: "b", x: 10, y: 200, w: 40, h: 30 },
      { id: "c", x: 20, y: 50, w: 60, h: 10 },
    ];
    const out = layoutStack(rects, "y", 16, "start");
    expect(out.map((p) => p.id)).toEqual(["c", "a", "b"]);
    expect(out[0]).toMatchObject({ id: "c", x: 10, y: 50 });
    expect(out[1]).toMatchObject({ id: "a", x: 10, y: 50 + 10 + 16 });
    expect(out[2]).toMatchObject({ id: "b", x: 10, y: 50 + 10 + 16 + 20 + 16 });
  });

  it("layoutStack stretch sets cross-axis size", () => {
    const rects = [
      { id: "a", x: 0, y: 0, w: 40, h: 20 },
      { id: "b", x: 0, y: 40, w: 100, h: 20 },
    ];
    const out = layoutStack(rects, "y", 8, "stretch");
    expect(out.every((p) => p.w === 100)).toBe(true);
    expect(out[0].x).toBe(0);
    expect(out[1].y).toBe(28);
  });

  it("layoutStack horizontal + center align", () => {
    const rects = [
      { id: "a", x: 0, y: 10, w: 20, h: 20 },
      { id: "b", x: 50, y: 0, w: 20, h: 40 },
    ];
    const out = layoutStack(rects, "x", 10, "center");
    expect(out[0].id).toBe("a");
    expect(out[0].x).toBe(0);
    expect(out[0].y).toBe(10); // minY + (40-20)/2
    expect(out[1].x).toBe(30);
    expect(out[1].y).toBe(0);
  });

  it("createStackGroup writes shared stackId and detach clears it", () => {
    const blocks = [
      block("a", "heading", { posX: "0", posY: "0", width: "100", height: "20" }),
      block("b", "text", { posX: "0", posY: "40", width: "100", height: "20" }),
      block("c", "button", { posX: "200", posY: "0", width: "80", height: "40" }),
    ];
    const rects = blocks.map((b, i) => readBlockRect(b, i));
    const stacked = createStackGroup(blocks, rects, ["a", "b"], "y", { gap: 12, stackId: "stk-1" });
    expect(stacked[0].props.stackId).toBe("stk-1");
    expect(stacked[1].props.stackId).toBe("stk-1");
    expect(stacked[0].props.layoutMode).toBe("stack-y");
    expect(stacked[2].props.stackId).toBeUndefined();
    const gap = Number(stacked[1].props.posY) - (Number(stacked[0].props.posY) + 20);
    expect(gap).toBe(12);

    const detached = detachStackMember(stacked, "a");
    expect(detached[0].props.stackId).toBeUndefined();
    expect(detached[0].props.layoutMode).toBe("free");
    expect(detached[1].props.stackId).toBe("stk-1");
  });

  it("reflowStackBlocks packs after one member moves", () => {
    const blocks = [
      block("a", "heading", {
        posX: "10",
        posY: "10",
        width: "50",
        height: "20",
        stackId: "s1",
        stackAxis: "y",
        stackGap: "16",
        stackAlign: "start",
        stackIndex: "0",
        layoutMode: "stack-y",
      }),
      block("b", "text", {
        posX: "10",
        posY: "200",
        width: "50",
        height: "20",
        stackId: "s1",
        stackAxis: "y",
        stackGap: "16",
        stackAlign: "start",
        stackIndex: "1",
        layoutMode: "stack-y",
      }),
    ];
    const next = reflowStackBlocks(blocks, "s1");
    expect(Number(next[0].props.posY)).toBe(10);
    expect(Number(next[1].props.posY)).toBe(10 + 20 + 16);
  });

  it("reflowStackBlocks detaches lone member", () => {
    const blocks = [
      block("a", "heading", {
        posX: "1",
        posY: "2",
        stackId: "lonely",
        stackAxis: "y",
        layoutMode: "stack-y",
      }),
    ];
    const next = reflowStackBlocks(blocks, "lonely");
    expect(next[0].props.stackId).toBeUndefined();
  });
});


describe("flow default / zoom one-way / artboard height / resize clamp", () => {
  it("clearBlockPositions strips pos for flow", () => {
    const next = clearBlockPositions([
      block("a", "hero", { posX: "0", posY: "10", width: "100%" }),
    ]);
    expect(next[0].props.posX).toBeUndefined();
    expect(next[0].props.posY).toBeUndefined();
    expect(next[0].props.width).toBe("100%");
  });

  it("clientToCanvasLocal divides by zoom once (one-way mapping)", () => {
    const p = clientToCanvasLocal(240, 300, { left: 40, top: 100 }, 0, 0, 0.5);
    expect(p.x).toBe(400); // (240-40)/0.5
    expect(p.y).toBe(400); // (300-100)/0.5
  });

  it("artboardHeightFromBlocks uses max(device, bounds+pad)", () => {
    const h = artboardHeightFromBlocks(
      [block("a", "hero", { posX: "0", posY: "0", height: "420" })],
      800,
      120
    );
    expect(h).toBe(800); // max(800, 420+120)
  });

  it("artboardHeightFromBlocks grows with deep blocks", () => {
    const h = artboardHeightFromBlocks(
      [block("a", "text", { posX: "24", posY: "2000", height: "100" })],
      800,
      120
    );
    expect(h).toBe(2220);
  });

  it("isInvalidCanvasSize rejects tiny or NaN", () => {
    expect(isInvalidCanvasSize(10, 50)).toBe(true);
    expect(isInvalidCanvasSize(50, Number.NaN)).toBe(true);
    expect(isInvalidCanvasSize(80, 80)).toBe(false);
  });

  it("measureRectToLocal never multiplies size by zoom (one-way)", () => {
    const local = measureRectToLocal(
      { left: 40, top: 100, width: 200, height: 80 },
      { left: 40, top: 100 },
      0,
      0,
      2
    );
    expect(local.w).toBe(100);
    expect(local.h).toBe(40);
  });
});


describe("click vs drag threshold / flow leftover / resize floor", () => {
  it("click without move does not change pos", () => {
    const blocks = [block("a", "hero", { posX: "0", posY: "10" })];
    expect(pointerMovedPastThreshold(2, 1)).toBe(false);
    const next = pointerMovedPastThreshold(2, 1)
      ? applyPositions(blocks, [{ id: "a", x: 24, y: 80 }])
      : blocks;
    expect(next[0].props.posX).toBe("0");
    expect(next[0].props.posY).toBe("10");
  });

  it("drag after threshold does change pos", () => {
    expect(pointerMovedPastThreshold(5, 0)).toBe(true);
    const blocks = [block("a", "hero", { posX: "0", posY: "10" })];
    const next = applyPositions(blocks, [{ id: "a", x: 0, y: 80 }]);
    expect(next[0].props.posY).toBe("80");
  });

  it("flow ignores leftover pos and 720 canvas width", () => {
    const next = sanitizeFlowBlocks([
      block("a", "hero", { posX: "0", posY: "420", width: "720" }),
      block("b", "text", { posX: "24", posY: "900", width: "560" }),
      block("c", "features", { posX: "0", posY: "10", width: "1120" }),
    ]);
    expect(next[0].props.posX).toBeUndefined();
    expect(next[0].props.posY).toBeUndefined();
    expect(next[0].props.width).toBeUndefined();
    expect(next[1].props.posY).toBeUndefined();
    expect(next[1].props.width).toBe("560");
    expect(next[2].props.width).toBeUndefined();
  });

  it("resize below min is not committed", () => {
    const blocks = [block("a", "text", { posX: "0", posY: "0", width: "200", height: "80" })];
    const next = applySizePatches(blocks, [{ id: "a", x: 0, y: 0, w: 10, h: 10 }]);
    expect(next[0].props.width).toBe("200");
    expect(next[0].props.height).toBe("80");
    const nan = applySizePatches(blocks, [{ id: "a", x: 0, y: 0, w: Number.NaN, h: 80 }]);
    expect(nan[0].props.width).toBe("200");
  });
});
