"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlatformLangOptional } from "@/components/platform-lang-provider";

export type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  action: () => void;
};

export const SF_OPEN_COMMANDS_EVENT = "sf-open-command-palette";

/** Imperative open for chrome buttons (dashboard / editor). */
export function openCommandPalette() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SF_OPEN_COMMANDS_EVENT));
}

export function commandShortcutLabel(): string {
  if (typeof navigator === "undefined") return "⌘K";
  const isApple = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || "");
  return isApple ? "⌘K" : "Ctrl+K";
}

export function CommandPalette({
  items,
  open: controlledOpen,
  onOpenChange,
}: {
  items: CommandItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [q, setQ] = useState("");
  const { dir, t } = usePlatformLangOptional();
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? Boolean(controlledOpen) : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean | ((v: boolean) => boolean)) => {
      const value = typeof next === "function" ? next(open) : next;
      if (!isControlled) setUncontrolledOpen(value);
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange, open]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQ("");
      }
      if (e.key === "Escape") setOpen(false);
    }
    function onOpenEvent() {
      setOpen(true);
      setQ("");
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(SF_OPEN_COMMANDS_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SF_OPEN_COMMANDS_EVENT, onOpenEvent);
    };
  }, [setOpen]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => `${i.label} ${i.hint || ""}`.toLowerCase().includes(needle));
  }, [items, q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-stone-950/40 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)]"
        onClick={(e) => e.stopPropagation()}
        dir={dir}
        role="dialog"
        aria-modal="true"
        aria-label={t("commandPaletteTitle")}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchCommands")}
          className="w-full border-b border-stone-200 bg-transparent px-4 py-3 text-sm outline-none dark:border-stone-700"
        />
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-start text-sm hover:bg-teal-50 dark:hover:bg-teal-950/40"
              onClick={() => {
                setOpen(false);
                item.action();
              }}
            >
              <span className="font-medium">{item.label}</span>
              {item.hint ? <span className="text-[11px] text-[var(--muted)]">{item.hint}</span> : null}
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-[var(--muted)]">{t("noResults")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function useDashboardCommands() {
  const router = useRouter();
  return [
    { id: "new", label: "إنشاء موقع جديد", hint: "لوحة التحكم", action: () => router.push("/dashboard#create") },
    { id: "demo", label: "فتح الموقع التجريبي", action: () => window.open("/s/demo-studio", "_blank") },
    { id: "home", label: "الصفحة الرئيسية", action: () => router.push("/") },
  ] satisfies CommandItem[];
}
