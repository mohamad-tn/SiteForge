"use client";

import { useMemo, useState } from "react";
import { BLOCK_META, ELEMENT_TYPES, SECTION_TYPES, type BlockType } from "@/lib/design";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePlatformLang } from "@/components/platform-lang-provider";

export function InsertPalette({
  onInsert,
  mode = "all",
}: {
  onInsert: (type: BlockType) => void;
  mode?: "all" | "sections" | "elements";
}) {
  const [q, setQ] = useState("");
  const { t } = usePlatformLang();

  const groups = useMemo(() => {
    const sections = mode === "elements" ? [] : SECTION_TYPES;
    const elements = mode === "sections" ? [] : ELEMENT_TYPES;
    const filter = (types: BlockType[]) =>
      types.filter((tpe) => {
        if (!q.trim()) return true;
        const m = BLOCK_META[tpe];
        const hay = `${m.label} ${m.description} ${tpe}`.toLowerCase();
        return hay.includes(q.trim().toLowerCase());
      });
    return [
      { key: "sections", title: t("paletteSections"), types: filter(sections) },
      { key: "elements", title: t("paletteElements"), types: filter(elements) },
    ].filter((g) => g.types.length > 0);
  }, [q, mode, t]);

  return (
    <div className="flex flex-col gap-3">
      <div className="sf-search">
        <Search />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={mode === "all" ? t("paletteSearchAll") : t("paletteSearch")}
          className="h-9 text-xs"
          aria-label={mode === "all" ? t("paletteSearchAll") : t("paletteSearch")}
        />
      </div>
      {groups.map((g) => (
        <div key={g.key}>
          {mode === "all" ? (
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">{g.title}</div>
          ) : null}
          <div className="grid grid-cols-2 gap-1.5">
            {g.types.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onInsert(type)}
                className="group rounded-[var(--radius-lg)] border border-stone-200/80 bg-[var(--card)] px-2.5 py-2.5 text-start shadow-[0_1px_0_rgba(28,25,23,0.04)] transition hover:-translate-y-0.5 hover:border-teal-700/40 hover:bg-teal-50/80 hover:shadow-sm dark:border-stone-700 dark:shadow-none dark:hover:bg-teal-950/40"
              >
                <div className="text-[11px] font-semibold text-stone-800 group-hover:text-teal-900 dark:text-stone-100 dark:group-hover:text-teal-100">
                  {BLOCK_META[type].label}
                </div>
                <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-stone-400 group-hover:text-stone-500 dark:group-hover:text-stone-400">
                  {BLOCK_META[type].description}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300/80 bg-stone-50/50 px-3 py-6 text-center dark:border-stone-700 dark:bg-stone-950/40">
          <p className="text-xs text-stone-500 dark:text-stone-400">{t("paletteEmpty")}</p>
        </div>
      ) : null}
    </div>
  );
}
