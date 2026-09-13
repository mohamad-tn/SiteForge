"use client";

import { useEffect, useRef } from "react";
import { useSiteChrome } from "@/components/site-chrome-context";

/**
 * Allowlisted openModal host:
 * - title/body dialog from button props, and/or
 * - reveal a hidden block (by id) with .sf-modal-reveal
 */
export function SiteModalHost({ uiLang = "en" }: { uiLang?: "ar" | "en" }) {
  const chrome = useSiteChrome();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!chrome?.modal.blockId) return;
    const id = chrome.modal.blockId;
    const el = document.querySelector(`[data-block-id="${CSS.escape(id)}"]`) as HTMLElement | null;
    if (!el) return;
    el.classList.add("sf-modal-reveal");
    const prevTab = el.getAttribute("tabindex");
    el.setAttribute("tabindex", "-1");
    try {
      el.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
    return () => {
      el.classList.remove("sf-modal-reveal");
      if (prevTab == null) el.removeAttribute("tabindex");
      else el.setAttribute("tabindex", prevTab);
    };
  }, [chrome?.modal.blockId]);

  useEffect(() => {
    if (!chrome) return;
    const open = Boolean(chrome.modal.blockId || chrome.modal.title || chrome.modal.body);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") chrome.closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chrome]);

  if (!chrome) return null;
  const { modal, closeModal } = chrome;
  const open = Boolean(modal.blockId || modal.title || modal.body);
  if (!open) return null;

  const showTextDialog = Boolean(modal.title || modal.body) || !modal.blockId;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-stone-950/45 p-4 sm:items-center"
      role="presentation"
      onClick={closeModal}
    >
      {showTextDialog ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={modal.title || (uiLang === "ar" ? "نافذة" : "Dialog")}
          className="relative z-[85] max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-700 dark:bg-stone-950"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-50">
              {modal.title || (uiLang === "ar" ? "نافذة" : "Dialog")}
            </h2>
            <button
              ref={closeRef}
              type="button"
              onClick={closeModal}
              className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-800 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-100"
            >
              {uiLang === "ar" ? "إغلاق" : "Close"}
            </button>
          </div>
          {modal.body ? (
            <p className="whitespace-pre-wrap text-sm leading-6 text-stone-700 dark:text-stone-200">{modal.body}</p>
          ) : null}
          {modal.blockId && !modal.body ? (
            <p className="text-[11px] text-stone-600 dark:text-stone-400">
              {uiLang === "ar" ? "تم فتح القسم المحدد على الصفحة." : "The selected section is shown on the page."}
            </p>
          ) : null}
        </div>
      ) : (
        <button
          ref={closeRef}
          type="button"
          className="absolute end-4 top-4 z-[90] rounded-full bg-white px-3 py-2 text-xs font-bold text-stone-900 shadow dark:bg-stone-900 dark:text-stone-50"
          onClick={(e) => {
            e.stopPropagation();
            closeModal();
          }}
        >
          {uiLang === "ar" ? "إغلاق" : "Close"}
        </button>
      )}
    </div>
  );
}
