"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AppCanvas, AppHeader, SoftCard, StatCard, Toolbar, Shell } from "@/components/ui/surface";
import { SegmentedControl } from "@/components/ui/segmented";
import { ThemeToggleButton } from "@/components/theme-provider";
import { SignOutButton } from "@/components/sign-out-button";
import { CommandPalette, openCommandPalette, type CommandItem } from "@/components/command-palette";
import { PlatformLangSwitcher, usePlatformLang } from "@/components/platform-lang-provider";
import { CATEGORY_LABELS } from "@/lib/platform-i18n";
import { Copy, Download, Upload, Plus, LayoutTemplate, ArrowRight, Trash2 } from "lucide-react";
import { SearchField } from "@/components/ui/search-field";

type Template = {
  id?: string;
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
    skipToContent: tp("skipToContent"),
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
  const [deleteTarget, setDeleteTarget] = useState<SiteRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [templates] = useState(initialTemplates);

  const filteredTemplates = useMemo(
    () => templates.filter((tpl) => (category === "all" ? true : tpl.category === category)),
    [templates, category]
  );

  const siteConfirmWord = uiLang === "ar" ? "حذف" : "delete";
  const siteConfirmOk =
    uiLang === "ar"
      ? deleteConfirm.trim() === siteConfirmWord
      : deleteConfirm.trim().toLowerCase() === siteConfirmWord;

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

  async function confirmDeleteSite() {
    if (!deleteTarget || !siteConfirmOk || deleting) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/sites/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || tp("deleteFailed"));
        return;
      }
      setDeleteTarget(null);
      setDeleteConfirm("");
      await loadSites();
    } finally {
      setDeleting(false);
    }
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
  const publishedCount = sites.filter((s) => s.publishedAt).length;
  const publishedShown = status === "published" ? total : status === "draft" ? 0 : publishedCount;
  const draftShown = status === "draft" ? total : status === "published" ? 0 : Math.max(0, total - publishedCount);

  return (
    <AppCanvas dir={dir} lang={uiLang}>
      <CommandPalette items={commands} />
      <a
        href="#sf-dash-main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-teal-800 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        {t.skipToContent}
      </a>
      <AppHeader>
        <Shell className="flex flex-wrap items-center justify-between gap-2 py-3 sm:gap-3">
          <div className="min-w-0 flex-1 basis-[12rem]">
            <div className="truncate text-base font-bold tracking-tight text-teal-900 dark:text-teal-300">
              SiteForge
            </div>
            <div className="truncate text-xs leading-5 text-[var(--muted)]">
              {t.welcome} {userName || userEmail}
            </div>
          </div>
          <div className="sf-header-actions flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <PlatformLangSwitcher size="compact" />
            <button
              type="button"
              onClick={() => openCommandPalette()}
              title={tp("commandPaletteTitle")}
              aria-label={tp("commandPaletteTitle")}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted)] transition hover:border-teal-700/30 hover:text-[var(--foreground)]"
            >
              <span className="hidden sm:inline">{tp("commands")}</span>
              <kbd className="sf-latin rounded-md bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--foreground)]" dir="ltr">
                ⌘K
              </kbd>
            </button>
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
        </Shell>
      </AppHeader>

      <Shell
        id="sf-dash-main"
        className="space-y-[var(--sf-section-gap)] py-6 sm:py-8"
      >
        {isAdmin ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-teal-800/15 bg-teal-50/60 px-4 py-3 dark:border-teal-400/20 dark:bg-teal-950/30">
            <div className="min-w-0 text-sm text-[var(--foreground)]">
              <span className="font-semibold">{tp("adminOpsStripTitle")}</span>
              <span className="ms-2 text-[var(--muted)]">{tp("adminOpsStripBody")}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" className="rounded-full">
                <Link href="/admin">{t.admin}</Link>
              </Button>
            </div>
          </div>
        ) : null}

        <section className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] px-[var(--sf-card-pad)] py-6 shadow-[var(--shadow-xs)] sm:py-7">
          <div aria-hidden className="pointer-events-none absolute -end-10 -top-12 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-800/80 dark:text-teal-300/90">
                Dashboard
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tp("dashHeroTitle")}</h1>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{tp("dashHeroBody")}</p>
            </div>
            <Button
              type="button"
              className="min-h-11 w-full shrink-0 rounded-full shadow-sm sm:w-auto"
              onClick={() => document.getElementById("create")?.scrollIntoView({ behavior: "smooth" })}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {tp("dashCtaCreate")}
            </Button>
          </div>
          <div className="relative mt-6 grid grid-cols-1 gap-3 min-[390px]:grid-cols-3">
            {[
              [tp("dashMetricSites"), String(total)],
              [tp("dashMetricPublished"), String(publishedShown)],
              [tp("dashMetricDrafts"), String(draftShown)],
            ].map(([label, value]) => (
              <StatCard key={label} label={label} value={loading ? "…" : value} />
            ))}
          </div>
        </section>

        {total === 0 && !loading ? (
          <SoftCard className="border-dashed border-[var(--border)] bg-[var(--card)] p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300">
                  <LayoutTemplate className="h-4 w-4" aria-hidden />
                </div>
                <h2 className="text-lg font-semibold tracking-tight">{t.startTitle}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{tp("dashEmptyCta")}</p>
                <ul className="mt-4 space-y-2.5">
                  {checklist.map((c) => (
                    <li
                      key={c.label}
                      className="flex items-start gap-2.5 text-sm text-[var(--muted)]"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                          c.done ? "bg-teal-700 text-white" : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]"
                        }`}
                      >
                        {c.done ? "✓" : ""}
                      </span>
                      <span className="min-w-0 leading-6">{c.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 rounded-full"
                onClick={() => document.getElementById("create")?.scrollIntoView({ behavior: "smooth" })}
              >
                {tp("dashCtaCreate")}
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
              </Button>
            </div>
          </SoftCard>
        ) : null}

        <SoftCard id="create" className="scroll-mt-24 border-[var(--border)] p-[var(--sf-card-pad)] shadow-[var(--shadow-xs)]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight">{t.marketTitle}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{t.marketSub}</p>
            </div>
            <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-xs font-medium text-[var(--foreground)] shadow-[var(--shadow-xs)] transition hover:bg-[var(--surface)]">
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
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredTemplates.map((tpl) => (
                <button
                  key={tpl.slug}
                  type="button"
                  onClick={() => setTemplateSlug(tpl.slug)}
                  className={`rounded-[1.35rem] border p-3.5 text-start transition ${
                    templateSlug === tpl.slug
                      ? "border-teal-700/40 bg-teal-50 ring-2 ring-teal-700/15 dark:bg-teal-950/40"
                      : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  <div className="mb-2.5 aspect-[16/10] w-full overflow-hidden rounded-2xl bg-[var(--surface)]">
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
                  <div className="mt-1 truncate font-medium text-[var(--foreground)]">
                    {tpl.nameAr}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
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
                <p className="mt-0.5 text-xs text-[var(--muted)]">{t.sitesCount(total)}</p>
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
                  <span className="min-w-[3.5rem] text-center text-xs tabular-nums text-[var(--muted)]">
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
              <SearchField
                grow
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
                placeholder={t.search}
                className="h-10 w-full min-w-0 rounded-2xl"
                aria-label={t.search}
              />

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
            <SoftCard className="border-stone-200/60 p-8 text-sm text-[var(--muted)] shadow-[var(--shadow-xs)] dark:border-stone-800">
              {t.loading}
            </SoftCard>
          ) : sites.length === 0 ? (
            <SoftCard className="border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center">
              <h3 className="font-semibold tracking-tight">{t.emptyTitle}</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">{t.emptyBody}</p>
              <Button
                type="button"
                className="mt-5 min-h-11 rounded-full"
                onClick={() => document.getElementById("create")?.scrollIntoView({ behavior: "smooth" })}
              >
                {tp("dashCtaCreate")}
              </Button>
            </SoftCard>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sites.map((site) => (
                <SoftCard
                  key={site.id}
                  className="flex min-w-0 flex-col border-[var(--border)] bg-[var(--card)]/90 p-[var(--sf-card-pad)] shadow-[var(--shadow-xs)] transition hover:shadow-[var(--shadow-sm)]"
                >
                  <div className="mb-4 min-w-0">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          site.publishedAt
                            ? "bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300"
                            : "bg-[var(--surface)] text-[var(--muted)]"
                        }`}
                      >
                        {site.publishedAt ? t.published : t.draft}
                      </span>
                    </div>
                    <h3 className="truncate text-base font-semibold tracking-tight">{site.name}</h3>
                    <p className="mt-1 truncate font-mono text-xs text-[var(--muted)]" dir="ltr">
                      /s/{site.slug}
                    </p>
                    <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
                      {t.updated}{" "}
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
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
                      onClick={() => {
                        setDeleteTarget(site);
                        setDeleteConfirm("");
                      }}
                      title={tp("deleteSite")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </SoftCard>
              ))}
            </div>
          )}
        </section>
      </Shell>

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sf-delete-site-title"
          onClick={() => {
            if (!deleting) {
              setDeleteTarget(null);
              setDeleteConfirm("");
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--foreground)] shadow-[var(--shadow-sm)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="sf-delete-site-title" className="text-lg font-bold tracking-tight">
              {tp("deleteSiteTitle")}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{tp("deleteSiteBody")}</p>
            <p className="mt-3 truncate text-sm font-semibold">{deleteTarget.name}</p>
            <p className="mt-1 font-mono text-xs text-[var(--muted)]" dir="ltr">
              /s/{deleteTarget.slug}
            </p>
            <Label htmlFor="sf-delete-site-confirm" className="mt-4 block text-xs">
              {tp("deleteConfirmPrompt")}{" "}
              <span className="font-mono font-bold" dir="ltr">
                {siteConfirmWord}
              </span>
            </Label>
            <Input
              id="sf-delete-site-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={tp("deleteConfirmPlaceholder")}
              className="mt-1.5"
              autoFocus
              disabled={deleting}
            />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={deleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirm("");
                }}
              >
                {tp("close")}
              </Button>
              <Button
                type="button"
                className="rounded-full bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-40"
                disabled={!siteConfirmOk || deleting}
                onClick={confirmDeleteSite}
              >
                {deleting ? tp("deleting") : tp("deleteSite")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

    </AppCanvas>
  );
}
