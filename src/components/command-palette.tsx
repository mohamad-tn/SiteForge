"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlatformLangOptional } from "@/components/platform-lang-provider";

export type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  action: () => void;
};

export function CommandPalette({ items }: { items: CommandItem[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { dir, t } = usePlatformLangOptional();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQ("");
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => `${i.label} ${i.hint || ""}`.toLowerCase().includes(needle));
  }, [items, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-stone-950/40 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-white/50 bg-white/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)] dark:border-stone-700 dark:bg-stone-900/95"
        onClick={(e) => e.stopPropagation()}
        dir={dir}
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
              {item.hint ? <span className="text-[11px] text-stone-400">{item.hint}</span> : null}
            </button>
          ))}
          {filtered.length === 0 ? <p className="p-4 text-center text-xs text-stone-400">{t("noResults")}</p> : null}
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
