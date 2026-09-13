"use client";

import { useMemo, useRef, useState } from "react";
import type { MotionTimelineStep } from "@/lib/motion-timeline";

const PX_PER_MS = 0.12;
const MIN_MS = 2000;

export function MotionGraphTimeline({
  steps,
  selectedStepId,
  onSelectStep,
  onChangeDelay,
  uiLang = "en",
}: {
  steps: MotionTimelineStep[];
  selectedStepId: string | null;
  onSelectStep: (id: string) => void;
  onChangeDelay: (id: string, delayMs: number) => void;
  uiLang?: "ar" | "en";
}) {
  const maxEnd = useMemo(() => {
    let m = MIN_MS;
    for (const s of steps) m = Math.max(m, s.delayMs + s.durationMs + 200);
    return Math.max(MIN_MS, Math.ceil(m / 500) * 500);
  }, [steps]);

  const width = maxEnd * PX_PER_MS;
  const dragRef = useRef<{ id: string; startX: number; startDelay: number } | null>(null);
  const [liveDelay, setLiveDelay] = useState<Record<string, number>>({});
  const liveDelayRef = useRef(liveDelay);
  liveDelayRef.current = liveDelay;

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= maxEnd; t += 500) out.push(t);
    return out;
  }, [maxEnd]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-stone-600 dark:text-stone-400">
        <span>{uiLang === "ar" ? "رسم زمني" : "Graph"}</span>
        <span className="font-mono normal-case tracking-normal" dir="ltr">
          0–{(maxEnd / 1000).toFixed(1)}s
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-stone-300/80 bg-white/80 p-2 dark:border-stone-700 dark:bg-stone-950/50">
        <div className="relative" style={{ width: Math.max(width, 240), minHeight: 8 + steps.length * 28 }}>
          {/* ruler */}
          <div className="relative mb-1 h-4 border-b border-stone-200 dark:border-stone-800" dir="ltr">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute top-0 -translate-x-1/2 font-mono text-[9px] text-stone-500"
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
            return (
              <div key={step.id} className="relative mb-1.5 h-6" dir="ltr">
                <button
                  type="button"
                  title={`${step.trigger} · ${step.anim}`}
                  className={`absolute top-0 h-6 cursor-grab rounded-md px-1.5 text-[9px] font-bold text-white shadow-sm active:cursor-grabbing ${
                    selected ? "ring-2 ring-teal-400 ring-offset-1" : ""
                  }`}
                  style={{
                    left,
                    width: w,
                    background:
                      step.trigger === "scroll"
                        ? "#0f766e"
                        : step.trigger === "hover"
                          ? "#b45309"
                          : "#134e4a",
                  }}
                  onClick={() => onSelectStep(step.id)}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectStep(step.id);
                    dragRef.current = { id: step.id, startX: e.clientX, startDelay: delay };
                    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const d = dragRef.current;
                    if (!d || d.id !== step.id) return;
                    const dx = e.clientX - d.startX;
                    const next = Math.max(0, Math.min(5000, Math.round(d.startDelay + dx / PX_PER_MS)));
                    setLiveDelay((prev) => ({ ...prev, [step.id]: next }));
                  }}
                  onPointerUp={() => {
                    const d = dragRef.current;
                    if (!d || d.id !== step.id) return;
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
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[10px] leading-4 text-stone-600 dark:text-[var(--muted)]">
        {uiLang === "ar"
          ? "اسحب الشريط لتغيير التأخير · انقر للتحديد"
          : "Drag a bar to change delay · click to select"}
      </p>
    </div>
  );
}
