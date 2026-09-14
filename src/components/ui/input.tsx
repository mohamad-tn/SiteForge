import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "sf-field flex h-[var(--control-h)] w-full min-w-0 rounded-[var(--radius-lg)] px-3.5 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--placeholder)]",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";
