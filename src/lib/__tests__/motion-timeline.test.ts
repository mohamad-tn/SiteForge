import { describe, expect, it } from "vitest";
import {
  normalizeTimeline,
  timelineToCssVars,
  legacyPropsFromTimeline,
  serializeTimeline,
  writeTimelineProps,
  createTimelineStep,
  scrollSequenceHoldMs,
  hasScrollTrigger,
  parseTimelineProp,
} from "@/lib/motion-timeline";
import { blockMotionAttrs, effectPresetProps } from "@/lib/block-style";

describe("normalizeTimeline adapter", () => {
  it("synthesizes one load step from legacy entrance props", () => {
    const steps = normalizeTimeline({
      entranceAnim: "fade",
      animDelay: "120",
      animDuration: "500",
      animEase: "springy",
    });
    expect(steps).toHaveLength(1);
    expect(steps[0].trigger).toBe("load");
    expect(steps[0].anim).toBe("fade");
    expect(steps[0].delayMs).toBe(120);
    expect(steps[0].durationMs).toBe(500);
    expect(steps[0].ease).toBe("springy");
  });

  it("maps scrollReveal to scroll trigger", () => {
    const steps = normalizeTimeline({
      entranceAnim: "slide-up",
      scrollReveal: "true",
    });
    expect(steps[0].trigger).toBe("scroll");
    expect(hasScrollTrigger(steps)).toBe(true);
  });

  it("parses motionTimeline JSON and prefers it over legacy", () => {
    const steps = normalizeTimeline({
      entranceAnim: "fade",
      motionTimeline: serializeTimeline([
        createTimelineStep({ id: "a", trigger: "load", anim: "fade", delayMs: 0, durationMs: 400 }),
        createTimelineStep({ id: "b", trigger: "scroll", anim: "slide-up", delayMs: 80, durationMs: 600 }),
      ]),
    });
    expect(steps).toHaveLength(2);
    expect(steps[0].anim).toBe("fade");
    expect(steps[1].trigger).toBe("scroll");
    expect(steps[1].anim).toBe("slide-up");
  });

  it("keeps stagger on first load step from legacy", () => {
    const steps = normalizeTimeline({
      entranceAnim: "none",
      staggerChildren: "true",
      staggerMs: "100",
    });
    expect(steps[0].staggerChildren).toBe(true);
    expect(steps[0].staggerMs).toBe(100);
  });
});

describe("timelineToCssVars", () => {
  it("emits duration/delay/ease for primary load step", () => {
    const vars = timelineToCssVars([
      createTimelineStep({ trigger: "load", anim: "fade", delayMs: 50, durationMs: 400, ease: "soft" }),
    ]);
    expect(vars["--sf-anim-dur"]).toBe("400ms");
    expect(vars["--sf-anim-delay"]).toBe("50ms");
    expect(String(vars["--sf-ease"])).toContain("cubic-bezier");
  });

  it("adds extra scroll step delays onto CSS delay", () => {
    const vars = timelineToCssVars([
      createTimelineStep({ trigger: "scroll", anim: "fade", delayMs: 100, durationMs: 400 }),
      createTimelineStep({ trigger: "scroll", anim: "slide-up", delayMs: 200, durationMs: 400 }),
    ]);
    expect(vars["--sf-anim-delay"]).toBe("300ms");
  });

  it("exposes hover timing vars", () => {
    const vars = timelineToCssVars([
      createTimelineStep({ trigger: "hover", anim: "scale", delayMs: 0, durationMs: 280, ease: "soft" }),
    ]);
    expect(vars["--sf-hover-dur"]).toBe("280ms");
    expect(vars["--sf-hover-ease"]).toBeTruthy();
  });
});

describe("legacy sync + writeTimelineProps", () => {
  it("syncs first step back to entranceAnim / scrollReveal", () => {
    const legacy = legacyPropsFromTimeline([
      createTimelineStep({ trigger: "load", anim: "fade", delayMs: 10, durationMs: 500, ease: "ease-out" }),
      createTimelineStep({ trigger: "scroll", anim: "slide-up", delayMs: 0, durationMs: 600 }),
    ]);
    expect(legacy.entranceAnim).toBe("fade");
    expect(legacy.scrollReveal).toBe("true");
    expect(legacy.animDuration).toBe("500");
  });

  it("writeTimelineProps stores JSON string", () => {
    const next = writeTimelineProps({}, [
      createTimelineStep({ id: "x", trigger: "load", anim: "blur-in", delayMs: 0, durationMs: 600 }),
      createTimelineStep({ id: "y", trigger: "scroll", anim: "fade", delayMs: 40, durationMs: 500 }),
    ]);
    expect(typeof next.motionTimeline).toBe("string");
    const parsed = parseTimelineProp(next.motionTimeline);
    expect(parsed).toHaveLength(2);
    expect(next.entranceAnim).toBe("blur-in");
    expect(next.scrollReveal).toBe("true");
  });
});

describe("scrollSequenceHoldMs", () => {
  it("is 0 for a single scroll step", () => {
    expect(
      scrollSequenceHoldMs([createTimelineStep({ trigger: "scroll", anim: "fade", delayMs: 100, durationMs: 400 })])
    ).toBe(0);
  });

  it("chains multiple scroll steps", () => {
    const hold = scrollSequenceHoldMs([
      createTimelineStep({ trigger: "scroll", anim: "fade", delayMs: 0, durationMs: 400 }),
      createTimelineStep({ trigger: "scroll", anim: "slide-up", delayMs: 50, durationMs: 300 }),
    ]);
    expect(hold).toBeGreaterThan(0);
  });
});

describe("blockMotionAttrs + timeline", () => {
  it("legacy soft-fade still works via adapter", () => {
    const soft = blockMotionAttrs(effectPresetProps("soft-fade"));
    expect(soft.hasEntrance).toBe(true);
    expect(soft.className).toContain("sf-anim-fade");
  });

  it("load + scroll timeline sets scrollReveal and load entrance", () => {
    const props = writeTimelineProps(
      {},
      [
        createTimelineStep({ trigger: "load", anim: "fade", delayMs: 0, durationMs: 400 }),
        createTimelineStep({ trigger: "scroll", anim: "slide-up", delayMs: 0, durationMs: 600 }),
      ]
    );
    const m = blockMotionAttrs(props);
    expect(m.scrollReveal).toBe(true);
    expect(m.hasLoadEntrance).toBe(true);
    expect(m.className).toContain("sf-anim-fade");
    expect(m.scrollAnimClass).toContain("sf-anim-slide-up");
  });
});
