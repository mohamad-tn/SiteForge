"use client";

import { useMemo, useState } from "react";
import {
  ELEMENT_TYPES,
  SECTION_TYPES,
  blockMetaDescription,
  blockMetaLabel,
  blockMetaSearchText,
  type BlockType,
} from "@/lib/design";
import { SearchField } from "@/components/ui/search-field";
import { usePlatformLang } from "@/components/platform-lang-provider";

export function InsertPalette({
  onInsert,
  mode = "all",
}: {
  onInsert: (type: BlockType) => void;
  mode?: "all" | "sections" | "elements";
}) {
  const [q, setQ] = useState("");
  const { t, lang } = usePlatformLang();

  const groups = useMemo(() => {
    const sections = mode === "elements" ? [] : SECTION_TYPES;
    const elements = mode === "sections" ? [] : ELEMENT_TYPES;
    const needle = q.trim().toLowerCase();
    const filter = (types: BlockType[]) =>
      types.filter((tpe) => {
        if (!needle) return true;
        return blockMetaSearchText(tpe).toLowerCase().includes(needle);
      });
    return [
      { key: "sections", title: t("paletteSections"), types: filter(sections) },
      { key: "elements", title: t("paletteElements"), types: filter(elements) },
    ].filter((g) => g.types.length > 0);
  }, [q, mode, t]);

  return (
    <div className="flex flex-col gap-2">
      <SearchField
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={mode === "all" ? t("paletteSearchAll") : t("paletteSearch")}
        aria-label={mode === "all" ? t("paletteSearchAll") : t("paletteSearch")}
        className="h-8 text-xs"
      />
      {groups.map((g) => (
        <div key={g.key} className="min-w-0">
          {mode === "all" ? (
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              {g.title}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-1">
            {g.types.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onInsert(type)}
                className="group rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-start shadow-[0_1px_0_rgba(28,25,23,0.04)] transition hover:-translate-y-px hover:border-teal-700/40 hover:bg-teal-50/80 hover:shadow-sm dark:shadow-none dark:hover:bg-teal-950/40"
              >
                <div
                  className="text-[11px] font-semibold leading-snug text-[var(--foreground)] group-hover:text-teal-900 dark:group-hover:text-teal-100"
                  lang={lang}
                >
                  {blockMetaLabel(type, lang)}
                </div>
                <div
                  className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[var(--muted)] group-hover:text-[var(--foreground)]"
                  lang={lang}
                >
                  {blockMetaDescription(type, lang)}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-4 text-center">
          <p className="text-xs text-[var(--muted)]">{t("paletteEmpty")}</p>
        </div>
      ) : null}
    </div>
  );
}
