"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { filterCollectionItems, matchCollectionItemId } from "@/lib/collection-filter";

type Item = { id: string; data: Record<string, unknown>; sort: number };

function fieldStr(data: Record<string, unknown>, key: string) {
  const v = data[key];
  return typeof v === "string" ? v : "";
}

export function CollectionListView({
  siteSlug,
  collectionSlug,
  title,
  subtitle,
  columns,
  limit,
  cardTitleField,
  cardBodyField,
  cardImageField,
  cardUrlField,
  primary,
  secondary,
  muted,
  bg,
  surface,
  radius,
  blockGap,
  fontsHeading,
  locale = "ar",
}: {
  siteSlug: string;
  collectionSlug: string;
  title: string;
  subtitle: string;
  columns: string;
  limit: string;
  cardTitleField: string;
  cardBodyField: string;
  cardImageField: string;
  cardUrlField: string;
  primary: string;
  secondary: string;
  muted: string;
  bg: string;
  surface: string;
  radius: number;
  blockGap: number;
  fontsHeading: string;
  locale?: string;
}) {
  const uiAr = locale === "ar";
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState("");
  const [focusSlug, setFocusSlug] = useState("");
  const [focusItem, setFocusItem] = useState("");
  const [query, setQuery] = useState("");
  const focused = Boolean(focusSlug && focusSlug === collectionSlug);
  const sectionRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const hash = window.location.hash.replace(/^#/, "");
      const fromQuery = q.get("collection") || "";
      const fromHash = hash.startsWith("collection-")
        ? decodeURIComponent(hash.slice("collection-".length))
        : "";
      setFocusSlug(fromQuery || fromHash);
      const item = (q.get("item") || "").trim();
      setFocusItem(item);
    } catch {
      setFocusSlug("");
      setFocusItem("");
    }
  }, [collectionSlug]);

  useEffect(() => {
    if (!focused || !sectionRef.current) return;
    const el = sectionRef.current;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [focused, collectionSlug]);

  useEffect(() => {
    if (!focusItem || !items?.length) return;
    const el =
      itemRefs.current[focusItem] ||
      items
        .map((it) => {
          const titleVal = fieldStr(it.data || {}, cardTitleField);
          const slugish = titleVal.toLowerCase().replace(/\s+/g, "-");
          if (it.id === focusItem || slugish === focusItem.toLowerCase()) return itemRefs.current[it.id];
          return null;
        })
        .find(Boolean);
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [focusItem, items, cardTitleField]);

  useEffect(() => {
    if (!siteSlug || !collectionSlug) return;
    let cancelled = false;
    fetch(`/api/s/${encodeURIComponent(siteSlug)}/collections/${encodeURIComponent(collectionSlug)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("fail");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const list = (data.collection?.items || []) as Item[];
        const lim = Math.max(1, Number(limit) || 6);
        setItems(list.slice(0, lim));
      })
      .catch(() => {
        if (!cancelled) {
          setErr(uiAr ? "تعذّر تحميل المجموعة" : "Could not load this collection");
          setItems([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [siteSlug, collectionSlug, limit, uiAr]);

  const filtered = useMemo(() => {
    if (!items) return null;
    return filterCollectionItems(items, query, cardTitleField, cardBodyField);
  }, [items, query, cardTitleField, cardBodyField]);

  const grid =
    columns === "2" ? "md:grid-cols-2" : columns === "4" ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3";

  function isHighlighted(it: Item) {
    return matchCollectionItemId(it, focusItem, cardTitleField);
  }

  return (
    <section
      ref={sectionRef}
      id={collectionSlug ? `collection-${collectionSlug}` : undefined}
      data-sf-collection={collectionSlug || undefined}
      data-sf-collection-focus={focused ? "true" : undefined}
      className="scroll-mt-24 px-5 md:px-8"
      style={{
        paddingTop: 72,
        paddingBottom: 72,
        background: surface,
        outline: focused ? `2px solid ${primary}` : undefined,
        outlineOffset: focused ? 4 : undefined,
      }}
    >
      <div className="mx-auto w-full" style={{ maxWidth: 1120 }}>
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-2xl font-bold md:text-3xl" style={{ color: secondary, fontFamily: fontsHeading }}>
            {title}
          </h2>
          {subtitle ? (
            <p className="text-sm md:text-base" style={{ color: muted }}>
              {subtitle}
            </p>
          ) : null}
        </div>

        {items && items.length > 0 ? (
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="block min-w-0 flex-1">
              <span className="sr-only">{uiAr ? "بحث في المجموعة" : "Search collection"}</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={uiAr ? "ابحث بالعنوان…" : "Filter by title…"}
                className="h-11 w-full rounded-full border px-4 text-sm outline-none focus-visible:ring-2"
                style={{
                  borderColor: `${secondary}22`,
                  background: bg,
                  color: secondary,
                  outlineColor: primary,
                }}
                dir={uiAr ? "rtl" : "ltr"}
              />
            </label>
            <div className="text-[11px] font-semibold" style={{ color: muted }}>
              {filtered ? filtered.length : 0}/{items.length}
            </div>
          </div>
        ) : null}

        {items === null ? (
          <div className="text-center text-sm" style={{ color: muted }}>
            {uiAr ? "جاري التحميل…" : "Loading…"}
          </div>
        ) : err ? (
          <div className="text-center text-sm" style={{ color: muted }}>
            {err}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-sm" style={{ color: muted }}>
            {uiAr ? "لا توجد عناصر منشورة في هذه المجموعة بعد" : "No published items in this collection yet"}
          </div>
        ) : filtered && filtered.length === 0 ? (
          <div className="text-center text-sm" style={{ color: muted }}>
            {uiAr ? "لا نتائج لهذا البحث" : "No items match this filter"}
          </div>
        ) : (
          <div className={`grid gap-4 ${grid}`} style={{ gap: blockGap }}>
            {(filtered || []).map((it) => {
              const data = (it.data || {}) as Record<string, unknown>;
              const t = fieldStr(data, cardTitleField) || (uiAr ? "بدون عنوان" : "Untitled");
              const body = fieldStr(data, cardBodyField);
              const img = fieldStr(data, cardImageField);
              const url = fieldStr(data, cardUrlField);
              const hi = isHighlighted(it);
              const Card = (
                <div
                  ref={(node) => {
                    itemRefs.current[it.id] = node;
                  }}
                  data-sf-collection-item={it.id}
                  data-sf-item-focus={hi ? "true" : undefined}
                  className="flex h-full flex-col overflow-hidden border transition-shadow hover:shadow-md"
                  style={{
                    background: bg,
                    borderColor: hi ? primary : `${secondary}10`,
                    borderRadius: radius,
                    boxShadow: hi ? `0 0 0 2px ${primary}` : undefined,
                  }}
                >
                  <div
                    className="aspect-[16/10] w-full"
                    style={{
                      background: img ? undefined : `linear-gradient(135deg, ${primary}33, ${secondary}88)`,
                    }}
                  >
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={t} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-2 font-semibold" style={{ color: secondary }}>
                      {t}
                    </div>
                    {body ? (
                      <p className="flex-1 text-sm leading-7" style={{ color: muted }}>
                        {body}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
              return url ? (
                <a key={it.id} href={url} className="block no-underline" target="_blank" rel="noopener noreferrer">
                  {Card}
                </a>
              ) : (
                <div key={it.id}>{Card}</div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
