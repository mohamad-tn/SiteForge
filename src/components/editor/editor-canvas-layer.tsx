"use client";

/**
 * Figma-like canvas interaction overlay: drag, marquee, snap guides.
 * Pure visual + pointer plumbing — commits positions via onCommitPositions.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Block } from "@/lib/design";
import {
  applyPositions,
  formatPos,
  marqueeHitTest,
  normalizeMarquee,
  pageUsesCanvas,
  readBlockRect,
  snapRect,
  type CanvasRect,
  type GuideLine,
} from "@/lib/editor-canvas";
import { isLockedProp } from "@/lib/editor-selection";

type DragState = {
  mode: "drag" | "marquee";
  pointerId: number;
  startX: number;
  startY: number;
  /** Canvas-local coords at pointer-down. */
  originLocal: { x: number; y: number };
  /** Block ids being dragged (unlocked). */
  movingIds: string[];
  /** Starting rects for movers. */
  origins: Record<string, { x: number; y: number; w: number; h: number }>;
  additive: boolean;
  disableSnap: boolean;
};

function isInteractiveTarget(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;
  return Boolean(
    el.closest(
      "input, textarea, select, button, a, [contenteditable=true], [data-sf-no-drag]"
    )
  );
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
  children,
}: {
  enabled: boolean;
  blocks: Block[];
  selectedIds: string[];
  rootRef: React.RefObject<HTMLDivElement | null>;
  onSelectIds: (ids: string[], opts?: { additive?: boolean; primary?: string | null }) => void;
  onCommitPositions: (blocks: Block[]) => void;
  livePositions: Record<string, { x: number; y: number }>;
  setLivePositions: (v: Record<string, { x: number; y: number }>) => void;
  guides: GuideLine[];
  setGuides: (g: GuideLine[]) => void;
  children: React.ReactNode;
}) {
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const rafRef = useRef(0);
  const pendingLive = useRef<Record<string, { x: number; y: number }> | null>(null);
  const pendingGuides = useRef<GuideLine[]>([]);

  const localPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return { x: clientX - r.left + el.scrollLeft, y: clientY - r.top + el.scrollTop };
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
    (next: Record<string, { x: number; y: number }>, g: GuideLine[]) => {
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

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.button !== 0) return;
      const root = rootRef.current;
      if (!root) return;
      const target = e.target as Element;
      if (!root.contains(target)) return;

      const blockEl = target.closest("[data-block-id]") as HTMLElement | null;
      const local = localPoint(e.clientX, e.clientY);
      const disableSnap = e.altKey;

      if (blockEl && !isInteractiveTarget(target)) {
        const id = blockEl.getAttribute("data-block-id");
        if (!id) return;
        const block = blocks.find((b) => b.id === id);
        if (!block) return;
        if (isLockedProp(block.props as Record<string, unknown>)) {
          // still allow select
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

        const origins: DragState["origins"] = {};
        for (const mid of movingIds) {
          const b = blocks.find((x) => x.id === mid);
          if (!b) continue;
          const live = livePositions[mid];
          const r = readBlockRect(b);
          origins[mid] = {
            x: live?.x ?? r.x,
            y: live?.y ?? r.y,
            w: r.w,
            h: r.h,
          };
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

      // Empty canvas → marquee (ignore clicks on interactive chrome inside blocks already handled)
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
    [blocks, enabled, livePositions, localPoint, onSelectIds, rootRef, selectedIds]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const local = localPoint(e.clientX, e.clientY);

      if (d.mode === "marquee") {
        setMarquee(normalizeMarquee(d.originLocal.x, d.originLocal.y, local.x, local.y));
        return;
      }

      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      d.disableSnap = e.altKey;

      const peers: CanvasRect[] = blocks
        .filter((b) => !d.movingIds.includes(b.id))
        .map((b, i) => {
          const live = livePositions[b.id];
          const r = readBlockRect(b, i);
          return live ? { ...r, x: live.x, y: live.y } : r;
        });

      // Snap using the primary (first) mover's rect, then apply same delta to all.
      const primaryId = d.movingIds[0];
      const origin = d.origins[primaryId];
      if (!origin) return;
      const raw = { x: origin.x + dx, y: origin.y + dy, w: origin.w, h: origin.h };
      const snapped = snapRect(raw, peers, { disableSnap: d.disableSnap });
      const sdx = snapped.x - origin.x;
      const sdy = snapped.y - origin.y;

      const next: Record<string, { x: number; y: number }> = {};
      for (const mid of d.movingIds) {
        const o = d.origins[mid];
        if (!o) continue;
        next[mid] = { x: o.x + sdx, y: o.y + sdy };
      }
      scheduleLive(next, snapped.guides);
    },
    [blocks, livePositions, localPoint, scheduleLive]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      dragRef.current = null;

      if (d.mode === "marquee") {
        const local = localPoint(e.clientX, e.clientY);
        const box = normalizeMarquee(d.originLocal.x, d.originLocal.y, local.x, local.y);
        setMarquee(null);
        const rects = blocks.map((b, i) => readBlockRect(b, i));
        const hits = marqueeHitTest(box, rects);
        if (hits.length) {
          onSelectIds(d.additive ? [...new Set([...selectedIds, ...hits])] : hits, {
            additive: d.additive,
          });
        }
        return;
      }

      // Commit drag
      const finalLive = pendingLive.current || livePositions;
      pendingLive.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
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
    [blocks, livePositions, localPoint, onCommitPositions, onSelectIds, selectedIds, setGuides, setLivePositions]
  );

  if (!enabled) return <>{children}</>;

  return (
    <div
      className="relative"
      data-sf-canvas-layer=""
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {children}
      {marquee && marquee.w + marquee.h > 0 ? (
        <div
          className="pointer-events-none absolute z-50 border border-teal-600/80 bg-teal-500/10"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      ) : null}
      {guides.map((g, i) =>
        g.orientation === "v" ? (
          <div
            key={`v-${i}-${g.at}`}
            className="pointer-events-none absolute z-50 w-px bg-teal-500"
            style={{ left: g.at, top: 0, bottom: 0 }}
          />
        ) : (
          <div
            key={`h-${i}-${g.at}`}
            className="pointer-events-none absolute z-50 h-px bg-teal-500"
            style={{ top: g.at, left: 0, right: 0 }}
          />
        )
      )}
    </div>
  );
}

export function mergeLivePositions(
  blocks: Block[],
  live: Record<string, { x: number; y: number }>
): Block[] {
  if (!Object.keys(live).length) return blocks;
  return blocks.map((b) => {
    const p = live[b.id];
    if (!p) return b;
    return {
      ...b,
      props: { ...b.props, posX: formatPos(p.x), posY: formatPos(p.y) },
    };
  });
}

export { pageUsesCanvas };
