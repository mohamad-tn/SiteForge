"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Wraps a block for optional scroll-triggered entrance.
 * In the editor (editable), animations play immediately so authors see them.
 * On public pages, IntersectionObserver reveals once (respects reduced-motion via CSS).
 *
 * Timeline foundation:
 * - Load entrance plays immediately (classes already on the node).
 * - Scroll steps use IO; multiple scroll steps sequence via hold delay after intersect.
 * - When both load + scroll anims exist, after intersect we swap to scrollAnimClass.
 */
export function MotionBlock({
  className,
  style,
  scrollReveal,
  hasEntrance,
  hasLoadEntrance = false,
  scrollAnimClass = "",
  scrollStyle,
  scrollHoldMs = 0,
  editable,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  scrollReveal: boolean;
  hasEntrance: boolean;
  hasLoadEntrance?: boolean;
  scrollAnimClass?: string;
  scrollStyle?: CSSProperties;
  scrollHoldMs?: number;
  editable?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const useScroll = scrollReveal && hasEntrance && !editable;
  // When only scroll (no load entrance), gate visibility until in view.
  const gateUntilScroll = useScroll && !hasLoadEntrance;
  const [inView, setInView] = useState(!gateUntilScroll);
  const [scrollPhase, setScrollPhase] = useState(false);

  useEffect(() => {
    if (!useScroll) {
      setInView(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      setScrollPhase(Boolean(scrollAnimClass));
      return;
    }

    if (gateUntilScroll) setInView(false);
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const hold = Math.max(0, scrollHoldMs || 0);
            const apply = () => {
              setInView(true);
              if (scrollAnimClass) setScrollPhase(true);
            };
            if (hold > 0 && hasLoadEntrance) {
              window.setTimeout(apply, hold);
            } else if (hold > 0 && gateUntilScroll) {
              // Sequential scroll-only: CSS delay handles first step; hold covers extras.
              window.setTimeout(apply, Math.min(hold, 8000));
            } else {
              apply();
            }
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [useScroll, gateUntilScroll, scrollHoldMs, scrollAnimClass, hasLoadEntrance]);

  const mergedStyle: CSSProperties = {
    ...(style || {}),
    ...(scrollPhase && scrollStyle ? scrollStyle : {}),
  };

  const cls = [
    scrollPhase && scrollAnimClass ? scrollAnimClass : className,
    useScroll && gateUntilScroll ? "sf-anim-scroll" : "",
    // When load already played and scroll follow-up starts, briefly use scroll gate class pair
    useScroll && hasLoadEntrance && scrollPhase ? "sf-anim-scroll sf-anim-in" : "",
    useScroll && gateUntilScroll && inView ? "sf-anim-in" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className={cls || undefined} style={mergedStyle}>
      {children}
    </div>
  );
}
