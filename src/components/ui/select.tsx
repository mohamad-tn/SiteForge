"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const SelectRoot = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;
const SelectGroup = SelectPrimitive.Group;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "sf-select sf-field flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-[var(--radius-lg)] pe-3 ps-3.5 text-sm font-medium outline-none",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[placeholder]:text-[color-mix(in_oklab,var(--muted)_80%,transparent)]",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={6}
      className={cn(
        "z-[200] max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--radius-xl)] border border-[color-mix(in_oklab,var(--border)_95%,transparent)] bg-[var(--card)] text-[var(--foreground)] shadow-[0_18px_50px_-24px_rgba(28,25,23,0.55)]",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex h-7 cursor-default items-center justify-center text-[var(--muted)]">
        <ChevronUp className="h-4 w-4" />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className="w-full min-w-[var(--radix-select-trigger-width)] p-1.5">
        {children}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex h-7 cursor-default items-center justify-center text-[var(--muted)]">
        <ChevronDown className="h-4 w-4" />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, value, ...props }, ref) => {
  // Hard guard: Radix crashes on empty-string item values
  const safe = value === undefined || value === null || value === "" ? "__sf_empty__" : String(value);
  return (
    <SelectPrimitive.Item
      ref={ref}
      value={safe}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-xl py-2 pe-8 ps-3 text-sm outline-none",
        "focus:bg-teal-50 focus:text-teal-950 data-[highlighted]:bg-teal-50 data-[highlighted]:text-teal-950",
        "dark:focus:bg-teal-950/50 dark:focus:text-teal-50 dark:data-[highlighted]:bg-teal-950/50 dark:data-[highlighted]:text-teal-50",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        className
      )}
      {...props}
    >
      <span className="absolute end-2.5 flex h-4 w-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-3.5 w-3.5" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-stone-200 dark:bg-stone-800", className)} {...props} />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

/** Radix forbids empty-string item values — map "" ↔ sentinel. */
export const EMPTY_SELECT_VALUE = "__sf_empty__";

export function encodeSelectValue(v: string | undefined | null): string {
  if (v === undefined || v === null || v === "") return EMPTY_SELECT_VALUE;
  return String(v);
}

export function decodeSelectValue(v: string): string {
  return v === EMPTY_SELECT_VALUE ? "" : v;
}

export type SelectOption = { value: string; label: React.ReactNode; disabled?: boolean };

type ConvenientSelectProps = {
  value?: string | null;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  wrapperClassName?: string;
  disabled?: boolean;
  "aria-label"?: string;
  id?: string;
};

/**
 * Polished shared Select (Radix portal). Safe for empty option values, light/dark + RTL.
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = "—",
  className,
  triggerClassName,
  wrapperClassName,
  disabled,
  id,
  "aria-label": ariaLabel,
}: ConvenientSelectProps) {
  const normalized = React.useMemo(() => {
    const seen = new Set<string>();
    const out: { value: string; label: React.ReactNode; disabled?: boolean }[] = [];
    for (const o of options || []) {
      const enc = encodeSelectValue(o?.value);
      if (seen.has(enc)) continue;
      seen.add(enc);
      out.push({ value: enc, label: o.label, disabled: o.disabled });
    }
    if (out.length === 0) {
      out.push({ value: EMPTY_SELECT_VALUE, label: placeholder, disabled: true });
    }
    return out;
  }, [options, placeholder]);

  const encoded = encodeSelectValue(value);
  const hasMatch = normalized.some((o) => o.value === encoded);

  return (
    <div className={cn("relative inline-flex w-full min-w-0", wrapperClassName, className)}>
      <SelectRoot
        value={hasMatch ? encoded : undefined}
        onValueChange={(v) => onValueChange(decodeSelectValue(v))}
        disabled={disabled || (normalized.length === 1 && normalized[0].disabled)}
      >
        <SelectTrigger id={id} aria-label={ariaLabel} className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {normalized.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </div>
  );
}

export {
  SelectRoot,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
};
