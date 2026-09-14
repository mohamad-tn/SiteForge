"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";
import { usePlatformLangOptional } from "@/components/platform-lang-provider";

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, dir, ...props }, ref) => {
  const { dir: platformDir } = usePlatformLangOptional();
  const resolved = dir || platformDir;
  return (
    <LabelPrimitive.Root
      ref={ref}
      dir={resolved}
      className={cn(
        "sf-label block text-sm leading-none text-[var(--label)]",
        resolved === "rtl" && "sf-label--rtl",
        resolved === "ltr" && "sf-label--ltr",
        className
      )}
      {...props}
    />
  );
});
Label.displayName = "Label";
