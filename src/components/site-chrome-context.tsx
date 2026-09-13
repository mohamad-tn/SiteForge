"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { sanitizeActionTarget } from "@/lib/design";

/**
 * Tenant-site chrome actions for published/preview renderers.
 * Allowlisted only — never eval user JS.
 */
export type SiteModalState = {
  blockId: string | null;
  title: string;
  body: string;
};

export type SiteChromeActions = {
  toggleTheme: () => void;
  cycleLocale: () => void;
  openModal: (opts: { blockId?: string; title?: string; body?: string }) => void;
  closeModal: () => void;
  scrollTo: (target: string) => void;
  modal: SiteModalState;
  colorMode: "light" | "dark";
  locale: string;
  locales: string[];
};

const SiteChromeCtx = createContext<SiteChromeActions | null>(null);

export function SiteChromeProvider({
  value,
  children,
}: {
  value: Omit<SiteChromeActions, "openModal" | "closeModal" | "scrollTo" | "modal"> &
    Partial<Pick<SiteChromeActions, "openModal" | "closeModal" | "scrollTo" | "modal">>;
  children: ReactNode;
}) {
  const [modal, setModal] = useState<SiteModalState>({ blockId: null, title: "", body: "" });

  const closeModal = useCallback(() => {
    setModal({ blockId: null, title: "", body: "" });
  }, []);

  const openModal = useCallback((opts: { blockId?: string; title?: string; body?: string }) => {
    const blockId = sanitizeActionTarget(opts.blockId || "") || null;
    setModal({
      blockId,
      title: typeof opts.title === "string" ? opts.title.slice(0, 200) : "",
      body: typeof opts.body === "string" ? opts.body.slice(0, 2000) : "",
    });
  }, []);

  const scrollTo = useCallback((target: string) => {
    const id = sanitizeActionTarget(target);
    if (!id || typeof document === "undefined") return;
    const byBlock = document.querySelector(`[data-block-id="${CSS.escape(id)}"]`) as HTMLElement | null;
    const byId = document.getElementById(id);
    const el = byBlock || byId;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      el.focus?.({ preventScroll: true });
    } catch {
      /* ignore */
    }
  }, []);

  const merged = useMemo<SiteChromeActions>(
    () => ({
      toggleTheme: value.toggleTheme,
      cycleLocale: value.cycleLocale,
      colorMode: value.colorMode,
      locale: value.locale,
      locales: value.locales,
      openModal: value.openModal || openModal,
      closeModal: value.closeModal || closeModal,
      scrollTo: value.scrollTo || scrollTo,
      modal: value.modal || modal,
    }),
    [value, openModal, closeModal, scrollTo, modal]
  );

  return <SiteChromeCtx.Provider value={merged}>{children}</SiteChromeCtx.Provider>;
}

export function useSiteChrome(): SiteChromeActions | null {
  return useContext(SiteChromeCtx);
}
