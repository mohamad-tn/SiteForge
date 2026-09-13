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

/** Minimum resize box (Framer-like floor). */
export const CANVAS_MIN_SIZE = 40;
export const CANVAS_ZOOM_MIN = 0.25;
export const CANVAS_ZOOM_MAX = 2;
export const CANVAS_ZOOM_STEP = 0.25;

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type LiveCanvasPos = { x: number; y: number; w?: number; h?: number };

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  const stepped = Math.round(z / CANVAS_ZOOM_STEP) * CANVAS_ZOOM_STEP;
  return Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, Math.round(stepped * 100) / 100));
}

export function clampResizeSize(w: number, h: number, min = CANVAS_MIN_SIZE): { w: number; h: number } {
  return {
    w: Math.max(min, Number.isFinite(w) ? w : min),
    h: Math.max(min, Number.isFinite(h) ? h : min),
  };
}

/**
 * Map a client point into canvas-local coords (accounts for root scroll + zoom scale).
 * `rootRect` is getBoundingClientRect of the canvas root; sizes are in unscaled canvas units.
 */
export function clientToCanvasLocal(
  clientX: number,
  clientY: number,
  rootRect: { left: number; top: number },
  scrollLeft: number,
  scrollTop: number,
  zoom = 1
): { x: number; y: number } {
  const z = zoom > 0 ? zoom : 1;
  return {
    x: (clientX - rootRect.left + scrollLeft) / z,
    y: (clientY - rootRect.top + scrollTop) / z,
  };
}

/**
 * Map a DOM getBoundingClientRect into canvas-local x/y/w/h relative to the canvas root.
 */
export function measureRectToLocal(
  elRect: { left: number; top: number; width: number; height: number },
  rootRect: { left: number; top: number },
  scrollLeft: number,
  scrollTop: number,
  zoom = 1
): { x: number; y: number; w: number; h: number } {
  const z = zoom > 0 ? zoom : 1;
  return {
    x: (elRect.left - rootRect.left + scrollLeft) / z,
    y: (elRect.top - rootRect.top + scrollTop) / z,
    w: Math.max(1, elRect.width / z),
    h: Math.max(1, elRect.height / z),
  };
}

/**
 * Query live `[data-block-id]` boxes under root and merge with block lock/props.
 * Falls back to estimate-based readBlockRect when a node is missing (pre-layout).
 */
export function measureBlockRects(
  root: HTMLElement | null | undefined,
  blocks: Block[],
  opts?: { zoom?: number; live?: Record<string, LiveCanvasPos> }
): CanvasRect[] {
  const zoom = opts?.zoom ?? 1;
  const live = opts?.live || {};
  if (!root || typeof root.querySelectorAll !== "function") {
    return blocks.map((b, i) => {
      const r = readBlockRect(b, i);
      const l = live[b.id];
      return l ? { ...r, x: l.x, y: l.y, w: l.w ?? r.w, h: l.h ?? r.h } : r;
    });
  }
  const rootRect = root.getBoundingClientRect();
  const byId = new Map<string, { x: number; y: number; w: number; h: number }>();
  const nodes = root.querySelectorAll("[data-block-id]");
  nodes.forEach((node) => {
    const el = node as HTMLElement;
    const id = el.getAttribute("data-block-id");
    if (!id) return;
    const r = el.getBoundingClientRect();
    byId.set(
      id,
      measureRectToLocal(r, rootRect, root.scrollLeft, root.scrollTop, zoom)
    );
  });

  return blocks.map((b, i) => {
    const base = readBlockRect(b, i);
    const measured = byId.get(b.id);
    const l = live[b.id];
    const w = l?.w ?? measured?.w ?? base.w;
    const h = l?.h ?? measured?.h ?? base.h;
    const x = l?.x ?? measured?.x ?? base.x;
    const y = l?.y ?? measured?.y ?? base.y;
    return { id: b.id, x, y, w, h, locked: base.locked };
  });
}

/** Apply resize delta from an origin rect; opposite edge/corner stays anchored. */
export function applyResizeDelta(
  origin: { x: number; y: number; w: number; h: number },
  dx: number,
  dy: number,
  handle: ResizeHandle,
  min = CANVAS_MIN_SIZE
): { x: number; y: number; w: number; h: number } {
  const right = origin.x + origin.w;
  const bottom = origin.y + origin.h;
  let x = origin.x;
  let y = origin.y;
  let w = origin.w;
  let h = origin.h;

  if (handle === "e" || handle === "ne" || handle === "se") {
    w = origin.w + dx;
  }
  if (handle === "w" || handle === "nw" || handle === "sw") {
    w = origin.w - dx;
  }
  if (handle === "s" || handle === "se" || handle === "sw") {
    h = origin.h + dy;
  }
  if (handle === "n" || handle === "ne" || handle === "nw") {
    h = origin.h - dy;
  }

  const clamped = clampResizeSize(w, h, min);
  w = clamped.w;
  h = clamped.h;

  // Re-anchor opposite edge/corner after clamp.
  if (handle === "w" || handle === "nw" || handle === "sw") {
    x = right - w;
  } else {
    x = origin.x;
  }
  if (handle === "n" || handle === "ne" || handle === "nw") {
    y = bottom - h;
  } else {
    y = origin.y;
  }
  // Pure e/s keep top-left; corners already handled.
  if (handle === "e" || handle === "se" || handle === "ne") {
    x = origin.x;
  }
  if (handle === "s" || handle === "se" || handle === "sw") {
    y = origin.y;
  }

  return { x, y, w, h };
}

/**
 * Snap a resizing rect's moving edges to peers + grid.
 * Returns updated x/y/w/h and guides.
 */
export function snapResizeRect(
  moving: { x: number; y: number; w: number; h: number },
  peers: CanvasRect[],
  handle: ResizeHandle,
  opts?: { threshold?: number; grid?: number; disableSnap?: boolean; min?: number }
): { x: number; y: number; w: number; h: number; guides: GuideLine[] } {
  const threshold = opts?.threshold ?? CANVAS_SNAP_THRESHOLD;
  const grid = opts?.grid ?? CANVAS_GRID;
  const min = opts?.min ?? CANVAS_MIN_SIZE;
  if (opts?.disableSnap) {
    const c = clampResizeSize(moving.w, moving.h, min);
    const right = moving.x + moving.w;
    const bottom = moving.y + moving.h;
    let x = moving.x;
    let y = moving.y;
    const w = c.w;
    const h = c.h;
    if (handle === "w" || handle === "nw" || handle === "sw") x = right - w;
    if (handle === "n" || handle === "ne" || handle === "nw") y = bottom - h;
    return { x, y, w, h, guides: [] };
  }

  let x = moving.x;
  let y = moving.y;
  let w = moving.w;
  let h = moving.h;
  const guides: GuideLine[] = [];
  let bestDw = threshold + 1;
  let bestDh = threshold + 1;
  let guideV: number | null = null;
  let guideH: number | null = null;

  const moveRight = handle === "e" || handle === "ne" || handle === "se";
  const moveLeft = handle === "w" || handle === "nw" || handle === "sw";
  const moveBottom = handle === "s" || handle === "se" || handle === "sw";
  const moveTop = handle === "n" || handle === "ne" || handle === "nw";

  const right = x + w;
  const bottom = y + h;

  for (const peer of peers) {
    if (moveRight) {
      const targets = [peer.x, peer.x + peer.w / 2, peer.x + peer.w];
      for (const t of targets) {
        const d = Math.abs(right - t);
        if (d <= threshold && d < bestDw) {
          bestDw = d;
          w = t - x;
          guideV = t;
        }
      }
    }
    if (moveLeft) {
      const targets = [peer.x, peer.x + peer.w / 2, peer.x + peer.w];
      for (const t of targets) {
        const d = Math.abs(x - t);
        if (d <= threshold && d < bestDw) {
          bestDw = d;
          const newW = right - t;
          w = newW;
          x = t;
          guideV = t;
        }
      }
    }
    if (moveBottom) {
      const targets = [peer.y, peer.y + peer.h / 2, peer.y + peer.h];
      for (const t of targets) {
        const d = Math.abs(bottom - t);
        if (d <= threshold && d < bestDh) {
          bestDh = d;
          h = t - y;
          guideH = t;
        }
      }
    }
    if (moveTop) {
      const targets = [peer.y, peer.y + peer.h / 2, peer.y + peer.h];
      for (const t of targets) {
        const d = Math.abs(y - t);
        if (d <= threshold && d < bestDh) {
          bestDh = d;
          const newH = bottom - t;
          h = newH;
          y = t;
          guideH = t;
        }
      }
    }
  }

  if (moveRight && guideV == null) {
    const gr = snapToGrid(right, grid);
    if (Math.abs(gr - right) <= threshold) {
      w = gr - x;
      guideV = gr;
    }
  }
  if (moveLeft && guideV == null) {
    const gl = snapToGrid(x, grid);
    if (Math.abs(gl - x) <= threshold) {
      w = right - gl;
      x = gl;
      guideV = gl;
    }
  }
  if (moveBottom && guideH == null) {
    const gb = snapToGrid(bottom, grid);
    if (Math.abs(gb - bottom) <= threshold) {
      h = gb - y;
      guideH = gb;
    }
  }
  if (moveTop && guideH == null) {
    const gt = snapToGrid(y, grid);
    if (Math.abs(gt - y) <= threshold) {
      h = bottom - gt;
      y = gt;
      guideH = gt;
    }
  }

  const c = clampResizeSize(w, h, min);
  // Re-anchor after clamp
  const fixedRight = moveLeft ? right : x + w;
  const fixedBottom = moveTop ? bottom : y + h;
  w = c.w;
  h = c.h;
  if (moveLeft) x = fixedRight - w;
  if (moveTop) y = fixedBottom - h;
  if (guideV != null) guides.push({ orientation: "v", at: guideV });
  if (guideH != null) guides.push({ orientation: "h", at: guideH });
  return { x, y, w, h, guides };
}

/** Apply position + size patches onto blocks (immutable). */
export function applySizePatches(
  blocks: Block[],
  patches: { id: string; x?: number; y?: number; w?: number; h?: number }[]
): Block[] {
  const map = new Map(patches.map((p) => [p.id, p]));
  return blocks.map((b) => {
    const p = map.get(b.id);
    if (!p) return b;
    if (isLockedProp(b.props as Record<string, unknown>)) return b;
    const next: Record<string, unknown> = { ...b.props };
    if (p.x != null) next.posX = formatPos(p.x);
    if (p.y != null) next.posY = formatPos(p.y);
    if (p.w != null) next.width = formatPos(p.w);
    if (p.h != null) next.height = formatPos(p.h);
    return { ...b, props: next };
  });
}

/** All eight resize handles (opposite edge/corner stays anchored). */
export const RESIZE_HANDLES: ResizeHandle[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export function handleCursor(handle: ResizeHandle): string {
  switch (handle) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "nw":
    case "se":
    default:
      return "nwse-resize";
  }
}

/** Opposite anchor point for a handle on a rect (stays fixed while resizing). */
export function resizeAnchor(
  rect: { x: number; y: number; w: number; h: number },
  handle: ResizeHandle,
  aboutCenter = false
): { x: number; y: number } {
  if (aboutCenter) {
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  }
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  switch (handle) {
    case "e":
      return { x: rect.x, y: cy };
    case "w":
      return { x: right, y: cy };
    case "s":
      return { x: cx, y: rect.y };
    case "n":
      return { x: cx, y: bottom };
    case "se":
      return { x: rect.x, y: rect.y };
    case "sw":
      return { x: right, y: rect.y };
    case "ne":
      return { x: rect.x, y: bottom };
    case "nw":
      return { x: right, y: bottom };
    default:
      return { x: rect.x, y: rect.y };
  }
}

/** Union bounding box of rects (empty → 0 box). */
export function unionBounds(
  rects: { x: number; y: number; w: number; h: number }[]
): { x: number; y: number; w: number; h: number } {
  if (!rects.length) return { x: 0, y: 0, w: 0, h: 0 };
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxR = Math.max(...rects.map((r) => r.x + r.w));
  const maxB = Math.max(...rects.map((r) => r.y + r.h));
  return { x: minX, y: minY, w: maxR - minX, h: maxB - minY };
}

/**
 * Scale a set of origin rects about the opposite BB corner (or center).
 * Clamps so every member stays ≥ min×min by reducing sx/sy uniformly per axis.
 */
export function scaleGroupRects(
  origins: Record<string, { x: number; y: number; w: number; h: number }>,
  ids: string[],
  handle: ResizeHandle,
  dx: number,
  dy: number,
  opts?: { aboutCenter?: boolean; min?: number }
): { id: string; x: number; y: number; w: number; h: number }[] {
  const min = opts?.min ?? CANVAS_MIN_SIZE;
  const aboutCenter = Boolean(opts?.aboutCenter);
  const list = ids
    .map((id) => {
      const o = origins[id];
      return o ? { id, ...o } : null;
    })
    .filter(Boolean) as { id: string; x: number; y: number; w: number; h: number }[];
  if (!list.length) return [];

  const bounds = unionBounds(list);
  if (bounds.w < 1 || bounds.h < 1) {
    return list.map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h }));
  }

  // When aboutCenter, mirror the drag so both sides grow/shrink equally.
  const adjDx = aboutCenter ? dx * 2 : dx;
  const adjDy = aboutCenter ? dy * 2 : dy;
  const raw = applyResizeDelta(bounds, adjDx, adjDy, handle, 1);
  let sx = raw.w / bounds.w;
  let sy = raw.h / bounds.h;
  // Edge handles: only scale on that axis.
  if (handle === "e" || handle === "w") sy = 1;
  if (handle === "n" || handle === "s") sx = 1;

  // Clamp scales so no member drops below min.
  for (const r of list) {
    if (sx > 0 && r.w * sx < min) sx = min / r.w;
    if (sy > 0 && r.h * sy < min) sy = min / r.h;
  }
  sx = Math.max(0.01, sx);
  sy = Math.max(0.01, sy);

  const anchor = resizeAnchor(bounds, handle, aboutCenter);

  return list.map((r) => {
    const w = Math.max(min, r.w * sx);
    const h = Math.max(min, r.h * sy);
    // Map corners relative to anchor, then rebuild top-left from scaled size.
    const x0 = anchor.x + (r.x - anchor.x) * sx;
    const y0 = anchor.y + (r.y - anchor.y) * sy;
    // When clamping size up from tiny, keep the same top-left from scale map.
    return { id: r.id, x: x0, y: y0, w, h };
  });
}
