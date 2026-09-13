import type { HTMLAttributes, ReactNode } from "react";
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
  return <header className={cn("sf-app-header", className)} data-sf-chrome="platform" {...props} />;
}

export function AppCanvas({
  className,
  dir,
  lang,
  ...props
}: HTMLAttributes<HTMLDivElement> & { dir?: "rtl" | "ltr"; lang?: string }) {
  return (
    <div
      className={cn("sf-canvas overflow-x-hidden", className)}
      data-sf-chrome="platform"
      dir={dir}
      lang={lang}
      {...props}
    />
  );
}

type StatCardProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  value: ReactNode;
};

/**
 * Dashboard / landing metric pill.
 * Uses ONLY --stat-bg / --stat-fg / --muted / --border (no gray fills in light mode).
 */
export function StatCard({ label, value, className, ...props }: StatCardProps) {
  return (
    <div className={cn("sf-stat", className)} {...props}>
      <div className="sf-stat-label">{label}</div>
      <div className="sf-stat-value">{value}</div>
    </div>
  );
}
