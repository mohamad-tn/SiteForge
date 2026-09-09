"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { usePlatformLangOptional } from "@/components/platform-lang-provider";

type PlatformTheme = "light" | "dark";

type ThemeCtx = {
  theme: PlatformTheme;
  setTheme: (t: PlatformTheme) => void;
  toggle: () => void;
};

const Ctx = createContext<ThemeCtx | null>(null);
const KEY = "siteforge-platform-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<PlatformTheme>("light");

  useEffect(() => {
    const stored = localStorage.getItem(KEY) as PlatformTheme | null;
    const preferDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored || (preferDark ? "dark" : "light");
    setThemeState(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
    document.documentElement.dataset.theme = initial;
  }, []);

  const setTheme = useCallback((t: PlatformTheme) => {
    setThemeState(t);
    localStorage.setItem(KEY, t);
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.dataset.theme = t;
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [setTheme, theme]);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlatformTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlatformTheme requires ThemeProvider");
  return ctx;
}

export function ThemeToggleButton({ className = "" }: { className?: string }) {
  const { theme, toggle } = usePlatformTheme();
  const { t } = usePlatformLangOptional();
  const darkLabel = t("dark");
  const lightLabel = t("light");
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-stone-200/80 bg-[var(--card)] px-3 text-xs font-medium text-stone-700 shadow-[var(--shadow-xs)] transition hover:bg-[var(--surface)] dark:border-stone-700 dark:text-stone-200",
        className
      )}
      title={theme === "light" ? darkLabel : lightLabel}
    >
      <span aria-hidden>{theme === "light" ? "☾" : "☀"}</span>
      <span className="hidden sm:inline">{theme === "light" ? darkLabel : lightLabel}</span>
    </button>
  );
}
