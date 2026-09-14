"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { usePlatformLangOptional } from "@/components/platform-lang-provider";

export type InputProps = React.ComponentProps<"input"> & {
  /**
   * Escape hatch when a caller truly needs a fixed value direction
   * (e.g. code/CSS editors). Not used for auth email/password — those
   * follow platform UI language so Arabic typing starts from the right.
   */
  valueDir?: "ltr" | "rtl" | "auto";
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", dir, valueDir, ...props }, ref) => {
    const { dir: platformDir } = usePlatformLangOptional();
    let resolvedDir = dir;
    if (!resolvedDir) {
      if (valueDir === "ltr" || valueDir === "rtl") resolvedDir = valueDir;
      else if (valueDir === "auto") resolvedDir = undefined;
      else resolvedDir = platformDir;
    }
    return (
      <input
        type={type}
        className={cn(
          "sf-field flex h-[var(--control-h)] w-full min-w-0 rounded-[var(--radius-lg)] px-3.5 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--placeholder)]",
          resolvedDir === "ltr" && "sf-field--ltr",
          resolvedDir === "rtl" && "sf-field--rtl",
          className
        )}
        ref={ref}
        dir={resolvedDir}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
