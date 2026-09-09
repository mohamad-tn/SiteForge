"use client";

import { useEffect, useState } from "react";

type Item = { id: string; data: Record<string, unknown>; sort: number };

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
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState("");

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
          setErr("تعذّر تحميل المجموعة");
          setItems([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [siteSlug, collectionSlug, limit]);

  const grid =
    columns === "2" ? "md:grid-cols-2" : columns === "4" ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3";

  function str(data: Record<string, unknown>, key: string) {
    const v = data[key];
    return typeof v === "string" ? v : "";
  }

  return (
    <section
      className="px-5 md:px-8"
      style={{ paddingTop: 72, paddingBottom: 72, background: surface }}
    >
      <div className="mx-auto w-full" style={{ maxWidth: 1120 }}>
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: secondary, fontFamily: fontsHeading }}>
            {title}
          </h2>
          {subtitle ? (
            <p className="text-sm md:text-base" style={{ color: muted }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {items === null ? (
          <div className="text-center text-sm" style={{ color: muted }}>
            جاري التحميل…
          </div>
        ) : err ? (
          <div className="text-center text-sm" style={{ color: muted }}>
            {err}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-sm" style={{ color: muted }}>
            لا توجد عناصر منشورة في هذه المجموعة بعد
          </div>
        ) : (
          <div className={`grid gap-4 ${grid}`} style={{ gap: blockGap }}>
            {items.map((it) => {
              const data = (it.data || {}) as Record<string, unknown>;
              const t = str(data, cardTitleField) || "بدون عنوان";
              const body = str(data, cardBodyField);
              const img = str(data, cardImageField);
              const url = str(data, cardUrlField);
              const Card = (
                <div
                  className="overflow-hidden border flex flex-col h-full transition-shadow hover:shadow-md"
                  style={{ background: bg, borderColor: `${secondary}10`, borderRadius: radius }}
                >
                  <div
                    className="aspect-[16/10] w-full"
                    style={{
                      background: img
                        ? undefined
                        : `linear-gradient(135deg, ${primary}33, ${secondary}88)`,
                    }}
                  >
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={t} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="font-semibold mb-2" style={{ color: secondary }}>
                      {t}
                    </div>
                    {body ? (
                      <p className="text-sm leading-7 flex-1" style={{ color: muted }}>
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
