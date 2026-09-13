/**
 * Pure canvas math for the free-layout editor (snap, marquee, align, auto-place).
 * No React — kept SRP so SiteRenderer / editor-shell stay thin.
 */

import type { Block, BlockType, Page } from "@/lib/design";
import { isLockedProp } from "@/lib/editor-selection";

export const CANVAS_GRID = 8;
export const CANVAS_SNAP_THRESHOLD = 6;
export const CANVAS_ORIGIN_X = 24;
export const CANVAS_ORIGIN_Y = 72;
export const CANVAS_GAP_Y = 24;
export const CANVAS_DEFAULT_WIDTH = 720;

export type CanvasRect = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  locked?: boolean;
};

export type GuideLine = {
  orientation: "v" | "h";
  /** Absolute canvas coordinate (left for v, top for h). */
  at: number;
};

export type SnapResult = {
  x: number;
  y: number;
  guides: GuideLine[];
};

export type AlignAxis =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom";

export function parsePos(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(String(v).replace(/px$/i, "").trim());
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function formatPos(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(Number.isInteger(r) ? r : r);
}

/** Per-type height estimates used when auto-placing / sizing missing dims. */
export function estimateBlockSize(type: BlockType): { w: number; h: number } {
  switch (type) {
    case "navbar":
      return { w: CANVAS_DEFAULT_WIDTH, h: 64 };
    case "hero":
      return { w: CANVAS_DEFAULT_WIDTH, h: 420 };
    case "features":
    case "gallery":
    case "pricing":
    case "testimonials":
    case "faq":
    case "stats":
    case "collectionList":
      return { w: CANVAS_DEFAULT_WIDTH, h: 360 };
    case "cta":
    case "contact":
    case "form":
      return { w: CANVAS_DEFAULT_WIDTH, h: 280 };
    case "footer":
      return { w: CANVAS_DEFAULT_WIDTH, h: 200 };
    case "heading":
      return { w: 560, h: 56 };
    case "text":
      return { w: 560, h: 120 };
    case "image":
    case "video":
      return { w: 560, h: 320 };
    case "button":
      return { w: 200, h: 48 };
    case "spacer":
      return { w: CANVAS_DEFAULT_WIDTH, h: 56 };
    case "columns":
      return { w: CANVAS_DEFAULT_WIDTH, h: 200 };
    case "divider":
      return { w: CANVAS_DEFAULT_WIDTH, h: 24 };
    case "list":
      return { w: 480, h: 160 };
    default:
      return { w: CANVAS_DEFAULT_WIDTH, h: 160 };
  }
}

export function pageUsesCanvas(page: Pick<Page, "layout" | "blocks"> | null | undefined): boolean {
  if (!page) return true;
  if (page.layout === "flow") return false;
  if (page.layout === "canvas") return true;
  // Legacy: any positioned block ⇒ treat as canvas for rendering.
  return page.blocks.some((b) => {
    const p = b.props as Record<string, unknown>;
    return Boolean(p.posX) || Boolean(p.posY);
  });
}

export function blockHasPosition(props: Record<string, unknown>): boolean {
  return Boolean(props.posX) || Boolean(props.posY);
}

export function readBlockRect(block: Block, fallbackIndex = 0): CanvasRect {
  const props = block.props as Record<string, unknown>;
  const est = estimateBlockSize(block.type);
  const w = parsePos(props.width, est.w) || est.w;
  const h =
    parsePos(props.height, 0) ||
    parsePos(props.minHeight, 0) ||
    est.h;
  const x = blockHasPosition(props)
    ? parsePos(props.posX, CANVAS_ORIGIN_X)
    : CANVAS_ORIGIN_X;
  const y = blockHasPosition(props)
    ? parsePos(props.posY, CANVAS_ORIGIN_Y + fallbackIndex * (est.h + CANVAS_GAP_Y))
    : CANVAS_ORIGIN_Y + fallbackIndex * (est.h + CANVAS_GAP_Y);
  return {
    id: block.id,
    x,
    y,
    w: Math.max(24, w),
    h: Math.max(16, h),
    locked: isLockedProp(props),
  };
}

/** Stack blocks that lack positions into a sensible canvas column. */
export function autoPlaceBlocks(blocks: Block[]): Block[] {
  let y = CANVAS_ORIGIN_Y;
  return blocks.map((block) => {
    const props = { ...(block.props as Record<string, unknown>) };
    if (blockHasPosition(props)) {
      const h = readBlockRect(block).h;
      y = Math.max(y, parsePos(props.posY, y) + h + CANVAS_GAP_Y);
      return block;
    }
    const est = estimateBlockSize(block.type);
    const next: Block = {
      ...block,
      props: {
        ...props,
        posX: formatPos(CANVAS_ORIGIN_X),
        posY: formatPos(y),
        ...(props.width ? {} : { width: formatPos(est.w) }),
      },
    };
    y += est.h + CANVAS_GAP_Y;
    return next;
  });
}

/** Default insert spot below the lowest unlocked block (or origin). */
export function defaultInsertPosition(blocks: Block[]): { posX: string; posY: string; width: string } {
  let maxBottom = CANVAS_ORIGIN_Y;
  for (const b of blocks) {
    const r = readBlockRect(b);
    maxBottom = Math.max(maxBottom, r.y + r.h);
  }
  return {
    posX: formatPos(CANVAS_ORIGIN_X),
    posY: formatPos(maxBottom + CANVAS_GAP_Y),
    width: formatPos(CANVAS_DEFAULT_WIDTH),
  };
}

export function snapToGrid(n: number, grid = CANVAS_GRID): number {
  return Math.round(n / grid) * grid;
}

/**
 * Snap a moving rect's edges/centers to peers + grid.
 * `disableSnap` (Alt/Option) returns the raw position with no guides.
 */
export function snapRect(
  moving: { x: number; y: number; w: number; h: number },
  peers: CanvasRect[],
  opts?: { threshold?: number; grid?: number; disableSnap?: boolean }
): SnapResult {
  const threshold = opts?.threshold ?? CANVAS_SNAP_THRESHOLD;
  const grid = opts?.grid ?? CANVAS_GRID;
  if (opts?.disableSnap) {
    return { x: moving.x, y: moving.y, guides: [] };
  }

  let x = moving.x;
  let y = moving.y;
  const guides: GuideLine[] = [];

  const movingEdges = {
    left: x,
    right: x + moving.w,
    cx: x + moving.w / 2,
    top: y,
    bottom: y + moving.h,
    cy: y + moving.h / 2,
  };

  let bestDx = threshold + 1;
  let bestDy = threshold + 1;
  let snapX: number | null = null;
  let snapY: number | null = null;
  let guideV: number | null = null;
  let guideH: number | null = null;

  for (const peer of peers) {
    if (peer.id && peer.id === (moving as { id?: string }).id) continue;
    const targetsX = [peer.x, peer.x + peer.w / 2, peer.x + peer.w];
    const sourcesX: { edge: number; apply: (t: number) => number }[] = [
      { edge: movingEdges.left, apply: (t) => t },
      { edge: movingEdges.cx, apply: (t) => t - moving.w / 2 },
      { edge: movingEdges.right, apply: (t) => t - moving.w },
    ];
    for (const t of targetsX) {
      for (const s of sourcesX) {
        const d = Math.abs(s.edge - t);
        if (d <= threshold && d < bestDx) {
          bestDx = d;
          snapX = s.apply(t);
          guideV = t;
        }
      }
    }

    const targetsY = [peer.y, peer.y + peer.h / 2, peer.y + peer.h];
    const sourcesY: { edge: number; apply: (t: number) => number }[] = [
      { edge: movingEdges.top, apply: (t) => t },
      { edge: movingEdges.cy, apply: (t) => t - moving.h / 2 },
      { edge: movingEdges.bottom, apply: (t) => t - moving.h },
    ];
    for (const t of targetsY) {
      for (const s of sourcesY) {
        const d = Math.abs(s.edge - t);
        if (d <= threshold && d < bestDy) {
          bestDy = d;
          snapY = s.apply(t);
          guideH = t;
        }
      }
    }
  }

  // Grid snap when no peer snap wins.
  const gx = snapToGrid(x, grid);
  const gy = snapToGrid(y, grid);
  if (snapX == null && Math.abs(gx - x) <= threshold) {
    snapX = gx;
  }
  if (snapY == null && Math.abs(gy - y) <= threshold) {
    snapY = gy;
  }

  if (snapX != null) x = snapX;
  if (snapY != null) y = snapY;
  if (guideV != null) guides.push({ orientation: "v", at: guideV });
  if (guideH != null) guides.push({ orientation: "h", at: guideH });

  return { x, y, guides };
}

/** Axis-aligned intersection (inclusive edges). */
export function rectsIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function normalizeMarquee(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): { x: number; y: number; w: number; h: number } {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return { x, y, w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

/** Marquee hit-test — unlocked blocks whose rects intersect the selection box. */
export function marqueeHitTest(marquee: { x: number; y: number; w: number; h: number }, rects: CanvasRect[]): string[] {
  if (marquee.w < 1 && marquee.h < 1) return [];
  return rects.filter((r) => !r.locked && rectsIntersect(marquee, r)).map((r) => r.id);
}

export function nudgeRects(
  rects: CanvasRect[],
  ids: string[],
  dx: number,
  dy: number
): { id: string; x: number; y: number }[] {
  const set = new Set(ids);
  return rects
    .filter((r) => set.has(r.id) && !r.locked)
    .map((r) => ({
      id: r.id,
      x: r.x + dx,
      y: r.y + dy,
    }));
}

/** Align selected unlocked rects; returns new positions (x and/or y). */
export function alignRects(rects: CanvasRect[], ids: string[], axis: AlignAxis): { id: string; x: number; y: number }[] {
  const set = new Set(ids);
  const selected = rects.filter((r) => set.has(r.id) && !r.locked);
  if (selected.length < 2 && (axis === "left" || axis === "top" || axis === "right" || axis === "bottom" || axis === "center" || axis === "middle")) {
    // Single selection: still allow align against min bounds of itself (no-op) — require 2+.
    if (selected.length < 2) return [];
  }
  if (selected.length === 0) return [];

  const minX = Math.min(...selected.map((r) => r.x));
  const maxR = Math.max(...selected.map((r) => r.x + r.w));
  const minY = Math.min(...selected.map((r) => r.y));
  const maxB = Math.max(...selected.map((r) => r.y + r.h));
  const midX = (minX + maxR) / 2;
  const midY = (minY + maxB) / 2;

  return selected.map((r) => {
    let x = r.x;
    let y = r.y;
    if (axis === "left") x = minX;
    if (axis === "right") x = maxR - r.w;
    if (axis === "center") x = midX - r.w / 2;
    if (axis === "top") y = minY;
    if (axis === "bottom") y = maxB - r.h;
    if (axis === "middle") y = midY - r.h / 2;
    return { id: r.id, x, y };
  });
}

/** Evenly distribute selected rects along an axis (needs 3+). */
export function distributeRects(
  rects: CanvasRect[],
  ids: string[],
  axis: "horizontal" | "vertical"
): { id: string; x: number; y: number }[] {
  const set = new Set(ids);
  const selected = rects.filter((r) => set.has(r.id) && !r.locked);
  if (selected.length < 3) return [];

  if (axis === "horizontal") {
    const sorted = [...selected].sort((a, b) => a.x - b.x);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const span = last.x + last.w - first.x;
    const totalW = sorted.reduce((acc, r) => acc + r.w, 0);
    const gap = (span - totalW) / (sorted.length - 1);
    const out: { id: string; x: number; y: number }[] = [];
    let cursor = first.x;
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      if (i === 0) {
        out.push({ id: r.id, x: r.x, y: r.y });
        cursor = first.x + first.w + gap;
      } else if (i === sorted.length - 1) {
        out.push({ id: r.id, x: r.x, y: r.y });
      } else {
        out.push({ id: r.id, x: cursor, y: r.y });
        cursor += r.w + gap;
      }
    }
    return out;
  }

  const sorted = [...selected].sort((a, b) => a.y - b.y);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = last.y + last.h - first.y;
  const totalH = sorted.reduce((acc, r) => acc + r.h, 0);
  const gap = (span - totalH) / (sorted.length - 1);
  const out: { id: string; x: number; y: number }[] = [];
  let cursor = first.y;
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    if (i === 0) {
      out.push({ id: r.id, x: r.x, y: r.y });
      cursor = first.y + first.h + gap;
    } else if (i === sorted.length - 1) {
      out.push({ id: r.id, x: r.x, y: r.y });
    } else {
      out.push({ id: r.id, x: r.x, y: cursor });
      cursor += r.h + gap;
    }
  }
  return out;
}

/** Apply position patches onto blocks (immutable). */
export function applyPositions(
  blocks: Block[],
  patches: { id: string; x: number; y: number }[]
): Block[] {
  const map = new Map(patches.map((p) => [p.id, p]));
  return blocks.map((b) => {
    const p = map.get(b.id);
    if (!p) return b;
    if (isLockedProp(b.props as Record<string, unknown>)) return b;
    return {
      ...b,
      props: {
        ...b.props,
        posX: formatPos(p.x),
        posY: formatPos(p.y),
      },
    };
  });
}
