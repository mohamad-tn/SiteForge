"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Wraps a block for optional scroll-triggered entrance.
 * In the editor (editable), animations play immediately so authors see them.
 * On public pages, IntersectionObserver reveals once (respects reduced-motion via CSS).
 */
export function MotionBlock({
  className,
  style,
  scrollReveal,
  hasEntrance,
  editable,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  scrollReveal: boolean;
  hasEntrance: boolean;
  editable?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const useScroll = scrollReveal && hasEntrance && !editable;
  const [inView, setInView] = useState(!useScroll);

  useEffect(() => {
    if (!useScroll) {
      setInView(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }

    setInView(false);
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [useScroll]);

  const cls = [
    className,
    useScroll ? "sf-anim-scroll" : "",
    useScroll && inView ? "sf-anim-in" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className={cls || undefined} style={style}>
      {children}
    </div>
  );
}
