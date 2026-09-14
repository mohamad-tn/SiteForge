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
        className="sf-auth-mesh"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="sf-auth-mesh-a" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
            <stop offset="40%" stopColor="#14b8a6" stopOpacity="0.18" />
            <stop offset="70%" stopColor="transparent" stopOpacity="0" />
            <stop offset="100%" stopColor="#d4a574" stopOpacity="0.28" />
          </linearGradient>
          <linearGradient id="sf-auth-mesh-b" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.16" />
            <stop offset="50%" stopColor="transparent" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.22" />
          </linearGradient>
          <radialGradient id="sf-auth-orb-1" cx="20%" cy="20%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sf-auth-orb-2" cx="85%" cy="75%" r="45%">
            <stop offset="0%" stopColor="#d4a574" stopOpacity="0.28" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
          <pattern id="sf-auth-grid" width="56" height="56" patternUnits="userSpaceOnUse">
            <path
              d="M56 0H0V56"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.09"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="1440" height="900" fill="url(#sf-auth-grid)" />
        <rect width="1440" height="900" fill="url(#sf-auth-orb-1)" />
        <rect width="1440" height="900" fill="url(#sf-auth-orb-2)" />
        <path
          d="M0,120 C240,20 480,180 720,90 C960,0 1200,140 1440,60 L1440,0 L0,0 Z"
          fill="url(#sf-auth-mesh-a)"
        />
        <path
          d="M0,900 C320,720 560,820 800,700 C1040,580 1240,780 1440,640 L1440,900 Z"
          fill="url(#sf-auth-mesh-b)"
        />
        <circle cx="1180" cy="220" r="180" fill="var(--accent)" fillOpacity="0.08" />
        <circle cx="160" cy="640" r="140" fill="#d4a574" fillOpacity="0.1" />
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

