"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { usePlatformLangOptional } from "@/components/platform-lang-provider";

export type TextareaProps = React.ComponentProps<"textarea"> & {
  valueDir?: "ltr" | "rtl" | "auto";
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, dir, valueDir, ...props }, ref) => {
    const { dir: platformDir } = usePlatformLangOptional();
    let resolvedDir = dir;
    if (!resolvedDir) {
      if (valueDir === "ltr" || valueDir === "rtl") resolvedDir = valueDir;
      else if (valueDir === "auto") resolvedDir = undefined;
      else resolvedDir = platformDir;
    }
    return (
      <textarea
        className={cn(
          "sf-field flex min-h-[88px] w-full min-w-0 rounded-[var(--radius-lg)] px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--placeholder)]",
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
Textarea.displayName = "Textarea";
