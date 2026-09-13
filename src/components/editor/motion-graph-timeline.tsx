"use client";

import { useMemo, useRef, useState } from "react";
import type { MotionKeyframe, MotionTimelineStep } from "@/lib/motion-timeline";
import { clampKeyframeT, normalizeKeyframes } from "@/lib/motion-timeline";

const PX_PER_MS = 0.12;
const MIN_MS = 2000;

export function MotionGraphTimeline({
  steps,
  selectedStepId,
  onSelectStep,
  onChangeDelay,
  onChangeKeyframes,
  onSelectKeyframe,
  selectedKeyframeT,
  uiLang = "en",
}: {
  steps: MotionTimelineStep[];
  selectedStepId: string | null;
  onSelectStep: (id: string) => void;
  onChangeDelay: (id: string, delayMs: number) => void;
  onChangeKeyframes?: (id: string, keys: MotionKeyframe[]) => void;
  onSelectKeyframe?: (stepId: string, t: number) => void;
  selectedKeyframeT?: number | null;
  uiLang?: "ar" | "en";
}) {
  const maxEnd = useMemo(() => {
    let m = MIN_MS;
    for (const s of steps) m = Math.max(m, s.delayMs + s.durationMs + 200);
    return Math.max(MIN_MS, Math.ceil(m / 500) * 500);
  }, [steps]);

  const width = maxEnd * PX_PER_MS;
  const dragRef = useRef<
    | { kind: "bar"; id: string; startX: number; startDelay: number }
    | { kind: "key"; id: string; index: number; startX: number; startT: number }
    | null
  >(null);
  const [liveDelay, setLiveDelay] = useState<Record<string, number>>({});
  const [liveKeys, setLiveKeys] = useState<Record<string, MotionKeyframe[]>>({});
  const liveDelayRef = useRef(liveDelay);
  liveDelayRef.current = liveDelay;
  const liveKeysRef = useRef(liveKeys);
  liveKeysRef.current = liveKeys;

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= maxEnd; t += 500) out.push(t);
    return out;
  }, [maxEnd]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
        <span>{uiLang === "ar" ? "رسم زمني" : "Graph"}</span>
        <span className="font-mono normal-case tracking-normal text-[var(--foreground)]" dir="ltr">
          0–{(maxEnd / 1000).toFixed(1)}s
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-2">
        <div className="relative" style={{ width: Math.max(width, 240), minHeight: 8 + steps.length * 36 }}>
          <div className="relative mb-1 h-4 border-b border-[var(--border)]" dir="ltr">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute top-0 -translate-x-1/2 font-mono text-[9px] text-[var(--muted)]"
                style={{ left: t * PX_PER_MS }}
              >
                {t === 0 ? "0" : `${t / 1000}s`}
              </span>
            ))}
          </div>
          {steps.map((step, i) => {
            const delay = liveDelay[step.id] ?? step.delayMs;
            const left = delay * PX_PER_MS;
            const w = Math.max(12, step.durationMs * PX_PER_MS);
            const selected = selectedStepId === step.id;
            const keys = liveKeys[step.id] ?? normalizeKeyframes(step.keyframes) ?? [];
            return (
              <div key={step.id} className="relative mb-2 h-8" dir="ltr">
                <button
                  type="button"
                  title={`${step.trigger} · ${step.anim}`}
                  className={`absolute top-1 h-6 cursor-grab rounded-md px-1.5 text-[9px] font-bold text-white shadow-sm active:cursor-grabbing ${
                    selected ? "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--card)]" : ""
                  }`}
                  style={{
                    left,
                    width: w,
                    background:
                      step.trigger === "scroll"
                        ? "var(--accent)"
                        : step.trigger === "hover"
                          ? "#b45309"
                          : "#134e4a",
                  }}
                  onClick={() => onSelectStep(step.id)}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectStep(step.id);
                    dragRef.current = { kind: "bar", id: step.id, startX: e.clientX, startDelay: delay };
                    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const d = dragRef.current;
                    if (!d || d.kind !== "bar" || d.id !== step.id) return;
                    const dx = e.clientX - d.startX;
                    const next = Math.max(0, Math.min(5000, Math.round(d.startDelay + dx / PX_PER_MS)));
                    setLiveDelay((prev) => ({ ...prev, [step.id]: next }));
                  }}
                  onPointerUp={() => {
                    const d = dragRef.current;
                    if (!d || d.kind !== "bar" || d.id !== step.id) return;
                    const next = liveDelayRef.current[step.id] ?? d.startDelay;
                    dragRef.current = null;
                    setLiveDelay((prev) => {
                      const copy = { ...prev };
                      delete copy[step.id];
                      return copy;
                    });
                    onChangeDelay(step.id, next);
                  }}
                >
                  {i + 1}
                </button>
                {/* Keyframe diamonds along the bar */}
                {keys.map((k, ki) => {
                  const kx = left + clampKeyframeT(k.t) * w;
                  const isSel =
                    selected &&
                    selectedKeyframeT != null &&
                    Math.abs(selectedKeyframeT - k.t) < 0.001;
                  return (
                    <button
                      key={`${step.id}-k-${ki}`}
                      type="button"
                      title={`t=${k.t.toFixed(2)}`}
                      className={`absolute top-0 z-10 h-3 w-3 -translate-x-1/2 rotate-45 border-2 border-[var(--accent)] ${
                        isSel ? "bg-[var(--accent)]" : "bg-[var(--card)]"
                      }`}
                      style={{ left: kx }}
                      data-sf-no-drag=""
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStep(step.id);
                        onSelectKeyframe?.(step.id, k.t);
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectStep(step.id);
                        onSelectKeyframe?.(step.id, k.t);
                        dragRef.current = {
                          kind: "key",
                          id: step.id,
                          index: ki,
                          startX: e.clientX,
                          startT: k.t,
                        };
                        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                      }}
                      onPointerMove={(e) => {
                        const d = dragRef.current;
                        if (!d || d.kind !== "key" || d.id !== step.id || d.index !== ki) return;
                        const dx = e.clientX - d.startX;
                        const dt = w > 0 ? dx / w : 0;
                        const nextT = clampKeyframeT(d.startT + dt);
                        const base = liveKeysRef.current[step.id] ?? normalizeKeyframes(step.keyframes) ?? keys;
                        const next = base.map((kk, j) => (j === ki ? { ...kk, t: nextT } : kk));
                        setLiveKeys((prev) => ({ ...prev, [step.id]: next }));
                      }}
                      onPointerUp={() => {
                        const d = dragRef.current;
                        if (!d || d.kind !== "key" || d.id !== step.id || d.index !== ki) return;
                        const next = liveKeysRef.current[step.id];
                        dragRef.current = null;
                        setLiveKeys((prev) => {
                          const copy = { ...prev };
                          delete copy[step.id];
                          return copy;
                        });
                        if (next && onChangeKeyframes) onChangeKeyframes(step.id, next);
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[10px] leading-4 text-[var(--muted)]">
        {uiLang === "ar"
          ? "اسحب الشريط للتأخير · المعينات = إطارات مفتاحية"
          : "Drag bar for delay · diamonds = keyframes"}
      </p>
    </div>
  );
}
