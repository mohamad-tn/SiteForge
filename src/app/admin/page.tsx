"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SoftCard, StatCard, AdminShell } from "@/components/ui/surface";
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
  Activity,
  ExternalLink,
} from "lucide-react";
import { SearchField } from "@/components/ui/search-field";
import { DataTable } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { AdminAiPanel } from "@/components/admin/admin-ai-panel";
import { AccountMenu } from "@/components/account-menu";
import {
  ADMIN_PAGE_SIZE,
  eventTypeLabel,
  formatRelativeTime,
  knownEventTypes,
  paginateSlice,
  templateDisplayTitle,
} from "@/lib/admin-format";

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

type AdminTab = "overview" | "users" | "sites" | "domains" | "templates" | "ai" | "events";

type EventRow = {
  id: string;
  type: string;
  path: string | null;
  createdAt: string;
  site: { id?: string; name: string; slug: string };
};

export default function AdminPage() {
  const { lang, dir, t } = usePlatformLang();
  const { data: session } = useSession();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [usersQ, setUsersQ] = useState("");
  const [sitesQ, setSitesQ] = useState("");
  const [domainsQ, setDomainsQ] = useState("");
  const [templatesQ, setTemplatesQ] = useState("");
  const [eventsQ, setEventsQ] = useState("");
  const [eventType, setEventType] = useState("all");
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageCount, setUsersPageCount] = useState(1);
  const [sites, setSites] = useState<Array<Record<string, unknown>>>([]);
  const [sitesTotal, setSitesTotal] = useState(0);
  const [sitesPage, setSitesPage] = useState(1);
  const [sitesPageCount, setSitesPageCount] = useState(1);
  const [tab, setTab] = useState<AdminTab>("overview");
  const [domains, setDomains] = useState<Array<Record<string, unknown>>>([]);
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsPageCount, setEventsPageCount] = useState(1);
  const [domainsPage, setDomainsPage] = useState(1);
  const [templatesPage, setTemplatesPage] = useState(1);
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
        { id: "events" as const, label: t("tabEvents"), icon: <Activity className="h-3.5 w-3.5 shrink-0" /> },
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
      fetch(
        `/api/admin/users?q=${encodeURIComponent(usersQ)}&page=${usersPage}&pageSize=${ADMIN_PAGE_SIZE}`
      )
        .then((r) => r.json())
        .then((d) => {
          setUsers(d.users || []);
          setUsersTotal(d.total || 0);
          setUsersPageCount(d.pageCount || 1);
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [tab, usersQ, usersPage]);

  useEffect(() => {
    setUsersPage(1);
  }, [usersQ]);

  useEffect(() => {
    if (tab !== "sites") return;
    const timer = setTimeout(() => {
      fetch(
        `/api/admin/sites?q=${encodeURIComponent(sitesQ)}&page=${sitesPage}&pageSize=${ADMIN_PAGE_SIZE}`
      )
        .then((r) => r.json())
        .then((d) => {
          setSites(d.sites || []);
          setSitesTotal(d.total || 0);
          setSitesPageCount(d.pageCount || 1);
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [tab, sitesQ, sitesPage]);

  useEffect(() => {
    setSitesPage(1);
  }, [sitesQ]);

  useEffect(() => {
    if (tab !== "domains") return;
    fetch("/api/admin/domains")
      .then((r) => r.json())
      .then((d) => setDomains(d.domains || []))
      .catch(() => setDomains([]));
  }, [tab]);

  useEffect(() => {
    setDomainsPage(1);
  }, [domainsQ]);

  useEffect(() => {
    if (tab !== "templates") return;
    fetch(`/api/templates?q=${encodeURIComponent(templatesQ)}`)
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => setTemplates([]));
  }, [tab, templatesQ]);

  useEffect(() => {
    setTemplatesPage(1);
  }, [templatesQ]);

  useEffect(() => {
    if (tab !== "events" && tab !== "overview") return;
    if (tab !== "events") return;
    const timer = setTimeout(() => {
      const typeParam = eventType && eventType !== "all" ? `&type=${encodeURIComponent(eventType)}` : "";
      fetch(
        `/api/admin/events?q=${encodeURIComponent(eventsQ)}&page=${eventsPage}&pageSize=${ADMIN_PAGE_SIZE}${typeParam}`
      )
        .then((r) => r.json())
        .then((d) => {
          setEvents(d.events || []);
          setEventsTotal(d.total || 0);
          setEventsPageCount(d.pageCount || 1);
        })
        .catch(() => {
          setEvents([]);
          setEventsTotal(0);
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [tab, eventsQ, eventsPage, eventType]);

  useEffect(() => {
    setEventsPage(1);
  }, [eventsQ, eventType]);

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

  const filteredDomains = useMemo(() => {
    const needle = domainsQ.trim().toLowerCase();
    if (!needle) return domains;
    return domains.filter((d) => {
      const hay = [
        String(d.customDomain || ""),
        String((d as { name?: string }).name || ""),
        String(d.slug || ""),
        String((d.owner as { email?: string } | undefined)?.email || ""),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [domains, domainsQ]);

  const domainsPaged = useMemo(
    () => paginateSlice(filteredDomains, domainsPage, ADMIN_PAGE_SIZE),
    [filteredDomains, domainsPage]
  );

  const templatesPaged = useMemo(
    () => paginateSlice(templates, templatesPage, ADMIN_PAGE_SIZE),
    [templates, templatesPage]
  );

  const eventTypeOptions = useMemo(
    () => [
      { value: "all", label: t("eventTypeAll") },
      ...knownEventTypes().map((k) => ({ value: k, label: eventTypeLabel(k, lang) })),
    ],
    [t, lang]
  );

  const renderEventRow = useCallback(
    (e: { id: string; type: string; path: string | null; createdAt: string; site: { name: string; slug: string } }) => (
      <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
        <span className="min-w-0">
          <span className="font-medium">{e.site.name}</span>
          <span className="text-[var(--muted)]"> · {eventTypeLabel(e.type, lang)}</span>
          {e.path ? (
            <span className="ms-1 font-mono text-[11px] text-[var(--muted)]" dir="ltr">
              {e.path}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--muted)]" title={new Date(e.createdAt).toISOString()}>
          {formatRelativeTime(e.createdAt, lang)}
        </span>
      </li>
    ),
    [lang]
  );

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
            <AccountMenu email={session?.user?.email} name={session?.user?.name} />
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
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
                  <div className="text-sm font-semibold">{t("adminRecentEvents")}</div>
                  <Button type="button" variant="ghost" size="sm" className="rounded-full text-xs" onClick={() => setTab("events")}>
                    {t("viewAll")}
                  </Button>
                </div>
                <ul className="divide-y divide-[color-mix(in_oklab,var(--border)_70%,transparent)]">
                  {overview.recentEvents.length === 0 ? (
                    <li className="px-4 py-5 text-center text-sm text-[var(--muted)]">{t("emptyTable")}</li>
                  ) : (
                    overview.recentEvents.slice(0, 8).map((e) => renderEventRow(e))
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
                        {u.lastLoginAt ? formatRelativeTime(u.lastLoginAt, lang) : "—"}
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
          <DataTable
            dir={dir}
            rows={users}
            rowKey={(u) => String(u.id)}
            page={usersPage}
            pageCount={usersPageCount}
            total={usersTotal}
            pageSize={ADMIN_PAGE_SIZE}
            onPageChange={setUsersPage}
            empty={t("emptyTable")}
            toolbar={
              <SearchField
                grow
                value={usersQ}
                onChange={(e) => setUsersQ(e.target.value)}
                placeholder={t("adminSearchUsers")}
                aria-label={t("adminSearchUsers")}
              />
            }
            columns={[
              {
                id: "user",
                header: t("adminColUser"),
                cell: (u) => (
                  <div className="max-w-[16rem]">
                    <div className="truncate font-medium">{String(u.email)}</div>
                    <div className="truncate text-xs text-[var(--muted)]">{String(u.name || "")}</div>
                  </div>
                ),
              },
              {
                id: "role",
                header: t("adminColRole"),
                cell: (u) => (
                  <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
                    {String(u.role)}
                  </span>
                ),
              },
              {
                id: "sites",
                header: t("adminColSites"),
                cell: (u) => {
                  const n = (u._count as { sites: number } | undefined)?.sites ?? 0;
                  return (
                    <span className="tabular-nums">
                      {n}{" "}
                      <span className="text-[10px] font-normal text-[var(--muted)]">{t("adminColSites")}</span>
                    </span>
                  );
                },
              },
              {
                id: "login",
                header: t("adminColLastLogin"),
                className: "text-xs text-[var(--muted)]",
                cell: (u) =>
                  u.lastLoginAt ? formatRelativeTime(String(u.lastLoginAt), lang) : "—",
              },
            ]}
          />
        ) : null}

        {tab === "sites" ? (
          <DataTable
            dir={dir}
            rows={sites}
            rowKey={(s) => String(s.id)}
            page={sitesPage}
            pageCount={sitesPageCount}
            total={sitesTotal}
            pageSize={ADMIN_PAGE_SIZE}
            onPageChange={setSitesPage}
            empty={t("emptyTable")}
            toolbar={
              <SearchField
                grow
                value={sitesQ}
                onChange={(e) => setSitesQ(e.target.value)}
                placeholder={t("adminSearchSites")}
                aria-label={t("adminSearchSites")}
              />
            }
            columns={[
              {
                id: "site",
                header: t("adminColSite"),
                cell: (s) => {
                  const slug = String(s.slug);
                  const href = `/s/${slug}`;
                  return (
                    <div className="max-w-[16rem]">
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1 truncate font-medium text-teal-800 hover:underline dark:text-teal-300"
                      >
                        <span className="truncate">{String(s.name)}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                      </a>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 block truncate font-mono text-xs text-[var(--muted)] hover:underline"
                        dir="ltr"
                      >
                        /s/{slug}
                      </a>
                    </div>
                  );
                },
              },
              {
                id: "owner",
                header: t("adminColOwner"),
                cell: (s) => (
                  <div className="max-w-[12rem] truncate text-xs">
                    <div className="truncate font-medium">
                      {String((s.owner as { email?: string } | undefined)?.email || "")}
                    </div>
                    <div className="truncate text-[10px] text-[var(--muted)]">
                      {String((s.owner as { name?: string } | undefined)?.name || "")}
                    </div>
                  </div>
                ),
              },
              {
                id: "status",
                header: t("adminColStatus"),
                cell: (s) => (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      s.publishedAt
                        ? "bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300"
                        : "bg-[var(--surface)] text-[var(--muted)]"
                    }`}
                  >
                    {s.publishedAt ? t("published") : t("draft")}
                  </span>
                ),
              },
              {
                id: "events",
                header: t("adminColEvents"),
                cell: (s) => {
                  const n = (s._count as { events: number } | undefined)?.events ?? 0;
                  return (
                    <span className="tabular-nums">
                      {n}{" "}
                      <span className="text-[10px] font-normal text-[var(--muted)]">{t("adminEventsUnit")}</span>
                    </span>
                  );
                },
              },
              {
                id: "actions",
                header: "",
                cell: (s) => (
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
                ),
              },
            ]}
          />
        ) : null}

        {tab === "domains" ? (
          <DataTable
            dir={dir}
            rows={domainsPaged.rows}
            rowKey={(d) => String(d.id)}
            page={domainsPaged.page}
            pageCount={domainsPaged.pageCount}
            total={domainsPaged.total}
            pageSize={ADMIN_PAGE_SIZE}
            onPageChange={setDomainsPage}
            empty={t("adminDomainsEmpty")}
            toolbar={
              <SearchField
                grow
                value={domainsQ}
                onChange={(e) => setDomainsQ(e.target.value)}
                placeholder={t("adminSearchDomains")}
                aria-label={t("adminSearchDomains")}
              />
            }
            columns={[
              {
                id: "domain",
                header: t("tabDomains"),
                cell: (d) => (
                  <div className="min-w-0">
                    <div className="font-semibold" dir="ltr">
                      {String(d.customDomain || "")}
                    </div>
                    <div className="truncate text-xs text-[var(--muted)]">
                      {String((d as { name?: string }).name || "")} · /s/{String(d.slug)}
                    </div>
                  </div>
                ),
              },
              {
                id: "owner",
                header: t("adminColOwner"),
                className: "text-xs",
                cell: (d) => String((d.owner as { email?: string } | undefined)?.email || ""),
              },
              {
                id: "status",
                header: t("adminColStatus"),
                cell: (d) => (
                  <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted)]">
                    {String(d.domainStatus)}
                  </span>
                ),
              },
            ]}
          />
        ) : null}

        {tab === "templates" ? (
          <DataTable
            dir={dir}
            rows={templatesPaged.rows}
            rowKey={(tpl) => String(tpl.id)}
            page={templatesPaged.page}
            pageCount={templatesPaged.pageCount}
            total={templatesPaged.total}
            pageSize={ADMIN_PAGE_SIZE}
            onPageChange={setTemplatesPage}
            empty={t("emptyTable")}
            toolbar={
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <SearchField
                  grow
                  value={templatesQ}
                  onChange={(e) => setTemplatesQ(e.target.value)}
                  placeholder={t("adminSearchTemplates")}
                  aria-label={t("adminSearchTemplates")}
                />
                <p className="shrink-0 text-[11px] text-[var(--muted)] sm:max-w-[14rem]">{t("adminTemplatesHint")}</p>
              </div>
            }
            columns={[
              {
                id: "tpl",
                header: t("adminColTemplate"),
                cell: (tpl) => {
                  const title = templateDisplayTitle(
                    {
                      name: String(tpl.name || ""),
                      nameAr: String(tpl.nameAr || ""),
                    },
                    lang
                  );
                  const slug = String(tpl.slug || "");
                  return (
                    <div className="max-w-[18rem]">
                      <div className="truncate font-medium">{title}</div>
                      <code className="mt-0.5 inline-block truncate rounded-md bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--muted)]" dir="ltr">
                        /{slug}
                      </code>
                    </div>
                  );
                },
              },
              {
                id: "cat",
                header: t("adminColCategory"),
                className: "text-xs text-[var(--muted)]",
                cell: (tpl) => String(tpl.category || ""),
              },
              {
                id: "actions",
                header: "",
                className: "text-end",
                cell: (tpl) => (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-rose-700"
                    onClick={() => {
                      setDeleteTplId(String(tpl.id));
                      setDeleteTplLabel(
                        templateDisplayTitle(
                          { name: String(tpl.name || ""), nameAr: String(tpl.nameAr || "") },
                          lang
                        )
                      );
                      setDeleteSiteId(null);
                      setConfirmWord("");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("deleteTemplate")}
                  </Button>
                ),
              },
            ]}
          />
        ) : null}

        {tab === "events" ? (
          <DataTable
            dir={dir}
            rows={events}
            rowKey={(e) => e.id}
            page={eventsPage}
            pageCount={eventsPageCount}
            total={eventsTotal}
            pageSize={ADMIN_PAGE_SIZE}
            onPageChange={setEventsPage}
            empty={t("emptyTable")}
            toolbar={
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <SearchField
                  grow
                  value={eventsQ}
                  onChange={(e) => setEventsQ(e.target.value)}
                  placeholder={t("adminSearchEvents")}
                  aria-label={t("adminSearchEvents")}
                />
                <Select
                  value={eventType}
                  onValueChange={setEventType}
                  options={eventTypeOptions}
                  triggerClassName="h-10 min-w-[10rem] rounded-2xl"
                  wrapperClassName="w-full sm:w-auto"
                  aria-label={t("eventTypeFilter")}
                />
              </div>
            }
            columns={[
              {
                id: "site",
                header: t("adminColSite"),
                cell: (e) => <span className="font-medium">{e.site.name}</span>,
              },
              {
                id: "action",
                header: t("adminColAction"),
                cell: (e) => eventTypeLabel(e.type, lang),
              },
              {
                id: "path",
                header: t("adminColPath"),
                cell: (e) => (
                  <span className="font-mono text-[11px] text-[var(--muted)]" dir="ltr">
                    {e.path || "—"}
                  </span>
                ),
              },
              {
                id: "when",
                header: t("adminColWhen"),
                className: "text-xs text-[var(--muted)]",
                cell: (e) => (
                  <span title={new Date(e.createdAt).toLocaleString(lang === "ar" ? "ar" : "en")}>
                    {formatRelativeTime(e.createdAt, lang)}
                  </span>
                ),
              },
            ]}
          />
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
