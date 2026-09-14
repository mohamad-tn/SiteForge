"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SoftCard, Toolbar, StatCard, AdminShell } from "@/components/ui/surface";
import { SegmentedControl } from "@/components/ui/segmented";
import { ThemeToggleButton } from "@/components/theme-provider";
import { PlatformLangSwitcher, usePlatformLang } from "@/components/platform-lang-provider";
import {
  Trash2,
  LayoutDashboard,
  Users,
  Globe2,
  Link2,
  LayoutTemplate,
  Sparkles,
} from "lucide-react";
import { SearchField } from "@/components/ui/search-field";
import { AdminAiPanel } from "@/components/admin/admin-ai-panel";

type Overview = {
  metrics: { users: number; sites: number; published: number; views7d: number };
  recentEvents: Array<{
    id: string;
    type: string;
    path: string | null;
    createdAt: string;
    site: { name: string; slug: string };
  }>;
  recentUsers: Array<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: string;
    lastLoginAt: string | null;
  }>;
};

type AdminTab = "overview" | "users" | "sites" | "domains" | "templates" | "ai";

export default function AdminPage() {
  const { lang, dir, t } = usePlatformLang();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [usersQ, setUsersQ] = useState("");
  const [sitesQ, setSitesQ] = useState("");
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [sites, setSites] = useState<Array<Record<string, unknown>>>([]);
  const [tab, setTab] = useState<AdminTab>("overview");
  const [domains, setDomains] = useState<Array<Record<string, unknown>>>([]);
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [deleteSiteId, setDeleteSiteId] = useState<string | null>(null);
  const [deleteSiteLabel, setDeleteSiteLabel] = useState("");
  const [deleteTplId, setDeleteTplId] = useState<string | null>(null);
  const [deleteTplLabel, setDeleteTplLabel] = useState("");
  const [confirmWord, setConfirmWord] = useState("");
  const [deleting, setDeleting] = useState(false);

  const confirmExpected = lang === "ar" ? "حذف" : "delete";
  const confirmOk =
    lang === "ar"
      ? confirmWord.trim() === confirmExpected
      : confirmWord.trim().toLowerCase() === confirmExpected;

  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: t("tabOverview"), icon: <LayoutDashboard className="h-3.5 w-3.5 shrink-0" /> },
        { id: "users" as const, label: t("tabUsers"), icon: <Users className="h-3.5 w-3.5 shrink-0" /> },
        { id: "sites" as const, label: t("tabSites"), icon: <Globe2 className="h-3.5 w-3.5 shrink-0" /> },
        { id: "domains" as const, label: t("tabDomains"), icon: <Link2 className="h-3.5 w-3.5 shrink-0" /> },
        { id: "templates" as const, label: t("tabTemplates"), icon: <LayoutTemplate className="h-3.5 w-3.5 shrink-0" /> },
        { id: "ai" as const, label: t("tabAi"), icon: <Sparkles className="h-3.5 w-3.5 shrink-0" /> },
      ] as const,
    [t]
  );

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => r.json())
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);

  useEffect(() => {
    if (tab !== "users") return;
    const timer = setTimeout(() => {
      fetch(`/api/admin/users?q=${encodeURIComponent(usersQ)}&pageSize=30`)
        .then((r) => r.json())
        .then((d) => setUsers(d.users || []));
    }, 200);
    return () => clearTimeout(timer);
  }, [tab, usersQ]);

  useEffect(() => {
    if (tab !== "sites") return;
    const timer = setTimeout(() => {
      fetch(`/api/admin/sites?q=${encodeURIComponent(sitesQ)}&pageSize=30`)
        .then((r) => r.json())
        .then((d) => setSites(d.sites || []));
    }, 200);
    return () => clearTimeout(timer);
  }, [tab, sitesQ]);

  useEffect(() => {
    if (tab !== "domains") return;
    fetch("/api/admin/domains")
      .then((r) => r.json())
      .then((d) => setDomains(d.domains || []))
      .catch(() => setDomains([]));
  }, [tab]);

  useEffect(() => {
    if (tab !== "templates") return;
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => setTemplates([]));
  }, [tab]);

  async function runDeleteSite() {
    if (!deleteSiteId || !confirmOk || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sites/${deleteSiteId}`, { method: "DELETE" });
      if (res.ok) {
        setSites((prev) => prev.filter((s) => String(s.id) !== deleteSiteId));
        setDeleteSiteId(null);
        setConfirmWord("");
      }
    } finally {
      setDeleting(false);
    }
  }

  async function runDeleteTemplate() {
    if (!deleteTplId || !confirmOk || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/templates/${deleteTplId}`, { method: "DELETE" });
      if (res.ok) {
        setTemplates((prev) => prev.filter((row) => String(row.id) !== deleteTplId));
        setDeleteTplId(null);
        setConfirmWord("");
      }
    } finally {
      setDeleting(false);
    }
  }

  const locale = lang === "ar" ? "ar" : "en";

  return (
    <>
      <AdminShell
        dir={dir}
        lang={lang}
        title={t("adminTitle")}
        subtitle={t("adminSub")}
        tabs={[...tabs]}
        activeTab={tab}
        onTabChange={(id) => setTab(id as AdminTab)}
        actions={
          <>
            <PlatformLangSwitcher size="compact" />
            <ThemeToggleButton />
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href="/dashboard?tenant=1">{t("mySandboxSites")}</Link>
            </Button>
          </>
        }
        mobileTabs={
          <SegmentedControl
            aria-label="Admin tabs"
            value={tab}
            onChange={(v) => setTab(v as AdminTab)}
            items={tabs.map((x) => ({ value: x.id, label: x.label }))}
          />
        }
      >
        {tab === "overview" && overview ? (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label={t("adminMetricUsers")} value={overview.metrics.users} />
              <StatCard label={t("adminMetricSites")} value={overview.metrics.sites} />
              <StatCard label={t("adminMetricPublished")} value={overview.metrics.published} />
              <StatCard label={t("adminMetricViews7d")} value={overview.metrics.views7d} />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <SoftCard className="overflow-hidden p-0">
                <div className="border-b border-[var(--border)] px-4 py-2.5 text-sm font-semibold">
                  {t("adminRecentEvents")}
                </div>
                <ul className="divide-y divide-[color-mix(in_oklab,var(--border)_70%,transparent)]">
                  {overview.recentEvents.length === 0 ? (
                    <li className="px-4 py-5 text-center text-sm text-[var(--muted)]">—</li>
                  ) : (
                    overview.recentEvents.map((e) => (
                      <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                        <span className="min-w-0">
                          <span className="font-medium">{e.site.name}</span>
                          <span className="text-[var(--muted)]">
                            {" "}
                            · {e.type} · {e.path}
                          </span>
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--muted)]">
                          {new Date(e.createdAt).toLocaleString(locale)}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </SoftCard>
              <SoftCard className="overflow-hidden p-0">
                <div className="border-b border-[var(--border)] px-4 py-2.5 text-sm font-semibold">
                  {t("adminRecentUsers")}
                </div>
                <ul className="divide-y divide-[color-mix(in_oklab,var(--border)_70%,transparent)]">
                  {overview.recentUsers.map((u) => (
                    <li key={u.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="break-all font-medium">{u.email}</span>
                        <span className="ms-2 inline-flex rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                          {u.role}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-[var(--muted)]">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString(locale) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </SoftCard>
            </div>
          </>
        ) : null}

        {tab === "overview" && !overview ? (
          <SoftCard className="p-6 text-sm text-[var(--muted)]">{t("loading")}</SoftCard>
        ) : null}

        {tab === "users" ? (
          <SoftCard className="space-y-0 overflow-hidden p-0">
            <Toolbar className="m-3">
              <SearchField
                grow
                value={usersQ}
                onChange={(e) => setUsersQ(e.target.value)}
                placeholder={t("adminSearchUsers")}
                aria-label={t("adminSearchUsers")}
              />
            </Toolbar>
            <div className="overflow-x-auto px-2 pb-3 sm:px-3">
              <table className="sf-dense-table min-w-[36rem]">
                <thead>
                  <tr>
                    <th>{t("adminColUser")}</th>
                    <th>{t("adminColRole")}</th>
                    <th>{t("adminColSites")}</th>
                    <th>{t("adminColLastLogin")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={String(u.id)}>
                      <td className="max-w-[16rem]">
                        <div className="truncate font-medium">{String(u.email)}</div>
                        <div className="truncate text-xs text-[var(--muted)]">{String(u.name || "")}</div>
                      </td>
                      <td>
                        <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
                          {String(u.role)}
                        </span>
                      </td>
                      <td className="tabular-nums">{String((u._count as { sites: number } | undefined)?.sites ?? 0)}</td>
                      <td className="text-xs text-[var(--muted)]">
                        {u.lastLoginAt
                          ? new Date(String(u.lastLoginAt)).toLocaleString(locale)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SoftCard>
        ) : null}

        {tab === "sites" ? (
          <SoftCard className="space-y-0 overflow-hidden p-0">
            <Toolbar className="m-3">
              <SearchField
                grow
                value={sitesQ}
                onChange={(e) => setSitesQ(e.target.value)}
                placeholder={t("adminSearchSites")}
                aria-label={t("adminSearchSites")}
              />
            </Toolbar>
            <div className="overflow-x-auto px-2 pb-3 sm:px-3">
              <table className="sf-dense-table min-w-[40rem]">
                <thead>
                  <tr>
                    <th>{t("adminColSite")}</th>
                    <th>{t("adminColOwner")}</th>
                    <th>{t("adminColStatus")}</th>
                    <th>{t("adminColEvents")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((s) => (
                    <tr key={String(s.id)}>
                      <td className="max-w-[14rem]">
                        <div className="truncate font-medium">{String(s.name)}</div>
                        <div className="truncate font-mono text-xs text-[var(--muted)]" dir="ltr">
                          /s/{String(s.slug)}
                        </div>
                      </td>
                      <td className="max-w-[12rem] truncate text-xs">
                        {String((s.owner as { email: string } | undefined)?.email || "")}
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            s.publishedAt
                              ? "bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300"
                              : "bg-[var(--surface)] text-[var(--muted)]"
                          }`}
                        >
                          {s.publishedAt ? t("published") : t("draft")}
                        </span>
                      </td>
                      <td className="tabular-nums">
                        {String((s._count as { events: number } | undefined)?.events ?? 0)}
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full text-rose-700"
                          onClick={() => {
                            setDeleteSiteId(String(s.id));
                            setDeleteSiteLabel(String(s.name));
                            setDeleteTplId(null);
                            setConfirmWord("");
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SoftCard>
        ) : null}

        {tab === "domains" ? (
          <SoftCard className="overflow-hidden p-0">
            <div className="border-b border-[var(--border)] px-4 py-2.5 text-sm font-semibold">
              {t("adminDomainsTitle")}
            </div>
            <div className="divide-y divide-[color-mix(in_oklab,var(--border)_70%,transparent)]">
              {domains.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">{t("adminDomainsEmpty")}</div>
              ) : (
                domains.map((d) => (
                  <div
                    key={String(d.id)}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold" dir="ltr">
                        {String(d.customDomain || "")}
                      </div>
                      <div className="truncate text-xs text-[var(--muted)]">
                        {String((d as { name?: string }).name || "")} · /s/{String(d.slug)} ·{" "}
                        {String((d.owner as { email?: string } | undefined)?.email || "")}
                      </div>
                    </div>
                    <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted)]">
                      {String(d.domainStatus)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </SoftCard>
        ) : null}

        {tab === "templates" ? (
          <SoftCard className="overflow-hidden p-0">
            <div className="border-b border-[var(--border)] px-4 py-2.5">
              <div className="text-sm font-semibold">{t("tabTemplates")}</div>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{t("adminTemplatesHint")}</p>
            </div>
            <div className="overflow-x-auto px-2 pb-3 sm:px-3">
              <table className="sf-dense-table min-w-[32rem]">
                <thead>
                  <tr>
                    <th>{t("adminColTemplate")}</th>
                    <th>{t("adminColCategory")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {templates.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-[var(--muted)]">
                        —
                      </td>
                    </tr>
                  ) : (
                    templates.map((tpl) => (
                      <tr key={String(tpl.id)}>
                        <td className="max-w-[18rem]">
                          <div className="truncate font-medium">{String(tpl.nameAr || tpl.name || "")}</div>
                          <div className="truncate font-mono text-xs text-[var(--muted)]" dir="ltr">
                            {String(tpl.slug)}
                          </div>
                        </td>
                        <td className="text-xs text-[var(--muted)]">{String(tpl.category || "")}</td>
                        <td className="text-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full text-rose-700"
                            onClick={() => {
                              setDeleteTplId(String(tpl.id));
                              setDeleteTplLabel(String(tpl.nameAr || tpl.name || ""));
                              setDeleteSiteId(null);
                              setConfirmWord("");
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("deleteTemplate")}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SoftCard>
        ) : null}

        {tab === "ai" ? <AdminAiPanel /> : null}
      </AdminShell>

      {deleteSiteId || deleteTplId ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!deleting) {
              setDeleteSiteId(null);
              setDeleteTplId(null);
              setConfirmWord("");
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--foreground)] shadow-[var(--shadow-sm)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold tracking-tight">
              {deleteSiteId ? t("deleteSiteTitle") : t("deleteTemplateTitle")}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {deleteSiteId ? t("deleteSiteBody") : t("deleteTemplateBody")}
            </p>
            <p className="mt-3 text-sm font-semibold">{deleteSiteId ? deleteSiteLabel : deleteTplLabel}</p>
            <label className="mt-4 block text-xs" htmlFor="sf-admin-del-confirm">
              {t("deleteConfirmPrompt")}{" "}
              <span className="font-mono font-bold" dir="ltr">
                {confirmExpected}
              </span>
            </label>
            <Input
              id="sf-admin-del-confirm"
              className="mt-1.5"
              value={confirmWord}
              onChange={(e) => setConfirmWord(e.target.value)}
              placeholder={t("deleteConfirmPlaceholder")}
              disabled={deleting}
              autoFocus
            />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={deleting}
                onClick={() => {
                  setDeleteSiteId(null);
                  setDeleteTplId(null);
                  setConfirmWord("");
                }}
              >
                {t("close")}
              </Button>
              <Button
                type="button"
                className="rounded-full bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-40"
                disabled={!confirmOk || deleting}
                onClick={() => (deleteSiteId ? runDeleteSite() : runDeleteTemplate())}
              >
                {deleting ? t("deleting") : deleteSiteId ? t("deleteSite") : t("deleteTemplate")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
