"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchField } from "@/components/ui/search-field";

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
};

type ComboboxBaseProps = {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  dir?: "rtl" | "ltr";
};

/** Local searchable combobox (options already in memory). */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "—",
  searchPlaceholder,
  emptyLabel = "—",
  disabled,
  className,
  dir,
}: ComboboxBaseProps) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(needle) ||
        o.value.toLowerCase().includes(needle) ||
        (o.description || "").toLowerCase().includes(needle)
    );
  }, [options, q]);

  return (
    <div className={cn("relative", className)} ref={rootRef} dir={dir}>
      <button
        type="button"
        disabled={disabled}
        className="sf-field flex h-[var(--control-h)] w-full items-center justify-between gap-2 rounded-[var(--radius-lg)] px-3.5 text-sm font-medium"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={cn("min-w-0 truncate", !selected && "text-[var(--placeholder)]")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
      </button>
      {open ? (
        <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)]">
          <div className="border-b border-[var(--border)] p-2">
            <SearchField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
            />
          </div>
          <ul className="sf-scroll max-h-56 overflow-y-auto p-1.5" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-[var(--muted)]">{emptyLabel}</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-xl px-3 py-2 text-start text-sm hover:bg-[var(--surface)]",
                      o.value === value && "bg-teal-50 dark:bg-teal-950/40"
                    )}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                      setQ("");
                    }}
                  >
                    <Check
                      className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", o.value === value ? "opacity-100" : "opacity-0")}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{o.label}</span>
                      {o.description ? (
                        <span className="block truncate text-[11px] text-[var(--muted)]">{o.description}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export type RemoteComboboxProps = {
  value: string;
  onChange: (value: string, option?: ComboboxOption) => void;
  /** Called with query + page (1-based). Return options + whether more pages exist. */
  fetchPage: (args: { q: string; page: number }) => Promise<{
    options: ComboboxOption[];
    hasMore: boolean;
  }>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  dir?: "rtl" | "ltr";
  /** Optional selected label when value is set but not in loaded options yet. */
  selectedLabel?: string;
};

/**
 * Server-backed searchable combobox with infinite scroll.
 * Reuse for any dropdown that loads `/api/...؟q=&page=`.
 */
export function RemoteCombobox({
  value,
  onChange,
  fetchPage,
  placeholder = "—",
  searchPlaceholder,
  emptyLabel = "—",
  disabled,
  className,
  dir,
  selectedLabel,
}: RemoteComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [options, setOptions] = React.useState<ComboboxOption[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const load = React.useCallback(
    async (pageNum: number, query: string, append: boolean) => {
      setLoading(true);
      try {
        const res = await fetchPage({ q: query, page: pageNum });
        setOptions((prev) => (append ? [...prev, ...res.options] : res.options));
        setHasMore(res.hasMore);
        setPage(pageNum);
      } finally {
        setLoading(false);
      }
    },
    [fetchPage]
  );

  React.useEffect(() => {
    if (!open) return;
    void load(1, debouncedQ, false);
  }, [open, debouncedQ, load]);

  function onScroll() {
    const el = listRef.current;
    if (!el || loading || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      void load(page + 1, debouncedQ, true);
    }
  }

  const display = selected?.label || selectedLabel || (value ? value : null);

  return (
    <div className={cn("relative", className)} ref={rootRef} dir={dir}>
      <button
        type="button"
        disabled={disabled}
        className="sf-field flex h-[var(--control-h)] w-full items-center justify-between gap-2 rounded-[var(--radius-lg)] px-3.5 text-sm font-medium"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={cn("min-w-0 truncate", !display && "text-[var(--placeholder)]")}>
          {display || placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
      </button>
      {open ? (
        <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)]">
          <div className="border-b border-[var(--border)] p-2">
            <SearchField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
            />
          </div>
          <ul
            ref={listRef}
            className="sf-scroll max-h-56 overflow-y-auto p-1.5"
            role="listbox"
            onScroll={onScroll}
          >
            {options.length === 0 && !loading ? (
              <li className="px-3 py-4 text-center text-xs text-[var(--muted)]">{emptyLabel}</li>
            ) : (
              options.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-xl px-3 py-2 text-start text-sm hover:bg-[var(--surface)]",
                      o.value === value && "bg-teal-50 dark:bg-teal-950/40"
                    )}
                    onClick={() => {
                      onChange(o.value, o);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", o.value === value ? "opacity-100" : "opacity-0")}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{o.label}</span>
                      {o.description ? (
                        <span className="block truncate text-[11px] text-[var(--muted)]">{o.description}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))
            )}
            {loading ? (
              <li className="flex justify-center py-2 text-[var(--muted)]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
