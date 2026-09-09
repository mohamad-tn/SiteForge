"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AppCanvas, AppHeader, SoftCard, Toolbar } from "@/components/ui/surface";
import { SegmentedControl } from "@/components/ui/segmented";
import { ThemeToggleButton } from "@/components/theme-provider";
import { SignOutButton } from "@/components/sign-out-button";
import { CommandPalette, type CommandItem } from "@/components/command-palette";
import { PlatformLangSwitcher, usePlatformLang } from "@/components/platform-lang-provider";
import { CATEGORY_LABELS } from "@/lib/platform-i18n";
import { Copy, Download, Search, Upload } from "lucide-react";

type Template = {
  slug: string;
  nameAr: string;
  descriptionAr: string;
  category: string;
  thumbnail?: string | null;
};

type SiteRow = {
  id: string;
  name: string;
  slug: string;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

export function DashboardClient({
  userName,
  userEmail,
  isAdmin,
  initialTemplates,
  categories,
}: {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
  initialTemplates: Template[];
  categories: string[];
}) {
  const router = useRouter();
  const { lang: uiLang, dir, t: tp } = usePlatformLang();
  const t = {
    welcome: tp("welcome"),
    cmd: tp("cmd"),
    admin: tp("admin"),
    demo: tp("demo"),
    startTitle: tp("startTitle"),
    step1: tp("step1"),
    step2: tp("step2"),
    step3: tp("step3"),
    marketTitle: tp("marketTitle"),
    marketSub: tp("marketSub"),
    importJson: tp("importJson"),
    importing: tp("importing"),
    all: tp("all"),
    siteName: tp("siteName"),
    sitePlaceholder: tp("sitePlaceholder"),
    useTemplate: tp("useTemplate"),
    creating: tp("creating"),
    mySites: tp("mySites"),
    sitesCount: (n: number) => (uiLang === "ar" ? `${n} موقع` : `${n} site${n === 1 ? "" : "s"}`),
    search: tp("search"),
    filterAll: tp("filterAll"),
    published: tp("published"),
    draft: tp("draft"),
    sortUpdated: tp("sortUpdated"),
    sortName: tp("sortName"),
    sortCreated: tp("sortCreated"),
    loading: tp("loading"),
    emptyTitle: tp("emptyTitle"),
    emptyBody: tp("emptyBody"),
    openEditor: tp("openEditor"),
    view: tp("view"),
    prev: tp("prev"),
    next: tp("next"),
    updated: tp("updated"),
  };

  const [sites, setSites] = useState<SiteRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("updated");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [templateSlug, setTemplateSlug] = useState(initialTemplates[0]?.slug || "blank");
  const [category, setCategory] = useState("all");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  const filteredTemplates = useMemo(
    () => initialTemplates.filter((tpl) => (category === "all" ? true : tpl.category === category)),
    [initialTemplates, category]
  );

  const loadSites = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      q,
      status,
      sort,
      order: "desc",
      page: String(page),
      pageSize: "9",
    });
    const res = await fetch(`/api/sites?${params}`);
    const data = await res.json();
    setSites(data.sites || []);
    setTotal(data.total || 0);
    setPageCount(data.pageCount || 1);
    setLoading(false);
  }, [q, status, sort, page]);

  useEffect(() => {
    const timer = setTimeout(loadSites, 200);
    return () => clearTimeout(timer);
  }, [loadSites]);

  async function createSite(e?: React.FormEvent) {
    e?.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, templateSlug }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error || "تعذر الإنشاء");
      return;
    }
    router.push(`/editor/${data.site.id}`);
  }

  async function duplicateSite(id: string) {
    const res = await fetch(`/api/sites/${id}/duplicate`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      await loadSites();
      router.push(`/editor/${data.site.id}`);
    }
  }

  async function exportSite(id: string, slug: string) {
    const res = await fetch(`/api/sites/${id}/export`);
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.siteforge.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const content = parsed.content || parsed;
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parsed.name || tp("importedSite"),
          importContent: content,
        }),
      });
      const data = await res.json();
      if (res.ok) router.push(`/editor/${data.site.id}`);
      else setError(data.error || "فشل الاستيراد");
    } catch {
      setError(tp("invalidJson"));
    } finally {
      setImporting(false);
    }
  }

  const commands: CommandItem[] = [
    {
      id: "create",
      label: tp("goCreate"),
      action: () => document.getElementById("create")?.scrollIntoView({ behavior: "smooth" }),
    },
    {
      id: "refresh",
      label: tp("refreshSites"),
      action: () => loadSites(),
    },
    {
      id: "demo",
      label: tp("openDemo"),
      action: () => window.open("/s/demo-studio", "_blank"),
    },
    ...(isAdmin
      ? [
          {
            id: "admin",
            label: tp("platformAdmin"),
            action: () => router.push("/admin"),
          },
        ]
      : []),
  ];

  const checklist = [
    { done: total > 0, label: t.step1 },
    { done: total > 0, label: t.step2 },
    { done: sites.some((s) => s.publishedAt), label: t.step3 },
  ];

  return (
    <AppCanvas dir={dir} lang={uiLang}>
      <CommandPalette items={commands} />
      <AppHeader>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="min-w-0">
            <div className="truncate text-lg font-bold tracking-tight text-teal-900 dark:text-teal-300">
              SiteForge
            </div>
            <div className="truncate text-xs text-stone-500 dark:text-stone-400">
              {t.welcome} {userName || userEmail}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <PlatformLangSwitcher size="compact" />
            <span className="hidden text-[11px] text-stone-400 lg:inline">{t.cmd}</span>
            <ThemeToggleButton />
            {isAdmin ? (
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href="/admin">{t.admin}</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href="/s/demo-studio" target="_blank">
                {t.demo}
              </Link>
            </Button>
            <SignOutButton />
          </div>
        </div>
      </AppHeader>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {total === 0 ? (
          <SoftCard className="p-6">
            <h2 className="text-lg font-semibold tracking-tight">{t.startTitle}</h2>
            <ul className="mt-4 space-y-2.5">
              {checklist.map((c) => (
                <li
                  key={c.label}
                  className="flex items-start gap-2.5 text-sm text-stone-600 dark:text-stone-300"
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                      c.done ? "bg-teal-700 text-white" : "bg-stone-200 text-stone-500 dark:bg-stone-800"
                    }`}
                  >
                    {c.done ? "✓" : ""}
                  </span>
                  <span className="min-w-0 leading-6">{c.label}</span>
                </li>
              ))}
            </ul>
          </SoftCard>
        ) : null}

        <SoftCard id="create" className="scroll-mt-24 p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight">{t.marketTitle}</h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t.marketSub}</p>
            </div>
            <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-stone-200/90 bg-white px-3.5 py-2 text-xs font-medium shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-50 dark:hover:bg-stone-800">
              <Upload className="h-3.5 w-3.5 shrink-0" />
              <span>{importing ? t.importing : t.importJson}</span>
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importJson(f);
                }}
              />
            </label>
          </div>

          <div className="mb-5">
            <SegmentedControl
              className="max-w-full"
              aria-label={t.all}
              value={category}
              onChange={setCategory}
              items={[
                { value: "all", label: t.all },
                ...categories.map((c) => ({
                  value: c,
                  label: CATEGORY_LABELS[c]?.[uiLang] || c,
                })),
              ]}
            />
          </div>

          <form onSubmit={createSite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site-name">{t.siteName}</Label>
              <Input
                id="site-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.sitePlaceholder}
                required
              />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((tpl) => (
                <button
                  key={tpl.slug}
                  type="button"
                  onClick={() => setTemplateSlug(tpl.slug)}
                  className={`rounded-[1.35rem] border p-3.5 text-start transition ${
                    templateSlug === tpl.slug
                      ? "border-teal-700/40 bg-teal-50 ring-2 ring-teal-700/15 dark:bg-teal-950/40"
                      : "border-stone-200/80 bg-white/70 hover:border-stone-300 dark:border-stone-700 dark:bg-stone-900/50 dark:hover:border-stone-600"
                  }`}
                >
                  <div className="mb-2.5 aspect-[16/10] w-full overflow-hidden rounded-2xl bg-stone-100 dark:bg-stone-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tpl.thumbnail || `/templates/${tpl.slug}.svg`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800/70 dark:text-teal-300/80">
                    {CATEGORY_LABELS[tpl.category]?.[uiLang] || tpl.category}
                  </div>
                  <div className="mt-1 truncate font-medium text-stone-900 dark:text-stone-50">
                    {tpl.nameAr}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500 dark:text-stone-400">
                    {tpl.descriptionAr}
                  </div>
                </button>
              ))}
            </div>
            {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
            <Button type="submit" disabled={creating || !name.trim()} className="rounded-full">
              {creating ? t.creating : t.useTemplate}
            </Button>
          </form>
        </SoftCard>

        <section className="space-y-4">
          <SoftCard className="overflow-hidden">
            <div className="flex flex-col gap-1 border-b border-stone-200/70 px-5 py-4 dark:border-stone-800 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{t.mySites}</h2>
                <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{t.sitesCount(total)}</p>
              </div>
              {pageCount > 1 ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    {t.prev}
                  </Button>
                  <span className="min-w-[3.5rem] text-center text-xs tabular-nums text-stone-500">
                    {page} / {pageCount}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={page >= pageCount}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t.next}
                  </Button>
                </div>
              ) : null}
            </div>

            <Toolbar className="m-3 sm:m-4">
              <div className="sf-search">
                <Search />
                <Input
                  value={q}
                  onChange={(e) => {
                    setPage(1);
                    setQ(e.target.value);
                  }}
                  placeholder={t.search}
                  className="h-10 w-full min-w-0 rounded-2xl"
                  aria-label={t.search}
                />
              </div>

              <SegmentedControl
                className="shrink-0"
                aria-label="Status"
                value={status}
                onChange={(v) => {
                  setPage(1);
                  setStatus(v);
                }}
                items={[
                  { value: "all", label: t.filterAll },
                  { value: "published", label: t.published },
                  { value: "draft", label: t.draft },
                ]}
              />

              <Select
                wrapperClassName="w-full sm:w-[11.5rem] shrink-0"
                value={sort}
                onValueChange={setSort}
                aria-label={tp("sort")}
                options={[
                  { value: "updated", label: t.sortUpdated },
                  { value: "name", label: t.sortName },
                  { value: "created", label: t.sortCreated },
                ]}
              />
            </Toolbar>
          </SoftCard>

          {loading ? (
            <SoftCard className="p-8 text-sm text-stone-500">{t.loading}</SoftCard>
          ) : sites.length === 0 ? (
            <SoftCard className="p-8">
              <h3 className="font-semibold">{t.emptyTitle}</h3>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t.emptyBody}</p>
            </SoftCard>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sites.map((site) => (
                <SoftCard key={site.id} className="flex min-w-0 flex-col p-5">
                  <div className="mb-4 min-w-0">
                    <h3 className="truncate text-base font-semibold tracking-tight">{site.name}</h3>
                    <p className="mt-1 truncate font-mono text-xs text-stone-500" dir="ltr">
                      /s/{site.slug}
                    </p>
                    <p className="mt-2 text-[11px] leading-5 text-stone-400">
                      {site.publishedAt ? t.published : t.draft} · {t.updated}{" "}
                      {new Date(site.updatedAt).toLocaleString(uiLang === "ar" ? "ar" : "en")}
                    </p>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" className="rounded-full">
                      <Link href={`/editor/${site.id}`}>{t.openEditor}</Link>
                    </Button>
                    {site.publishedAt ? (
                      <Button asChild size="sm" variant="outline" className="rounded-full">
                        <Link href={`/s/${site.slug}`} target="_blank">
                          {t.view}
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline" className="rounded-full" title={tp("previewDraftHint")}>
                        <Link href={`/editor/${site.id}/preview`} target="_blank">
                          {tp("preview")}
                        </Link>
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full"
                      onClick={() => duplicateSite(site.id)}
                      title={tp("duplicate")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full"
                      onClick={() => exportSite(site.id, site.slug)}
                      title={tp("exportJson")}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </SoftCard>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppCanvas>
  );
}
