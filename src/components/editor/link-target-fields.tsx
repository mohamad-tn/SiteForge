"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { usePlatformLang } from "@/components/platform-lang-provider";
import { normalizeActionType, type ButtonActionType } from "@/lib/design";

type CollectionOpt = { id: string; name: string; slug: string; _count?: { items: number } };
type ItemOpt = { id: string; data: Record<string, unknown>; published: boolean };

export function LinkTargetFields({
  props,
  hrefKey,
  pages,
  siteId,
  onUpdateProp,
}: {
  props: Record<string, unknown>;
  hrefKey: string;
  pages: { slug: string; title: string }[];
  siteId?: string;
  onUpdateProp: (key: string, value: string) => void;
}) {
  const { t } = usePlatformLang();
  const actionType = normalizeActionType(props.actionType);
  const mode = String(props.linkMode || "url");
  const [collections, setCollections] = useState<CollectionOpt[]>([]);
  const [items, setItems] = useState<ItemOpt[]>([]);
  const [loading, setLoading] = useState(false);

  const collectionSlug = String(props.linkCollectionSlug || "");
  const isLinkAction = actionType === "link";

  useEffect(() => {
    if (!siteId || !isLinkAction || mode !== "collection") return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/sites/${siteId}/collections`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setCollections(data.collections || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId, mode, isLinkAction]);

  useEffect(() => {
    if (isLinkAction && mode === "collection" && !collectionSlug && collections[0]?.slug) {
      onUpdateProp("linkCollectionSlug", collections[0].slug);
    }
  }, [mode, collectionSlug, collections, onUpdateProp, isLinkAction]);

  useEffect(() => {
    if (!siteId || !isLinkAction || mode !== "collection" || !collectionSlug) {
      setItems([]);
      return;
    }
    const col = collections.find((c) => c.slug === collectionSlug);
    if (!col) {
      setItems([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/sites/${siteId}/collections/${col.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setItems(data.collection?.items || []);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId, mode, collectionSlug, collections, isLinkAction]);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] text-[var(--muted)]">{t("actionTypeLabel")}</Label>
        <Select
          value={actionType}
          onValueChange={(v) => onUpdateProp("actionType", v as ButtonActionType)}
          options={[
            { value: "link", label: t("actionTypeLink") },
            { value: "toggleTheme", label: t("actionTypeToggleTheme") },
            { value: "cycleLocale", label: t("actionTypeCycleLocale") },
          ]}
        />
        <p className="text-[10px] leading-4 text-[var(--muted)]">{t("actionTypeHint")}</p>
      </div>

      {!isLinkAction ? (
        <p className="rounded-xl border border-teal-700/15 bg-teal-50/50 px-2.5 py-2 text-[10px] leading-4 text-[var(--foreground)] dark:border-teal-400/20 dark:bg-teal-950/30">
          {actionType === "toggleTheme" ? t("actionTypeToggleThemeHelp") : t("actionTypeCycleLocaleHelp")}
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-[var(--muted)]">{t("tipLink")}</Label>
            <Select
              value={mode}
              onValueChange={(v) => onUpdateProp("linkMode", v)}
              options={[
                { value: "url", label: t("linkModeUrl") },
                { value: "page", label: t("linkModePage") },
                { value: "collection", label: t("linkModeCollection") },
              ]}
            />
          </div>

          {mode === "page" ? (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-[var(--muted)]">{t("linkTargetPage")}</Label>
              <Select
                value={String(props.linkPageSlug || pages[0]?.slug || "home")}
                onValueChange={(v) => onUpdateProp("linkPageSlug", v)}
                options={
                  pages.length
                    ? pages.map((p) => ({ value: p.slug, label: `${p.title} (${p.slug})` }))
                    : [{ value: "home", label: "home" }]
                }
              />
            </div>
          ) : null}

          {mode === "collection" ? (
            <div className="space-y-3">
              <p className="rounded-xl border border-teal-700/15 bg-teal-50/50 px-2.5 py-2 text-[10px] leading-4 text-[var(--foreground)] dark:border-teal-400/20 dark:bg-teal-950/30">
                {t("linkCollectionHelp")}
              </p>
              {loading ? (
                <p className="text-[11px] text-[var(--muted)]">{t("linkCollectionLoading")}</p>
              ) : collections.length === 0 ? (
                <p className="text-[11px] text-[var(--muted)]">{t("linkCollectionEmpty")}</p>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-[var(--muted)]">{t("linkCollectionPick")}</Label>
                  <Select
                    value={collectionSlug || collections[0]?.slug || ""}
                    onValueChange={(v) => {
                      onUpdateProp("linkCollectionSlug", v);
                      onUpdateProp("linkCollectionItemHref", "");
                      onUpdateProp("linkCollectionItemId", "");
                    }}
                    options={collections.map((c) => ({
                      value: c.slug,
                      label: `${c.name} (/${c.slug})`,
                    }))}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-[var(--muted)]">{t("linkCollectionPage")}</Label>
                <Select
                  value={String(props.linkPageSlug || pages[0]?.slug || "home")}
                  onValueChange={(v) => onUpdateProp("linkPageSlug", v)}
                  options={
                    pages.length
                      ? pages.map((p) => ({ value: p.slug, label: `${p.title} (${p.slug})` }))
                      : [{ value: "home", label: "home" }]
                  }
                />
              </div>
              {items.length > 0 ? (
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-[var(--muted)]">{t("linkCollectionItem")}</Label>
                  <Select
                    value={String(props.linkCollectionItemId || "__none__")}
                    onValueChange={(v) => {
                      if (v === "__none__") {
                        onUpdateProp("linkCollectionItemId", "");
                        onUpdateProp("linkCollectionItemHref", "");
                        return;
                      }
                      const it = items.find((x) => x.id === v);
                      const url = typeof it?.data?.url === "string" ? it.data.url : "";
                      onUpdateProp("linkCollectionItemId", v);
                      onUpdateProp("linkCollectionItemHref", url || "");
                    }}
                    options={[
                      { value: "__none__", label: t("linkCollectionItemNone") },
                      ...items.map((it) => ({
                        value: it.id,
                        label: `${String(it.data?.title || it.id)}${typeof it.data?.url === "string" && it.data.url ? ` → ${it.data.url}` : ""}`,
                      })),
                    ]}
                  />
                </div>
              ) : null}
              <p className="text-[10px] leading-4 text-[var(--muted)]">{t("cmsBindHint")}</p>
            </div>
          ) : null}

          {mode === "url" ? (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-[var(--muted)]">
                {t("linkHrefLabel")} {hrefKey ? `(${hrefKey})` : ""}
              </Label>
              <Input
                value={String(props[hrefKey] ?? "")}
                onChange={(e) => onUpdateProp(hrefKey, e.target.value)}
                className="h-10 rounded-2xl font-mono text-sm"
                dir="ltr"
                placeholder="https://… أو #section"
              />
            </div>
          ) : null}

          <label className="flex items-center gap-2 rounded-2xl border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              className="accent-teal-700"
              checked={String(props.openInNewTab) === "true"}
              onChange={(e) => onUpdateProp("openInNewTab", e.target.checked ? "true" : "false")}
            />
            {t("linkOpenNewTab")}
          </label>
        </>
      )}
    </div>
  );
}
