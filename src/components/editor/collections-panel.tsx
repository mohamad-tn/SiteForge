"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePlatformLang } from "@/components/platform-lang-provider";
import { MediaField } from "@/components/editor/media-field";
import { ChevronLeft, ExternalLink, Library } from "lucide-react";

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

export function CollectionsPanel({
  siteId,
  siteSlug,
}: {
  siteId: string;
  siteSlug?: string;
}) {
  const { t } = usePlatformLang();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("projects");
  const [msg, setMsg] = useState("");
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
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
    const data = await res.json().catch(() => ({}));
    const createdId = data.collection?.id as string | undefined;
    setMsg(t("cmsCreated"));
    await load();
    if (createdId) {
      setJustCreatedId(createdId);
      await loadItems(createdId);
    }
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

  const apiPath =
    siteSlug && active
      ? `/api/s/${siteSlug}/collections/${active.slug}`
      : active
        ? `/api/s/{site}/collections/${active.slug}`
        : "";
  const publicPath =
    siteSlug && active
      ? `/s/${siteSlug}?collection=${encodeURIComponent(active.slug)}#collection-${encodeURIComponent(active.slug)}`
      : "";

  return (
    <div className="sf-scroll space-y-4">
      <div className="rounded-2xl border border-teal-700/20 bg-teal-50/60 px-3 py-2.5 text-[11px] leading-5 text-stone-700 dark:border-teal-400/25 dark:bg-teal-950/35 dark:text-stone-200">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-teal-800 dark:text-teal-300">
          <Library className="h-3.5 w-3.5" aria-hidden />
          {t("openCms")}
        </div>
        {t("cmsHint")}
      </div>

      {!active ? (
        <>
          <div className="space-y-2 rounded-2xl border border-stone-300/80 bg-[var(--card)] p-3 dark:border-stone-700">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-600 dark:text-stone-400">
              {t("cmsNewCollection")}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-stone-600 dark:text-stone-300">{t("cmsName")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 rounded-2xl text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-stone-600 dark:text-stone-300">{t("cmsSlugLabel")}</Label>
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
                onClick={() => {
                  setJustCreatedId(null);
                  loadItems(c.id);
                }}
                className="w-full rounded-2xl border border-stone-300/70 bg-[var(--card)] px-3 py-2.5 text-start text-sm transition hover:border-teal-600/35 hover:bg-teal-50/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] dark:border-stone-700 dark:hover:bg-teal-950/25"
              >
                <div className="font-semibold text-stone-800 dark:text-stone-100">{c.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-mono text-stone-600 dark:text-stone-400" dir="ltr">
                  <span>/{c.slug}</span>
                  <span>·</span>
                  <span>
                    {c._count?.items ?? 0} {t("cmsItems")}
                  </span>
                </div>
                <div className="mt-1.5 text-[10px] font-semibold text-teal-800 dark:text-teal-300">
                  {t("cmsOpenManage")} →
                </div>
              </button>
            ))}
            {collections.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/70 px-3 py-6 text-center dark:border-stone-700 dark:bg-stone-950/40">
                <p className="text-xs font-semibold text-stone-700 dark:text-stone-200">{t("cmsEmpty")}</p>
                <p className="mt-1.5 text-[11px] leading-5 text-stone-600 dark:text-stone-400">{t("cmsEmptyNext")}</p>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] dark:text-teal-300"
            onClick={() => {
              setActiveId(null);
              setItems([]);
              setJustCreatedId(null);
            }}
          >
            <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
            {t("cmsBackToList")}
          </button>

          <div className="rounded-2xl border border-teal-600/30 bg-teal-50/70 px-3 py-2.5 text-[11px] leading-5 text-teal-950 dark:border-teal-400/30 dark:bg-teal-950/40 dark:text-teal-50">
            <div className="font-bold">{justCreatedId === active.id ? t("cmsAfterCreateTitle") : t("cmsHowToUseShort")}</div>
            <p className="mt-1">{t("cmsHowToUse")}</p>
            <button
              type="button"
              className="mt-2 w-full rounded-xl border border-teal-700/25 bg-white/80 px-2.5 py-2 text-start text-[11px] font-semibold text-teal-950 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] dark:border-teal-400/30 dark:bg-teal-950/50 dark:text-teal-50 dark:hover:bg-teal-950/70"
              onClick={() => setMsg(t("cmsBindButtonHint"))}
            >
              {t("cmsBindButtonHint")}
            </button>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-sm font-bold text-[var(--foreground)]">{active.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 font-mono text-[var(--foreground)]" dir="ltr">
                {active.slug}
              </span>
              <span className="sf-muted">
                {items.length} {t("cmsItems")}
              </span>
            </div>
            {publicPath ? (
              <div className="mt-2 flex items-start gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2">
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 sf-muted" aria-hidden />
                <div className="min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-[0.12em] sf-muted">
                    {t("view")} / preview
                  </div>
                  <a
                    href={publicPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate font-mono text-[10px] font-semibold text-teal-800 underline-offset-2 hover:underline dark:text-teal-300"
                    dir="ltr"
                  >
                    {publicPath}
                  </a>
                </div>
              </div>
            ) : null}
            {apiPath ? (
              <div className="mt-2 flex items-start gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2">
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 sf-muted" aria-hidden />
                <div className="min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-[0.12em] sf-muted">
                    {t("cmsPublicApi")}
                  </div>
                  <code className="block truncate font-mono text-[10px] text-[var(--foreground)]" dir="ltr">
                    {apiPath}
                  </code>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-2xl border border-stone-300/80 bg-[var(--card)] p-3 dark:border-stone-700">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-600 dark:text-stone-400">
              {t("cmsManageItems")} · {active.name}
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
                    <Label className="text-[11px] text-stone-600 dark:text-stone-300">{f.label}</Label>
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
              {items.length === 0 ? (
                <p className="py-3 text-center text-[11px] text-stone-600 dark:text-stone-400">{t("cmsNoItemsYet")}</p>
              ) : null}
              {items.map((it) => (
                <div
                  key={it.id}
                  className="rounded-xl border border-stone-300/70 px-2.5 py-2 text-xs dark:border-stone-700"
                >
                  <div className="font-semibold text-stone-800 dark:text-stone-100">
                    {String(it.data?.title || "—")}
                  </div>
                  {typeof it.data?.url === "string" && it.data.url ? (
                    <div className="mt-0.5 truncate font-mono text-[10px] text-stone-600 dark:text-stone-400" dir="ltr">
                      {it.data.url}
                    </div>
                  ) : null}
                  <div className="mt-1 flex gap-1">
                    <button
                      type="button"
                      className="font-semibold text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] dark:text-teal-300"
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
        </div>
      )}

      {msg ? <p className="text-[11px] font-medium text-teal-800 dark:text-teal-300">{msg}</p> : null}
    </div>
  );
}
