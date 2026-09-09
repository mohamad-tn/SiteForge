import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Soft member-surface card — prefer this over ad-hoc borders. */
export function SoftCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("sf-soft-card", className)} {...props} />;
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("sf-panel", className)} {...props} />;
}

export function Toolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("sf-toolbar", className)} {...props} />;
}

export function AppHeader({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <header className={cn("sf-app-header", className)} {...props} />;
}

export function AppCanvas({
  className,
  dir,
  lang,
  ...props
}: HTMLAttributes<HTMLDivElement> & { dir?: "rtl" | "ltr"; lang?: string }) {
  return <div className={cn("sf-canvas", className)} dir={dir} lang={lang} {...props} />;
}
