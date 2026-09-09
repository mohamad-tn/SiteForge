"use client";

import { useMemo, useState } from "react";
import { BLOCK_META, ELEMENT_TYPES, SECTION_TYPES, type BlockType } from "@/lib/design";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function InsertPalette({
  onInsert,
  mode = "all",
}: {
  onInsert: (type: BlockType) => void;
  mode?: "all" | "sections" | "elements";
}) {
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const sections = mode === "elements" ? [] : SECTION_TYPES;
    const elements = mode === "sections" ? [] : ELEMENT_TYPES;
    const filter = (types: BlockType[]) =>
      types.filter((t) => {
        if (!q.trim()) return true;
        const m = BLOCK_META[t];
        const hay = `${m.label} ${m.description} ${t}`.toLowerCase();
        return hay.includes(q.trim().toLowerCase());
      });
    return [
      { key: "sections", title: "أقسام", types: filter(sections) },
      { key: "elements", title: "عناصر", types: filter(elements) },
    ].filter((g) => g.types.length > 0);
  }, [q, mode]);

  return (
    <div className="flex flex-col gap-3">
      <div className="sf-search">
        <Search />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={mode === "all" ? "بحث في المكتبة..." : "بحث..."}
          className="h-9 text-xs"
        />
      </div>
      {groups.map((g) => (
        <div key={g.key}>
          {mode === "all" ? (
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">{g.title}</div>
          ) : null}
          <div className="grid grid-cols-2 gap-1.5">
            {g.types.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onInsert(t)}
                className="group rounded-[var(--radius-lg)] border border-stone-200/80 bg-[var(--card)] px-2.5 py-2.5 text-start transition hover:border-teal-700/35 hover:bg-teal-50/70 dark:border-stone-700 dark:hover:bg-teal-950/40"
              >
                <div className="text-[11px] font-semibold text-stone-800 group-hover:text-teal-900 dark:text-stone-100">
                  {BLOCK_META[t].label}
                </div>
                <div className="text-[10px] text-stone-400 leading-snug mt-0.5 line-clamp-2">
                  {BLOCK_META[t].description}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
      {groups.length === 0 ? <p className="text-xs text-stone-400 text-center py-4">لا نتائج</p> : null}
    </div>
  );
}
