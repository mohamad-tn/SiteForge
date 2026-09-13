/**
 * Per-block motion timeline foundation.
 * Pure types + adapters — not a full keyframe engine.
 * Legacy entranceAnim / animDelay / animDuration / animEase / scrollReveal stay in sync with the first step.
 */

/** Local ease map — avoid circular import with block-style. */
const EASE_CSS: Record<string, string> = {
  "ease-out": "cubic-bezier(0.22, 1, 0.36, 1)",
  springy: "cubic-bezier(0.34, 1.45, 0.64, 1)",
  soft: "cubic-bezier(0.4, 0, 0.2, 1)",
};

function resolveEaseCss(id: string | undefined): string {
  return EASE_CSS[id || "ease-out"] || EASE_CSS["ease-out"];
}

export type MotionTrigger = "load" | "scroll" | "hover";

export type MotionTimelineStep = {
  id: string;
  trigger: MotionTrigger;
  anim: string;
  delayMs: number;
  durationMs: number;
  ease: string;
  /** Stagger option — only meaningful on the first load step at runtime. */
  staggerChildren?: boolean;
  staggerMs?: number;
};

export const MOTION_TRIGGERS: MotionTrigger[] = ["load", "scroll", "hover"];

export const MOTION_ANIM_IDS = [
  "none",
  "fade",
  "slide-up",
  "slide-down",
  "slide-left",
  "slide-right",
  "scale",
  "float",
  "blur-in",
  "bounce-in",
  "zoom-fade",
] as const;

export type MotionAnimId = (typeof MOTION_ANIM_IDS)[number];

const ENTRANCE_CLASS: Record<string, string> = {
  none: "",
  fade: "sf-anim-fade",
  "slide-up": "sf-anim-slide-up",
  "slide-down": "sf-anim-slide-down",
  "slide-left": "sf-anim-slide-left",
  "slide-right": "sf-anim-slide-right",
  scale: "sf-anim-scale",
  float: "sf-anim-float",
  "blur-in": "sf-anim-blur-in",
  "bounce-in": "sf-anim-bounce-in",
  "zoom-fade": "sf-anim-zoom-fade",
};

function str(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}

function num(v: unknown, fb: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fb;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function newId(): string {
  return `ms-${Math.random().toString(36).slice(2, 9)}`;
}

export function entranceClassFor(anim: string): string {
  return ENTRANCE_CLASS[anim] || "";
}

export function createTimelineStep(partial?: Partial<MotionTimelineStep>): MotionTimelineStep {
  return normalizeStep({
    id: partial?.id || newId(),
    trigger: partial?.trigger || "load",
    anim: partial?.anim ?? "fade",
    delayMs: partial?.delayMs ?? 0,
    durationMs: partial?.durationMs ?? 600,
    ease: partial?.ease ?? "ease-out",
    staggerChildren: partial?.staggerChildren,
    staggerMs: partial?.staggerMs,
  });
}

export function normalizeStep(raw: Partial<MotionTimelineStep> | Record<string, unknown>): MotionTimelineStep {
  const triggerRaw = str(raw.trigger, "load");
  const trigger: MotionTrigger =
    triggerRaw === "scroll" || triggerRaw === "hover" || triggerRaw === "load" ? triggerRaw : "load";
  const animRaw = str(raw.anim, "none");
  const anim = MOTION_ANIM_IDS.includes(animRaw as MotionAnimId) ? animRaw : "fade";
  const delayMs = clamp(Math.round(num(raw.delayMs, 0)), 0, 5000);
  const durationMs = clamp(Math.round(num(raw.durationMs, 600)), 50, 5000);
  const ease = str(raw.ease, "ease-out") || "ease-out";
  const staggerChildren = Boolean(raw.staggerChildren);
  const staggerMs = clamp(Math.round(num(raw.staggerMs, 80)), 0, 1000);
  return {
    id: str(raw.id) || newId(),
    trigger,
    anim,
    delayMs,
    durationMs,
    ease,
    ...(staggerChildren ? { staggerChildren: true, staggerMs } : {}),
  };
}

/** Parse motionTimeline JSON string or array; returns null if absent/invalid empty. */
export function parseTimelineProp(raw: unknown): MotionTimelineStep[] | null {
  if (raw == null || raw === "") return null;
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(data) || data.length === 0) return null;
  return data
    .filter((x) => x && typeof x === "object")
    .map((x) => normalizeStep(x as Record<string, unknown>));
}

/**
 * Normalize block props → timeline steps.
 * Adapter: if no motionTimeline, synthesize one step from legacy entrance props.
 */
export function normalizeTimeline(props: Record<string, unknown>): MotionTimelineStep[] {
  const parsed = parseTimelineProp(props.motionTimeline);
  if (parsed && parsed.length > 0) return parsed;

  const anim = str(props.entranceAnim, "none") || "none";
  const delayMs = clamp(Math.round(num(props.animDelay, 0)), 0, 5000);
  const durationMs = clamp(Math.round(num(props.animDuration, 600)), 50, 5000);
  const ease = str(props.animEase, "ease-out") || "ease-out";
  const scrollReveal = str(props.scrollReveal, "false") === "true";
  const staggerChildren = str(props.staggerChildren, "false") === "true";
  const staggerMs = clamp(Math.round(num(props.staggerMs, 80)), 0, 1000);

  return [
    normalizeStep({
      id: "legacy-1",
      trigger: scrollReveal ? "scroll" : "load",
      anim,
      delayMs,
      durationMs,
      ease,
      staggerChildren,
      staggerMs,
    }),
  ];
}

/** Serialize steps for block.props.motionTimeline */
export function serializeTimeline(steps: MotionTimelineStep[]): string {
  return JSON.stringify(steps.map((s) => normalizeStep(s)));
}

/**
 * Keep legacy single-entrance keys in sync with the first non-hover step
 * (or first step). Hover-only timelines leave entrance as none.
 */
export function legacyPropsFromTimeline(steps: MotionTimelineStep[]): Record<string, string> {
  const normalized = steps.map((s) => normalizeStep(s));
  const primary =
    normalized.find((s) => s.trigger === "load") ||
    normalized.find((s) => s.trigger === "scroll") ||
    normalized[0];
  const hasScroll = normalized.some((s) => s.trigger === "scroll");
  const loadStep = normalized.find((s) => s.trigger === "load");
  const staggerSrc = loadStep || primary;

  if (!primary) {
    return {
      entranceAnim: "none",
      animEase: "ease-out",
      animDuration: "600",
      animDelay: "0",
      staggerChildren: "false",
      staggerMs: "80",
      scrollReveal: "false",
    };
  }

  return {
    entranceAnim: primary.anim,
    animEase: primary.ease,
    animDuration: String(primary.durationMs),
    animDelay: String(primary.delayMs),
    staggerChildren: staggerSrc?.staggerChildren ? "true" : "false",
    staggerMs: String(staggerSrc?.staggerMs ?? 80),
    scrollReveal: hasScroll ? "true" : "false",
  };
}

/** Patch props with timeline JSON + legacy sync. */
export function writeTimelineProps(
  props: Record<string, unknown>,
  steps: MotionTimelineStep[]
): Record<string, unknown> {
  const normalized = steps.map((s) => normalizeStep(s));
  return {
    ...props,
    motionTimeline: serializeTimeline(normalized),
    ...legacyPropsFromTimeline(normalized),
  };
}

/**
 * CSS vars for the primary entrance (first load, else first scroll).
 * Additional scroll steps append their delayMs onto --sf-anim-delay (sequential foundation).
 * Hover step vars use --sf-hover-* for existing hover transitions.
 */
export function timelineToCssVars(steps: MotionTimelineStep[]): Record<string, string | number> {
  const normalized = steps.map((s) => normalizeStep(s));
  const style: Record<string, string | number> = {};

  const loadSteps = normalized.filter((s) => s.trigger === "load");
  const scrollSteps = normalized.filter((s) => s.trigger === "scroll");
  const hoverSteps = normalized.filter((s) => s.trigger === "hover");

  const primary =
    loadSteps.find((s) => s.anim !== "none") ||
    loadSteps[0] ||
    scrollSteps.find((s) => s.anim !== "none") ||
    scrollSteps[0];

  if (primary && (primary.anim !== "none" || primary.staggerChildren)) {
    style["--sf-anim-dur"] = `${primary.durationMs}ms`;
    let delay = primary.delayMs;
    // Sequential scroll foundation: extra scroll steps add delay after the primary scroll step.
    if (primary.trigger === "scroll" && scrollSteps.length > 1) {
      const idx = scrollSteps.findIndex((s) => s.id === primary.id);
      const after = scrollSteps.slice(idx + 1);
      delay += after.reduce((acc, s) => acc + s.delayMs, 0);
    }
    style["--sf-anim-delay"] = `${delay}ms`;
    style["--sf-ease"] = resolveEaseCss(primary.ease);
  }

  const staggerSrc = loadSteps.find((s) => s.staggerChildren) || (primary?.staggerChildren ? primary : null);
  if (staggerSrc?.staggerChildren) {
    style["--sf-stagger-ms"] = `${staggerSrc.staggerMs ?? 80}ms`;
    if (!style["--sf-ease"]) style["--sf-ease"] = resolveEaseCss(staggerSrc.ease);
    if (!style["--sf-anim-dur"]) style["--sf-anim-dur"] = `${staggerSrc.durationMs}ms`;
    if (!style["--sf-anim-delay"]) style["--sf-anim-delay"] = `${staggerSrc.delayMs}ms`;
  }

  const hover = hoverSteps[0];
  if (hover) {
    style["--sf-hover-dur"] = `${hover.durationMs}ms`;
    style["--sf-hover-delay"] = `${hover.delayMs}ms`;
    style["--sf-hover-ease"] = resolveEaseCss(hover.ease);
    // Prefer hover timing for existing hover transition tokens when present.
    if (!style["--sf-ease"]) style["--sf-ease"] = resolveEaseCss(hover.ease);
  }

  return style;
}

export function primaryEntranceStep(steps: MotionTimelineStep[]): MotionTimelineStep | null {
  const normalized = steps.map((s) => normalizeStep(s));
  return (
    normalized.find((s) => s.trigger === "load" && s.anim !== "none") ||
    normalized.find((s) => s.trigger === "load") ||
    normalized.find((s) => s.trigger === "scroll" && s.anim !== "none") ||
    normalized.find((s) => s.trigger === "scroll") ||
    null
  );
}

export function firstScrollStep(steps: MotionTimelineStep[]): MotionTimelineStep | null {
  return steps.map((s) => normalizeStep(s)).find((s) => s.trigger === "scroll") || null;
}

export function firstLoadStep(steps: MotionTimelineStep[]): MotionTimelineStep | null {
  return steps.map((s) => normalizeStep(s)).find((s) => s.trigger === "load") || null;
}

export function firstHoverStep(steps: MotionTimelineStep[]): MotionTimelineStep | null {
  return steps.map((s) => normalizeStep(s)).find((s) => s.trigger === "hover") || null;
}

/** Hold ms after intersect before revealing when multiple scroll steps sequence. */
export function scrollSequenceHoldMs(steps: MotionTimelineStep[]): number {
  const scroll = steps.map((s) => normalizeStep(s)).filter((s) => s.trigger === "scroll");
  if (scroll.length <= 1) return 0;
  // After first scroll step's CSS delay handles step 0, hold for subsequent steps' delays
  // (durations of prior steps approximate sequential chaining without a full engine).
  let hold = 0;
  for (let i = 0; i < scroll.length - 1; i++) {
    hold += scroll[i].delayMs + scroll[i].durationMs;
  }
  hold += scroll[scroll.length - 1].delayMs;
  // First step delay is already in CSS — subtract it from hold used by MotionBlock wait.
  hold -= scroll[0].delayMs;
  return Math.max(0, hold);
}

export function hasScrollTrigger(steps: MotionTimelineStep[]): boolean {
  return steps.some((s) => normalizeStep(s).trigger === "scroll");
}

export function hasLoadEntrance(steps: MotionTimelineStep[]): boolean {
  return steps.some((s) => {
    const n = normalizeStep(s);
    return n.trigger === "load" && (n.anim !== "none" || n.staggerChildren);
  });
}
