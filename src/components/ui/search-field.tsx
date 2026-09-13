"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchFieldProps = Omit<React.ComponentProps<"input">, "type"> & {
  /** Grow along the inline axis in a horizontal toolbar row. Never grows on the block axis. */
  grow?: boolean;
  inputClassName?: string;
  wrapperClassName?: string;
};

/**
 * Single search primitive: icon + input + `.sf-search` styles.
 * Owns layout so callers never leave a floating icon in a flex-grown column.
 */
export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  (
    {
      className,
      inputClassName,
      wrapperClassName,
      grow = false,
      placeholder,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => (
    <div
      className={cn("sf-search", grow && "sf-search--grow", wrapperClassName)}
      data-sf-search=""
    >
      <Search aria-hidden />
      <Input
        ref={ref}
        type="search"
        placeholder={placeholder}
        aria-label={ariaLabel ?? (typeof placeholder === "string" ? placeholder : undefined)}
        className={cn(className, inputClassName)}
        {...props}
      />
    </div>
  )
);
SearchField.displayName = "SearchField";
