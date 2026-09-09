"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePlatformLang } from "@/components/platform-lang-provider";
import { MediaField } from "@/components/editor/media-field";

type FieldDef = { key: string; label: string; type: "text" | "richtext" | "image" | "url" };
type Collection = {
  id: string;
  name: string;
  slug: string;
  fields: FieldDef[];
  _count?: { items: number };
  items?: Item[];
};
type Item = { id: string; data: Record<string, unknown>; sort: number; published: boolean };

export function CollectionsPanel({ siteId }: { siteId: string }) {
  const { t } = usePlatformLang();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("projects");
  const [msg, setMsg] = useState("");
  const [itemDraft, setItemDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setName((prev) => (prev ? prev : t("cmsDefaultName")));
  }, [t]);

  const defaultFields = useMemo<FieldDef[]>(
    () => [
      { key: "title", label: t("cmsFieldTitle"), type: "text" },
      { key: "summary", label: t("cmsFieldSummary"), type: "richtext" },
      { key: "image", label: t("cmsFieldImage"), type: "image" },
      { key: "url", label: t("cmsFieldUrl"), type: "url" },
    ],
    [t]
  );

  const load = useCallback(async () => {
    const res = await fetch(`/api/sites/${siteId}/collections`);
    if (!res.ok) return;
    const data = await res.json();
    setCollections(data.collections || []);
  }, [siteId]);

  const loadItems = useCallback(
    async (collectionId: string) => {
      const res = await fetch(`/api/sites/${siteId}/collections/${collectionId}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.collection?.items || []);
      setActiveId(collectionId);
    },
    [siteId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const active = collections.find((c) => c.id === activeId) || null;
  const fields: FieldDef[] = Array.isArray(active?.fields)
    ? (active!.fields as FieldDef[])
    : defaultFields;

  async function createCollection() {
    setMsg("");
    const res = await fetch(`/api/sites/${siteId}/collections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name || t("cmsDefaultName"),
        slug,
        fields: defaultFields,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error || t("cmsCreateFailed"));
      return;
    }
    setMsg(t("cmsCreated"));
    await load();
  }

  async function addItem() {
    if (!activeId) return;
    const res = await fetch(`/api/sites/${siteId}/collections/${activeId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: itemDraft, published: true }),
    });
    if (!res.ok) {
      setMsg(t("cmsAddItemFailed"));
      return;
    }
    setItemDraft({});
    setMsg(t("cmsItemAdded"));
    await loadItems(activeId);
    await load();
  }

  async function togglePublished(item: Item) {
    if (!activeId) return;
    await fetch(`/api/sites/${siteId}/collections/${activeId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !item.published }),
    });
    await loadItems(activeId);
  }

  async function deleteItem(itemId: string) {
    if (!activeId) return;
    await fetch(`/api/sites/${siteId}/collections/${activeId}/items/${itemId}`, { method: "DELETE" });
    await loadItems(activeId);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-teal-700/15 bg-teal-50/50 px-3 py-2 text-[11px] leading-5 text-stone-600 dark:bg-teal-950/30 dark:text-stone-300">
        {t("cmsHint")}
      </div>

      <div className="space-y-2 rounded-2xl border border-stone-200/80 p-3 dark:border-stone-800">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">
          {t("cmsNewCollection")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px]">{t("cmsName")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 rounded-2xl text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Slug</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="h-9 rounded-2xl font-mono text-sm"
              dir="ltr"
            />
          </div>
        </div>
        <Button size="sm" className="rounded-full" onClick={createCollection}>
          {t("cmsCreate")}
        </Button>
      </div>

      <div className="space-y-1">
        {collections.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => loadItems(c.id)}
            className={`w-full rounded-2xl border px-3 py-2.5 text-start text-sm transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] ${
              activeId === c.id
                ? "border-teal-600/40 bg-teal-50 dark:bg-teal-950/40"
                : "border-stone-200/70 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"
            }`}
          >
            <div className="font-semibold">{c.name}</div>
            <div className="text-[10px] font-mono text-stone-400" dir="ltr">
              {c.slug} · {c._count?.items ?? 0} {t("cmsItems")}
            </div>
          </button>
        ))}
        {collections.length === 0 ? (
          <p className="py-4 text-center text-xs text-stone-400">{t("cmsEmpty")}</p>
        ) : null}
      </div>

      {active ? (
        <div className="space-y-3 rounded-2xl border border-stone-200/80 p-3 dark:border-stone-800">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">
            {t("cmsItems")} · {active.name}
          </div>
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              {f.type === "image" ? (
                <MediaField
                  label={f.label}
                  value={itemDraft[f.key] || ""}
                  onChange={(url) => setItemDraft((d) => ({ ...d, [f.key]: url }))}
                  kind="image"
                  accept="image/*"
                />
              ) : (
                <>
                  <Label className="text-[11px]">{f.label}</Label>
                  {f.type === "richtext" ? (
                    <Textarea
                      value={itemDraft[f.key] || ""}
                      onChange={(e) => setItemDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                      className="min-h-[64px] rounded-2xl text-sm"
                    />
                  ) : (
                    <Input
                      value={itemDraft[f.key] || ""}
                      onChange={(e) => setItemDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                      className="h-9 rounded-2xl text-sm"
                      dir={f.type === "url" ? "ltr" : "auto"}
                    />
                  )}
                </>
              )}
            </div>
          ))}
          <Button size="sm" variant="outline" className="rounded-full" onClick={addItem}>
            {t("cmsAddItem")}
          </Button>

          <div className="space-y-1.5 pt-2">
            {items.map((it) => (
              <div
                key={it.id}
                className="rounded-xl border border-stone-200/70 px-2.5 py-2 text-xs dark:border-stone-800"
              >
                <div className="font-semibold">{String(it.data?.title || "—")}</div>
                <div className="mt-1 flex gap-1">
                  <button
                    type="button"
                    className="font-semibold text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    onClick={() => togglePublished(it)}
                  >
                    {it.published ? t("published") : t("draft")}
                  </button>
                  <button
                    type="button"
                    className="ms-auto font-semibold text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    onClick={() => deleteItem(it.id)}
                  >
                    {t("delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {msg ? <p className="text-[11px] font-medium text-teal-800">{msg}</p> : null}
    </div>
  );
}
