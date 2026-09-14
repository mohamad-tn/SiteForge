"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { usePlatformLangOptional } from "@/components/platform-lang-provider";

export type SearchFieldProps = Omit<React.ComponentProps<"input">, "type"> & {
  /** Grow along the inline axis in a horizontal toolbar row. Never grows on the block axis. */
  grow?: boolean;
  inputClassName?: string;
  wrapperClassName?: string;
};

/**
 * Single search primitive: icon + input + `.sf-search` styles.
 * Direction follows platform UI lang (AR→RTL chrome, EN→LTR); typed queries stay natural.
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
      dir,
      ...props
    },
    ref
  ) => {
    const { dir: platformDir } = usePlatformLangOptional();
    const resolved = dir || platformDir;
    return (
      <div
        className={cn("sf-search", grow && "sf-search--grow", wrapperClassName)}
        data-sf-search=""
        dir={resolved}
      >
        <Search aria-hidden />
        <Input
          ref={ref}
          type="search"
          valueDir="auto"
          dir={resolved}
          placeholder={placeholder}
          aria-label={ariaLabel ?? (typeof placeholder === "string" ? placeholder : undefined)}
          className={cn(className, inputClassName)}
          {...props}
        />
      </div>
    );
  }
);
SearchField.displayName = "SearchField";
