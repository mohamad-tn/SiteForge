"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  easeIdFromPoints,
  parseBezier,
  serializeBezier,
  type BezierPoints,
} from "@/lib/motion-timeline";
import { EASE_PRESETS, type EasePresetId } from "@/lib/block-style";

const PRESETS: { id: EasePresetId | "custom"; labelAr: string; labelEn: string }[] = [
  { id: "ease-out", labelAr: "خروج ناعم", labelEn: "Ease out" },
  { id: "soft", labelAr: "ناعم", labelEn: "Soft" },
  { id: "springy", labelAr: "مرن", labelEn: "Springy" },
  { id: "linear", labelAr: "خطي", labelEn: "Linear" },
  { id: "custom", labelAr: "مخصص", labelEn: "Custom" },
];

function pointsEqual(a: BezierPoints, b: BezierPoints): boolean {
  return a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2;
}

export function BezierEaseEditor({
  value,
  onChange,
  uiLang = "en",
}: {
  value: string;
  onChange: (ease: string) => void;
  uiLang?: "ar" | "en";
}) {
  const uid = useId();
  const points = useMemo(() => parseBezier(value), [value]);
  const [draft, setDraft] = useState(points);
  const [dragging, setDragging] = useState<"p1" | "p2" | null>(null);
  const [previewT, setPreviewT] = useState(0);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    setDraft(points);
  }, [points]);

  useEffect(() => {
    let raf = 0;
    let start = 0;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const t = ((ts - start) % 1600) / 1600;
      setPreviewT(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const W = 200;
  const H = 140;
  const pad = 16;
  const plotW = W - pad * 2;
  const plotH = H - pad * 2;

  const toSvg = useCallback(
    (x: number, y: number) => {
      // CSS bezier: (0,0) bottom-left → (1,1) top-right in our plot
      const sx = pad + x * plotW;
      const sy = pad + (1 - y) * plotH;
      return { sx, sy };
    },
    [plotW, plotH]
  );

  const fromSvg = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const el = svgRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const px = ((clientX - rect.left) / rect.width) * W;
      const py = ((clientY - rect.top) / rect.height) * H;
      const x = Math.min(1, Math.max(0, (px - pad) / plotW));
      const y = Math.min(2, Math.max(-0.5, 1 - (py - pad) / plotH));
      return { x, y };
    },
    [plotW, plotH]
  );

  function commit(next: BezierPoints) {
    setDraft(next);
    const named = easeIdFromPoints(next);
    onChange(named.startsWith("cubic-bezier") ? serializeBezier(next) : named);
  }

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: PointerEvent) {
      const { x, y } = fromSvg(e.clientX, e.clientY);
      setDraft((prev) => {
        const next =
          dragging === "p1"
            ? { ...prev, x1: x, y1: y }
            : { ...prev, x2: x, y2: y };
        return next;
      });
    }
    function onUp(e: PointerEvent) {
      const { x, y } = fromSvg(e.clientX, e.clientY);
      setDraft((prev) => {
        const n =
          dragging === "p1" ? { ...prev, x1: x, y1: y } : { ...prev, x2: x, y2: y };
        const named = easeIdFromPoints(n);
        onChange(named.startsWith("cubic-bezier") ? serializeBezier(n) : named);
        return n;
      });
      setDragging(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, draft, fromSvg, onChange]);

  const p0 = toSvg(0, 0);
  const p1 = toSvg(draft.x1, draft.y1);
  const p2 = toSvg(draft.x2, draft.y2);
  const p3 = toSvg(1, 1);

  // Approximate cubic at t for preview dot
  function cubic(t: number, a: number, b: number, c: number, d: number) {
    const mt = 1 - t;
    return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d;
  }
  const dotX = cubic(previewT, 0, draft.x1, draft.x2, 1);
  const dotY = cubic(previewT, 0, draft.y1, draft.y2, 1);
  const dot = toSvg(dotX, Math.min(1.2, Math.max(-0.2, dotY)));

  const activePreset = useMemo(() => {
    const id = easeIdFromPoints(draft);
    if (id in EASE_PRESETS) return id as EasePresetId;
    return "custom";
  }, [draft]);

  return (
    <div className="space-y-2 rounded-xl border border-stone-300/80 bg-stone-50/70 p-2.5 dark:border-stone-700 dark:bg-stone-950/40">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              activePreset === p.id
                ? "bg-teal-800 text-white"
                : "bg-white text-stone-700 ring-1 ring-stone-300/80 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700"
            }`}
            onClick={() => {
              if (p.id === "custom") {
                onChange(serializeBezier(draft));
                return;
              }
              const css = EASE_PRESETS[p.id as Exclude<EasePresetId, "custom">];
              onChange(p.id);
              setDraft(parseBezier(css));
            }}
          >
            {uiLang === "ar" ? p.labelAr : p.labelEn}
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-36 w-full touch-none rounded-lg bg-[var(--card)] dark:bg-stone-900"
        role="img"
        aria-label={uiLang === "ar" ? "محرر منحنى الحركة" : "Bezier ease editor"}
      >
        <rect x={pad} y={pad} width={plotW} height={plotH} fill="none" stroke="currentColor" strokeOpacity={0.15} />
        <line x1={p0.sx} y1={p0.sy} x2={p1.sx} y2={p1.sy} stroke="var(--primary, #0d9488)" strokeOpacity={0.45} />
        <line x1={p3.sx} y1={p3.sy} x2={p2.sx} y2={p2.sy} stroke="var(--primary, #0d9488)" strokeOpacity={0.45} />
        <path
          d={`M ${p0.sx} ${p0.sy} C ${p1.sx} ${p1.sy}, ${p2.sx} ${p2.sy}, ${p3.sx} ${p3.sy}`}
          fill="none"
          stroke="var(--primary, #0d9488)"
          strokeWidth={2.5}
        />
        <circle cx={dot.sx} cy={dot.sy} r={4} fill="var(--foreground, #1c1917)" className="dark:fill-stone-100" />
        <circle
          cx={p1.sx}
          cy={p1.sy}
          r={7}
          fill="var(--primary, #0d9488)"
          className="cursor-grab"
          onPointerDown={(e) => {
            e.preventDefault();
            (e.target as Element).setPointerCapture?.(e.pointerId);
            setDragging("p1");
          }}
        />
        <circle
          cx={p2.sx}
          cy={p2.sy}
          r={7}
          fill="var(--primary, #0d9488)"
          className="cursor-grab"
          onPointerDown={(e) => {
            e.preventDefault();
            (e.target as Element).setPointerCapture?.(e.pointerId);
            setDragging("p2");
          }}
        />
      </svg>

      <div className="grid grid-cols-4 gap-1.5" dir="ltr">
        {(
          [
            ["x1", draft.x1],
            ["y1", draft.y1],
            ["x2", draft.x2],
            ["y2", draft.y2],
          ] as const
        ).map(([key, val]) => (
          <label key={key} className="space-y-0.5" htmlFor={`${uid}-${key}`}>
            <span className="block text-[9px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
              {key}
            </span>
            <input
              id={`${uid}-${key}`}
              type="number"
              step={0.01}
              min={key.startsWith("x") ? 0 : -0.5}
              max={key.startsWith("x") ? 1 : 2}
              value={Number(val.toFixed(3))}
              className="h-8 w-full rounded-lg border border-stone-300/80 bg-white px-1.5 font-mono text-[11px] text-[var(--foreground)] dark:border-stone-700 dark:bg-stone-950"
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                const next = { ...draft, [key]: n };
                if (!pointsEqual(next, draft)) commit(next);
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
