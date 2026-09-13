"use client";

/**
 * Figma-like canvas interaction overlay: drag, marquee, snap guides, resize, zoom/pan.
 * Pure visual + pointer plumbing — commits via onCommitPositions / onCommitBlocks.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Block } from "@/lib/design";
import {
  applyPositions,
  applySizePatches,
  applyResizeDelta,
  clientToCanvasLocal,
  formatPos,
  marqueeHitTest,
  measureBlockRects,
  normalizeMarquee,
  pageUsesCanvas,
  readBlockRect,
  snapRect,
  snapResizeRect,
  type CanvasRect,
  type GuideLine,
  type LiveCanvasPos,
  type ResizeHandle,
} from "@/lib/editor-canvas";
import { isLockedProp } from "@/lib/editor-selection";

type DragState =
  | {
      mode: "drag" | "marquee" | "pan";
      pointerId: number;
      startX: number;
      startY: number;
      originLocal: { x: number; y: number };
      movingIds: string[];
      origins: Record<string, { x: number; y: number; w: number; h: number }>;
      additive: boolean;
      disableSnap: boolean;
      panOrigin?: { scrollLeft: number; scrollTop: number; el: HTMLElement };
    }
  | {
      mode: "resize";
      pointerId: number;
      startX: number;
      startY: number;
      originLocal: { x: number; y: number };
      movingIds: string[];
      origins: Record<string, { x: number; y: number; w: number; h: number }>;
      additive: boolean;
      disableSnap: boolean;
      handle: ResizeHandle;
      blockId: string;
    };

function isInteractiveTarget(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;
  return Boolean(
    el.closest(
      "input, textarea, select, button, a, [contenteditable=true], [data-sf-no-drag], [data-sf-resize-handle]"
    )
  );
}

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let cur: HTMLElement | null = el;
  while (cur) {
    const style = window.getComputedStyle(cur);
    const oy = style.overflowY;
    if ((oy === "auto" || oy === "scroll" || style.overflow === "auto") && cur.scrollHeight > cur.clientHeight + 2) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return el;
}

export function EditorCanvasLayer({
  enabled,
  blocks,
  selectedIds,
  rootRef,
  onSelectIds,
  onCommitPositions,
  livePositions,
  setLivePositions,
  guides,
  setGuides,
  zoom = 1,
  onZoomChange,
  children,
}: {
  enabled: boolean;
  blocks: Block[];
  selectedIds: string[];
  rootRef: React.RefObject<HTMLDivElement | null>;
  onSelectIds: (ids: string[], opts?: { additive?: boolean; primary?: string | null }) => void;
  onCommitPositions: (blocks: Block[]) => void;
  livePositions: Record<string, LiveCanvasPos>;
  setLivePositions: (v: Record<string, LiveCanvasPos>) => void;
  guides: GuideLine[];
  setGuides: (g: GuideLine[]) => void;
  zoom?: number;
  onZoomChange?: (z: number) => void;
  children: React.ReactNode;
}) {
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [measured, setMeasured] = useState<CanvasRect[]>([]);
  const [spaceDown, setSpaceDown] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const rafRef = useRef(0);
  const pendingLive = useRef<Record<string, LiveCanvasPos> | null>(null);
  const pendingGuides = useRef<GuideLine[]>([]);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const refreshMeasured = useCallback(() => {
    const root = rootRef.current;
    const rects = measureBlockRects(root, blocks, { zoom: zoomRef.current, live: livePositions });
    setMeasured(rects);
  }, [blocks, livePositions, rootRef]);

  useLayoutEffect(() => {
    if (!enabled) return;
    refreshMeasured();
  }, [enabled, refreshMeasured, blocks, selectedIds, zoom]);

  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => refreshMeasured());
    ro.observe(root);
    root.querySelectorAll("[data-block-id]").forEach((n) => ro.observe(n));
    return () => ro.disconnect();
  }, [enabled, blocks, refreshMeasured, rootRef, zoom]);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setSpaceDown(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [enabled]);

  const localPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return clientToCanvasLocal(clientX, clientY, r, el.scrollLeft, el.scrollTop, zoomRef.current);
    },
    [rootRef]
  );

  const flushRaf = useCallback(() => {
    rafRef.current = 0;
    if (pendingLive.current) {
      setLivePositions(pendingLive.current);
      pendingLive.current = null;
    }
    setGuides(pendingGuides.current);
  }, [setGuides, setLivePositions]);

  const scheduleLive = useCallback(
    (next: Record<string, LiveCanvasPos>, g: GuideLine[]) => {
      pendingLive.current = next;
      pendingGuides.current = g;
      if (!rafRef.current) rafRef.current = requestAnimationFrame(flushRaf);
    },
    [flushRaf]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const rectFor = useCallback(
    (id: string, fallbackIndex = 0): CanvasRect => {
      const fromMeasured = measured.find((r) => r.id === id);
      if (fromMeasured) {
        const live = livePositions[id];
        return live
          ? { ...fromMeasured, x: live.x, y: live.y, w: live.w ?? fromMeasured.w, h: live.h ?? fromMeasured.h }
          : fromMeasured;
      }
      const b = blocks.find((x) => x.id === id);
      if (!b) return { id, x: 0, y: 0, w: 40, h: 40 };
      const r = readBlockRect(b, fallbackIndex);
      const live = livePositions[id];
      return live ? { ...r, x: live.x, y: live.y, w: live.w ?? r.w, h: live.h ?? r.h } : r;
    },
    [blocks, livePositions, measured]
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!enabled || !onZoomChange) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.25 : 0.25;
      onZoomChange(zoomRef.current + delta);
    },
    [enabled, onZoomChange]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      const root = rootRef.current;
      if (!root) return;
      const target = e.target as Element;
      if (!root.contains(target) && !(e.currentTarget as HTMLElement).contains(target)) return;

      const local = localPoint(e.clientX, e.clientY);
      const disableSnap = e.altKey;

      // Middle-mouse or Space+drag → pan the scrollable editor chrome (not public site)
      if (e.button === 1 || (e.button === 0 && spaceDown)) {
        dragRef.current = {
          mode: "pan",
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          originLocal: local,
          movingIds: [],
          origins: {},
          additive: false,
          disableSnap,
          panOrigin: (() => {
            const scroller = findScrollParent(root) || root;
            return { scrollLeft: scroller.scrollLeft, scrollTop: scroller.scrollTop, el: scroller };
          })(),
        };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        e.preventDefault();
        return;
      }

      if (e.button !== 0) return;

      const resizeEl = target.closest("[data-sf-resize-handle]") as HTMLElement | null;
      if (resizeEl) {
        const id = resizeEl.getAttribute("data-block-id");
        const handle = resizeEl.getAttribute("data-sf-resize-handle") as ResizeHandle | null;
        if (!id || !handle) return;
        const block = blocks.find((b) => b.id === id);
        if (!block || isLockedProp(block.props as Record<string, unknown>)) return;
        const r = rectFor(id);
        dragRef.current = {
          mode: "resize",
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          originLocal: local,
          movingIds: [id],
          origins: { [id]: { x: r.x, y: r.y, w: r.w, h: r.h } },
          additive: false,
          disableSnap,
          handle,
          blockId: id,
        };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const blockEl = target.closest("[data-block-id]") as HTMLElement | null;

      if (blockEl && !isInteractiveTarget(target)) {
        const id = blockEl.getAttribute("data-block-id");
        if (!id) return;
        const block = blocks.find((b) => b.id === id);
        if (!block) return;
        if (isLockedProp(block.props as Record<string, unknown>)) {
          return;
        }

        let movingIds = selectedIds.includes(id) ? [...selectedIds] : [id];
        movingIds = movingIds.filter((mid) => {
          const b = blocks.find((x) => x.id === mid);
          return b && !isLockedProp(b.props as Record<string, unknown>);
        });
        if (!movingIds.includes(id)) movingIds = [id];

        if (!selectedIds.includes(id)) {
          onSelectIds(e.shiftKey ? [...new Set([...selectedIds, id])] : [id], {
            additive: e.shiftKey,
            primary: id,
          });
        }

        const origins: Record<string, { x: number; y: number; w: number; h: number }> = {};
        for (const mid of movingIds) {
          const r = rectFor(mid);
          origins[mid] = { x: r.x, y: r.y, w: r.w, h: r.h };
        }

        dragRef.current = {
          mode: "drag",
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          originLocal: local,
          movingIds,
          origins,
          additive: e.shiftKey,
          disableSnap,
        };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        e.preventDefault();
        return;
      }

      if (!blockEl) {
        dragRef.current = {
          mode: "marquee",
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          originLocal: local,
          movingIds: [],
          origins: {},
          additive: e.shiftKey,
          disableSnap,
        };
        setMarquee({ x: local.x, y: local.y, w: 0, h: 0 });
        if (!e.shiftKey) onSelectIds([]);
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        e.preventDefault();
      }
    },
    [blocks, enabled, localPoint, onSelectIds, rectFor, rootRef, selectedIds, spaceDown]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const local = localPoint(e.clientX, e.clientY);
      const z = zoomRef.current || 1;

      if (d.mode === "pan" && d.panOrigin) {
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        d.panOrigin.el.scrollLeft = d.panOrigin.scrollLeft - dx;
        d.panOrigin.el.scrollTop = d.panOrigin.scrollTop - dy;
        return;
      }

      if (d.mode === "marquee") {
        setMarquee(normalizeMarquee(d.originLocal.x, d.originLocal.y, local.x, local.y));
        return;
      }

      d.disableSnap = e.altKey;
      const dx = (e.clientX - d.startX) / z;
      const dy = (e.clientY - d.startY) / z;

      if (d.mode === "resize") {
        const origin = d.origins[d.blockId];
        if (!origin) return;
        const raw = applyResizeDelta(origin, dx, dy, d.handle);
        const peers: CanvasRect[] = (measured.length ? measured : blocks.map((b, i) => readBlockRect(b, i))).filter(
          (r) => r.id !== d.blockId
        );
        const snapped = snapResizeRect(raw, peers, d.handle, { disableSnap: d.disableSnap });
        scheduleLive(
          {
            [d.blockId]: { x: snapped.x, y: snapped.y, w: snapped.w, h: snapped.h },
          },
          snapped.guides
        );
        return;
      }

      // drag
      const peers: CanvasRect[] = (measured.length ? measured : blocks.map((b, i) => readBlockRect(b, i)))
        .filter((b) => !d.movingIds.includes(b.id))
        .map((r) => {
          const live = livePositions[r.id];
          return live ? { ...r, x: live.x, y: live.y, w: live.w ?? r.w, h: live.h ?? r.h } : r;
        });

      const primaryId = d.movingIds[0];
      const origin = d.origins[primaryId];
      if (!origin) return;
      const raw = { x: origin.x + dx, y: origin.y + dy, w: origin.w, h: origin.h };
      const snapped = snapRect(raw, peers, { disableSnap: d.disableSnap });
      const sdx = snapped.x - origin.x;
      const sdy = snapped.y - origin.y;

      const next: Record<string, LiveCanvasPos> = {};
      for (const mid of d.movingIds) {
        const o = d.origins[mid];
        if (!o) continue;
        next[mid] = { x: o.x + sdx, y: o.y + sdy, w: o.w, h: o.h };
      }
      scheduleLive(next, snapped.guides);
    },
    [blocks, livePositions, localPoint, measured, scheduleLive]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      dragRef.current = null;

      if (d.mode === "pan") {
        return;
      }

      if (d.mode === "marquee") {
        const local = localPoint(e.clientX, e.clientY);
        const box = normalizeMarquee(d.originLocal.x, d.originLocal.y, local.x, local.y);
        setMarquee(null);
        const rects =
          measured.length > 0
            ? measured
            : blocks.map((b, i) => readBlockRect(b, i));
        const hits = marqueeHitTest(box, rects);
        if (hits.length) {
          onSelectIds(d.additive ? [...new Set([...selectedIds, ...hits])] : hits, {
            additive: d.additive,
          });
        }
        return;
      }

      const finalLive = pendingLive.current || livePositions;
      pendingLive.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }

      if (d.mode === "resize") {
        const p = finalLive[d.blockId] || d.origins[d.blockId];
        setLivePositions({});
        setGuides([]);
        if (p) {
          onCommitPositions(
            applySizePatches(blocks, [{ id: d.blockId, x: p.x, y: p.y, w: p.w, h: p.h }])
          );
        }
        return;
      }

      const patches = d.movingIds
        .map((id) => {
          const p = finalLive[id] || d.origins[id];
          if (!p) return null;
          return { id, x: p.x, y: p.y };
        })
        .filter(Boolean) as { id: string; x: number; y: number }[];

      setLivePositions({});
      setGuides([]);
      if (patches.length) {
        onCommitPositions(applyPositions(blocks, patches));
      }
    },
    [blocks, livePositions, localPoint, measured, onCommitPositions, onSelectIds, selectedIds, setGuides, setLivePositions]
  );

  if (!enabled) return <>{children}</>;

  const primarySelected = selectedIds[0];
  const primaryRect =
    primarySelected && !blocks.find((b) => b.id === primarySelected && isLockedProp(b.props as Record<string, unknown>))
      ? rectFor(primarySelected)
      : null;
  const primaryLocked = primarySelected
    ? isLockedProp((blocks.find((b) => b.id === primarySelected)?.props || {}) as Record<string, unknown>)
    : true;

  return (
    <div
      className="relative"
      data-sf-canvas-layer=""
      style={{
        cursor: spaceDown ? "grab" : undefined,
        transform: zoom !== 1 ? `scale(${zoom})` : undefined,
        transformOrigin: "top left",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      {children}
      {marquee && marquee.w + marquee.h > 0 ? (
        <div
          className="pointer-events-none absolute z-50 border-2 border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      ) : null}
      {guides.map((g, i) =>
        g.orientation === "v" ? (
          <div
            key={`v-${i}-${g.at}`}
            className="pointer-events-none absolute z-50 w-px bg-[var(--accent)]"
            style={{ left: g.at, top: 0, bottom: 0 }}
          />
        ) : (
          <div
            key={`h-${i}-${g.at}`}
            className="pointer-events-none absolute z-50 h-px bg-[var(--accent)]"
            style={{ top: g.at, left: 0, right: 0 }}
          />
        )
      )}
      {/* Selection outline + resize handles (token-colored, visible in light mode) */}
      {primaryRect && primarySelected && !primaryLocked ? (
        <div
          className="pointer-events-none absolute z-[45] border-2 border-[var(--accent)] shadow-[0_0_0_1px_color-mix(in_oklab,var(--card)_80%,transparent)]"
          style={{
            left: primaryRect.x,
            top: primaryRect.y,
            width: primaryRect.w,
            height: primaryRect.h,
          }}
          data-sf-selection-outline=""
        >
          {(["e", "s", "se"] as ResizeHandle[]).map((handle) => {
            const style: React.CSSProperties =
              handle === "e"
                ? { right: -5, top: "50%", marginTop: -5, cursor: "ew-resize" }
                : handle === "s"
                  ? { bottom: -5, left: "50%", marginLeft: -5, cursor: "ns-resize" }
                  : { right: -5, bottom: -5, cursor: "nwse-resize" };
            return (
              <div
                key={handle}
                data-sf-resize-handle={handle}
                data-block-id={primarySelected}
                data-sf-no-drag=""
                className="pointer-events-auto absolute h-2.5 w-2.5 rounded-sm border-2 border-[var(--accent)] bg-[var(--card)]"
                style={style}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function mergeLivePositions(
  blocks: Block[],
  live: Record<string, LiveCanvasPos>
): Block[] {
  if (!Object.keys(live).length) return blocks;
  return blocks.map((b) => {
    const p = live[b.id];
    if (!p) return b;
    return {
      ...b,
      props: {
        ...b.props,
        posX: formatPos(p.x),
        posY: formatPos(p.y),
        ...(p.w != null ? { width: formatPos(p.w) } : {}),
        ...(p.h != null ? { height: formatPos(p.h) } : {}),
      },
    };
  });
}

export { pageUsesCanvas };
