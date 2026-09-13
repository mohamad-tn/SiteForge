import { describe, expect, it } from "vitest";
import {
  alignRects,
  applyResizeDelta,
  autoPlaceBlocks,
  clampResizeSize,
  clampZoom,
  clientToCanvasLocal,
  distributeRects,
  defaultInsertPosition,
  formatPos,
  marqueeHitTest,
  measureRectToLocal,
  normalizeMarquee,
  nudgeRects,
  pageUsesCanvas,
  parsePos,
  readBlockRect,
  snapRect,
  snapResizeRect,
  snapToGrid,
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
    expect(next[0].props.posX).toBe("24");
    expect(next[0].props.posY).toBe("72");
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

  it("pageUsesCanvas defaults and flow opt-out", () => {
    expect(pageUsesCanvas({ layout: "canvas", blocks: [] })).toBe(true);
    expect(pageUsesCanvas({ layout: "flow", blocks: [] })).toBe(false);
    expect(
      pageUsesCanvas({
        blocks: [block("a", "text", { posX: "1", posY: "2" })],
      } as never)
    ).toBe(true);
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
});
