"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Tenant-site chrome actions for published/preview renderers.
 * Allowlisted only — toggleTheme / cycleLocale never eval user JS.
 */
export type SiteChromeActions = {
  toggleTheme: () => void;
  cycleLocale: () => void;
  colorMode: "light" | "dark";
  locale: string;
  locales: string[];
};

const SiteChromeCtx = createContext<SiteChromeActions | null>(null);

export function SiteChromeProvider({
  value,
  children,
}: {
  value: SiteChromeActions;
  children: ReactNode;
}) {
  return <SiteChromeCtx.Provider value={value}>{children}</SiteChromeCtx.Provider>;
}

export function useSiteChrome(): SiteChromeActions | null {
  return useContext(SiteChromeCtx);
}
