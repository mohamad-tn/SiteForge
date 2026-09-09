"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  PLATFORM_LANG_EVENT,
  isPlatformLang,
  platformDir,
  readStoredPlatformLang,
  tPlatform,
  writeStoredPlatformLang,
  type PlatformCopyKey,
  type PlatformLang,
} from "@/lib/platform-i18n";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/ui/segmented";

type Ctx = {
  lang: PlatformLang;
  dir: "rtl" | "ltr";
  setLang: (lang: PlatformLang) => void;
  t: (key: PlatformCopyKey | string) => string;
};

const PlatformLangCtx = createContext<Ctx | null>(null);

/** True while a published site view owns documentElement lang/dir. */
export const SF_SITE_VIEW_ATTR = "data-sf-site-view";

export function PlatformLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<PlatformLang>("ar");

  useEffect(() => {
    setLangState(readStoredPlatformLang());
  }, []);

  useEffect(() => {
    const sync = () => {
      const stored = readStoredPlatformLang();
      setLangState(stored);
    };
    window.addEventListener(PLATFORM_LANG_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PLATFORM_LANG_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Own <html> lang/dir for app chrome — never while a public site view is mounted.
  useEffect(() => {
    const apply = () => {
      if (document.documentElement.hasAttribute(SF_SITE_VIEW_ATTR)) return;
      document.documentElement.lang = lang;
      document.documentElement.dir = platformDir(lang);
      document.documentElement.dataset.sfPlatformLang = lang;
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: [SF_SITE_VIEW_ATTR] });
    return () => mo.disconnect();
  }, [lang]);

  const setLang = useCallback((next: PlatformLang) => {
    if (!isPlatformLang(next)) return;
    setLangState(next);
    writeStoredPlatformLang(next);
    if (!document.documentElement.hasAttribute(SF_SITE_VIEW_ATTR)) {
      document.documentElement.lang = next;
      document.documentElement.dir = platformDir(next);
      document.documentElement.dataset.sfPlatformLang = next;
    }
  }, []);

  const t = useCallback((key: PlatformCopyKey | string) => tPlatform(lang, key), [lang]);

  const value = useMemo(
    () => ({ lang, dir: platformDir(lang), setLang, t }),
    [lang, setLang, t]
  );

  return <PlatformLangCtx.Provider value={value}>{children}</PlatformLangCtx.Provider>;
}

export function usePlatformLang() {
  const ctx = useContext(PlatformLangCtx);
  if (!ctx) throw new Error("usePlatformLang requires PlatformLangProvider");
  return ctx;
}

/** Soft hook for components that may render outside provider (SSR-safe fallback). */
export function usePlatformLangOptional(): Ctx {
  const ctx = useContext(PlatformLangCtx);
  const [lang, setLangState] = useState<PlatformLang>("ar");
  useEffect(() => {
    if (!ctx) setLangState(readStoredPlatformLang());
  }, [ctx]);
  if (ctx) return ctx;
  return {
    lang,
    dir: platformDir(lang),
    setLang: (next) => {
      writeStoredPlatformLang(next);
      setLangState(next);
    },
    t: (key) => tPlatform(lang, key),
  };
}

export function PlatformLangSwitcher({
  className,
  size = "default",
}: {
  className?: string;
  size?: "default" | "compact";
}) {
  const { lang, setLang, t } = usePlatformLang();
  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      {size === "default" ? (
        <span className="hidden text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400 sm:inline">
          {t("appUiLang")}
        </span>
      ) : null}
      <SegmentedControl
        aria-label={t("appUiLang")}
        value={lang}
        onChange={(v) => setLang(v as PlatformLang)}
        items={[
          { value: "ar", label: "ع" },
          { value: "en", label: "EN" },
        ]}
      />
    </div>
  );
}

export function PlatformShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { lang, dir } = usePlatformLang();
  return (
    <div className={cn("sf-canvas min-h-screen", className)} lang={lang} dir={dir} data-sf-chrome="platform">
      {children}
    </div>
  );
}
