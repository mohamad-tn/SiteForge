"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Item<T extends string> = { value: T; label: ReactNode };

export function SegmentedControl<T extends string>({
  value,
  onChange,
  items,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  items: Item<T>[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={cn("sf-segment", className)} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          data-active={value === item.value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
