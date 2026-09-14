"use client";

import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type TextFieldProps = InputProps & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  wrapperClassName?: string;
  labelClassName?: string;
};

/**
 * Shared labeled field — inherits platform RTL/LTR via Input + Label.
 * Prefer this over ad-hoc Label+Input pairs for chrome forms.
 */
export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      id,
      label,
      hint,
      error,
      className,
      wrapperClassName,
      labelClassName,
      ...props
    },
    ref
  ) => {
    const fieldId = id || props.name || undefined;
    return (
      <div className={cn("sf-text-field space-y-1.5", wrapperClassName)}>
        {label ? (
          <Label htmlFor={fieldId} className={labelClassName}>
            {label}
          </Label>
        ) : null}
        <Input ref={ref} id={fieldId} className={className} {...props} />
        {hint && !error ? (
          <p className="text-[11px] text-[var(--muted)]">{hint}</p>
        ) : null}
        {error ? (
          <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>
        ) : null}
      </div>
    );
  }
);
TextField.displayName = "TextField";
