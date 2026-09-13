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
  linear: "cubic-bezier(0, 0, 1, 1)",
};

export type BezierPoints = { x1: number; y1: number; x2: number; y2: number };

const CUBIC_RE =
  /^cubic-bezier\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*\)$/i;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function clampY(n: number): number {
  // CSS allows y outside 0–1 for overshoot; keep a sane editor range.
  return Math.min(2, Math.max(-0.5, n));
}

/** Parse named preset or cubic-bezier(...) into control points. */
export function parseBezier(ease: string | undefined | null): BezierPoints {
  const raw = (ease || "ease-out").trim();
  const named = EASE_CSS[raw];
  const css = named || raw;
  const m = css.match(CUBIC_RE);
  if (m) {
    return {
      x1: clamp01(Number(m[1])),
      y1: clampY(Number(m[2])),
      x2: clamp01(Number(m[3])),
      y2: clampY(Number(m[4])),
    };
  }
  // fallback ease-out
  return parseBezier("ease-out");
}

export function serializeBezier(p: BezierPoints): string {
  const x1 = clamp01(Number(p.x1) || 0);
  const y1 = clampY(Number(p.y1) || 0);
  const x2 = clamp01(Number(p.x2) || 1);
  const y2 = clampY(Number(p.y2) || 1);
  const fmt = (n: number) => {
    const r = Math.round(n * 1000) / 1000;
    return String(r);
  };
  return `cubic-bezier(${fmt(x1)}, ${fmt(y1)}, ${fmt(x2)}, ${fmt(y2)})`;
}

/** Match a curve to a named preset when close; else return the cubic-bezier string. */
export function easeIdFromPoints(p: BezierPoints): string {
  const css = serializeBezier(p);
  for (const [id, val] of Object.entries(EASE_CSS)) {
    if (val.replace(/\s/g, "") === css.replace(/\s/g, "")) return id;
  }
  return css;
}

export function resolveEaseCss(id: string | undefined): string {
  const raw = (id || "ease-out").trim();
  if (EASE_CSS[raw]) return EASE_CSS[raw];
  if (CUBIC_RE.test(raw)) return serializeBezier(parseBezier(raw));
  return EASE_CSS["ease-out"];
}

/** Normalize ease: keep named presets or a validated cubic-bezier string. */
export function normalizeEase(ease: unknown): string {
  const raw = typeof ease === "string" ? ease.trim() : "";
  if (!raw) return "ease-out";
  if (EASE_CSS[raw]) return raw;
  if (CUBIC_RE.test(raw)) return serializeBezier(parseBezier(raw));
  return "ease-out";
}

export type MotionTrigger = "load" | "scroll" | "hover";

/** Optional property bag sampled at progress t (0..1). */
export type MotionKeyframe = {
  t: number;
  opacity?: number;
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
};

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
  /**
   * Optional keyframes (t in 0..1). When 2+ keys exist they drive CSS @keyframes
   * (additive override over the named preset anim).
   */
  keyframes?: MotionKeyframe[];
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
    keyframes: partial?.keyframes,
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
  const ease = normalizeEase(raw.ease);
  const staggerChildren = Boolean(raw.staggerChildren);
  const staggerMs = clamp(Math.round(num(raw.staggerMs, 80)), 0, 1000);
  const keyframes = normalizeKeyframes((raw as { keyframes?: unknown }).keyframes);
  return {
    id: str(raw.id) || newId(),
    trigger,
    anim,
    delayMs,
    durationMs,
    ease,
    ...(staggerChildren ? { staggerChildren: true, staggerMs } : {}),
    ...(keyframes && keyframes.length ? { keyframes } : {}),
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
  const ease = normalizeEase(props.animEase);
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


export function clampKeyframeT(t: number): number {
  if (!Number.isFinite(t)) return 0;
  return Math.min(1, Math.max(0, t));
}

function optNum(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeKeyframe(raw: Partial<MotionKeyframe> | Record<string, unknown>): MotionKeyframe {
  const t = clampKeyframeT(num(raw.t, 0));
  const out: MotionKeyframe = { t };
  const opacity = optNum(raw.opacity);
  const x = optNum(raw.x);
  const y = optNum(raw.y);
  const scale = optNum(raw.scale);
  const rotate = optNum(raw.rotate);
  if (opacity != null) out.opacity = clamp(opacity, 0, 1);
  if (x != null) out.x = clamp(x, -2000, 2000);
  if (y != null) out.y = clamp(y, -2000, 2000);
  if (scale != null) out.scale = clamp(scale, 0, 8);
  if (rotate != null) out.rotate = clamp(rotate, -720, 720);
  return out;
}

/** Parse/normalize keyframe list; returns undefined when fewer than 1 valid key. */
export function normalizeKeyframes(raw: unknown): MotionKeyframe[] | undefined {
  if (raw == null || raw === "") return undefined;
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(data) || data.length === 0) return undefined;
  const keys = data
    .filter((x) => x && typeof x === "object")
    .map((x) => normalizeKeyframe(x as Record<string, unknown>))
    .sort((a, b) => a.t - b.t);
  // Deduplicate identical t (keep last)
  const byT = new Map<number, MotionKeyframe>();
  for (const k of keys) byT.set(Math.round(k.t * 1000) / 1000, { ...k, t: Math.round(k.t * 1000) / 1000 });
  const out = [...byT.values()].sort((a, b) => a.t - b.t);
  return out.length ? out : undefined;
}

export function serializeKeyframes(keys: MotionKeyframe[] | undefined): string {
  const n = normalizeKeyframes(keys);
  return JSON.stringify(n || []);
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

function sampleProp(
  keys: MotionKeyframe[],
  t: number,
  prop: keyof Omit<MotionKeyframe, "t">,
  fallback: number
): number {
  const withProp = keys.filter((k) => k[prop] != null);
  if (!withProp.length) return fallback;
  if (t <= withProp[0].t) return withProp[0][prop] as number;
  if (t >= withProp[withProp.length - 1].t) return withProp[withProp.length - 1][prop] as number;
  for (let i = 0; i < withProp.length - 1; i++) {
    const a = withProp[i];
    const b = withProp[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1;
      const u = (t - a.t) / span;
      return lerp(a[prop] as number, b[prop] as number, u);
    }
  }
  return fallback;
}

/**
 * Sample interpolated transform/opacity at progress t (0..1).
 * Linear between surrounding keys; callers may ease t via the step's cubic-bezier first.
 */
export function interpolateKeyframes(
  keys: MotionKeyframe[] | undefined | null,
  tRaw: number
): { opacity: number; x: number; y: number; scale: number; rotate: number } {
  const t = clampKeyframeT(tRaw);
  const list = normalizeKeyframes(keys || undefined) || [];
  if (list.length === 0) {
    return { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 };
  }
  if (list.length === 1) {
    const k = list[0];
    return {
      opacity: k.opacity ?? 1,
      x: k.x ?? 0,
      y: k.y ?? 0,
      scale: k.scale ?? 1,
      rotate: k.rotate ?? 0,
    };
  }
  return {
    opacity: sampleProp(list, t, "opacity", 1),
    x: sampleProp(list, t, "x", 0),
    y: sampleProp(list, t, "y", 0),
    scale: sampleProp(list, t, "scale", 1),
    rotate: sampleProp(list, t, "rotate", 0),
  };
}

function fmtCssNum(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return String(r);
}

function keyframeToCssDecl(sample: { opacity: number; x: number; y: number; scale: number; rotate: number }): string {
  const transform = `translate(${fmtCssNum(sample.x)}px, ${fmtCssNum(sample.y)}px) scale(${fmtCssNum(sample.scale)}) rotate(${fmtCssNum(sample.rotate)}deg)`;
  return `opacity:${fmtCssNum(sample.opacity)};transform:${transform}`;
}

/**
 * Compile 2+ keyframes into a CSS @keyframes rule + utility class.
 * Named presets remain as fallback when keyframes are absent / single.
 */
export function compileKeyframesCss(
  animName: string,
  keys: MotionKeyframe[] | undefined | null
): { css: string; className: string; animationName: string } | null {
  const list = normalizeKeyframes(keys || undefined);
  if (!list || list.length < 2) return null;
  const safe = String(animName || "sf-kf").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "sf-kf";
  const frames: string[] = [];
  // Ensure 0% and 100% coverage by sampling ends if missing.
  const ts = new Set(list.map((k) => k.t));
  if (![...ts].some((t) => t <= 0.001)) {
    frames.push(`0%{${keyframeToCssDecl(interpolateKeyframes(list, 0))}}`);
  }
  for (const k of list) {
    const pct = Math.round(clampKeyframeT(k.t) * 1000) / 10;
    frames.push(`${pct}%{${keyframeToCssDecl(interpolateKeyframes(list, k.t))}}`);
  }
  if (![...ts].some((t) => t >= 0.999)) {
    frames.push(`100%{${keyframeToCssDecl(interpolateKeyframes(list, 1))}}`);
  }
  const css = `@keyframes ${safe}{${frames.join("")}}.${safe}{animation-name:${safe}}`;
  return { css, className: safe, animationName: safe };
}

/** True when a step should use compiled keyframes instead of (or over) preset class. */
export function stepUsesKeyframes(step: MotionTimelineStep): boolean {
  const keys = normalizeKeyframes(step.keyframes);
  return Boolean(keys && keys.length >= 2);
}

export function defaultEntranceKeyframes(anim: string): MotionKeyframe[] {
  switch (anim) {
    case "fade":
      return [
        { t: 0, opacity: 0 },
        { t: 1, opacity: 1 },
      ];
    case "slide-up":
      return [
        { t: 0, opacity: 0, y: 24 },
        { t: 1, opacity: 1, y: 0 },
      ];
    case "slide-down":
      return [
        { t: 0, opacity: 0, y: -24 },
        { t: 1, opacity: 1, y: 0 },
      ];
    case "slide-left":
      return [
        { t: 0, opacity: 0, x: 24 },
        { t: 1, opacity: 1, x: 0 },
      ];
    case "slide-right":
      return [
        { t: 0, opacity: 0, x: -24 },
        { t: 1, opacity: 1, x: 0 },
      ];
    case "scale":
      return [
        { t: 0, opacity: 0, scale: 0.92 },
        { t: 1, opacity: 1, scale: 1 },
      ];
    case "zoom-fade":
      return [
        { t: 0, opacity: 0, scale: 1.08 },
        { t: 1, opacity: 1, scale: 1 },
      ];
    default:
      return [
        { t: 0, opacity: 0 },
        { t: 1, opacity: 1 },
      ];
  }
}
