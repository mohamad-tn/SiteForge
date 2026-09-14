import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Soft member-surface card — prefer this over ad-hoc borders. */
export function SoftCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("sf-soft-card", className)} {...props} />;
}

/** Auth / marketing glass panel — blur + translucent card. */
export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("sf-glass-card", className)} {...props} />;
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

/** Near full-bleed content column (landing / dashboard / admin). */
export function Shell({
  className,
  wide,
  pad = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & { wide?: boolean; pad?: boolean }) {
  return (
    <div
      className={cn(wide ? "sf-shell-wide" : "sf-shell", pad && "sf-shell-pad", className)}
      {...props}
    />
  );
}

/**
 * Atmospheric auth background — mesh + noise layers via CSS.
 * Optional SVG accent mesh for depth without binary assets.
 */
export function AuthAtmosphere({
  className,
  dir,
  lang,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { dir?: "rtl" | "ltr"; lang?: string }) {
  return (
    <div
      className={cn("sf-auth-bg", className)}
      data-sf-chrome="platform"
      dir={dir}
      lang={lang}
      {...props}
    >
      <svg
        aria-hidden
        className="sf-auth-mesh opacity-[0.35] dark:opacity-[0.22]"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="sf-auth-mesh-a" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="55%" stopColor="transparent" stopOpacity="0" />
            <stop offset="100%" stopColor="#d4a574" stopOpacity="0.14" />
          </linearGradient>
          <pattern id="sf-auth-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path
              d="M48 0H0V48"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.06"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sf-auth-grid)" />
        <path
          d="M0,80 Q180,20 360,90 T720,70 T1080,100 T1440,60 V0 H0 Z"
          fill="url(#sf-auth-mesh-a)"
        />
        <circle cx="85%" cy="78%" r="18%" fill="var(--accent)" fillOpacity="0.06" />
        <circle cx="8%" cy="70%" r="14%" fill="#d4a574" fillOpacity="0.07" />
      </svg>
      {children}
    </div>
  );
}

type StatCardProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  value: ReactNode;
};

/**
 * Dashboard / marketing metric pill.
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

type AdminNavItem = {
  id: string;
  label: string;
  icon?: ReactNode;
};

type AdminShellProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tabs: AdminNavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: ReactNode;
  dir?: "rtl" | "ltr";
  lang?: string;
  mobileTabs?: ReactNode;
};

/** Dedicated platform-ops chrome — left nav (≥900px) + mobile segmented tabs. */
export function AdminShell({
  title,
  subtitle,
  actions,
  tabs,
  activeTab,
  onTabChange,
  children,
  dir,
  lang,
  mobileTabs,
}: AdminShellProps) {
  return (
    <AppCanvas dir={dir} lang={lang} className="sf-admin-shell">
      <AppHeader>
        <Shell className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="truncate text-base font-bold tracking-tight text-teal-900 dark:text-teal-300">
              {title}
            </div>
            {subtitle ? (
              <div className="truncate text-xs text-[var(--muted)]">{subtitle}</div>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              {actions}
            </div>
          ) : null}
        </Shell>
      </AppHeader>

      <div className="sf-admin-body">
        <nav className="sf-admin-nav" aria-label="Admin">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-active={activeTab === tab.id ? "true" : "false"}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.icon}
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          {mobileTabs ? <div className="sf-admin-tabs-mobile">{mobileTabs}</div> : null}
          <div className="sf-admin-main space-y-[var(--sf-section-gap)]">{children}</div>
        </div>
      </div>
    </AppCanvas>
  );
}

