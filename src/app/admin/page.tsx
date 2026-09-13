"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppCanvas, AppHeader, SoftCard, Toolbar } from "@/components/ui/surface";
import { SegmentedControl } from "@/components/ui/segmented";
import { ThemeToggleButton } from "@/components/theme-provider";
import { PlatformLangSwitcher, usePlatformLang } from "@/components/platform-lang-provider";
import { Search, Trash2 } from "lucide-react";

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

export default function AdminPage() {
  const { lang, dir, t } = usePlatformLang();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [usersQ, setUsersQ] = useState("");
  const [sitesQ, setSitesQ] = useState("");
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [sites, setSites] = useState<Array<Record<string, unknown>>>([]);
  const [tab, setTab] = useState<"overview" | "users" | "sites" | "domains" | "templates">("overview");
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
        setTemplates((prev) => prev.filter((t) => String(t.id) !== deleteTplId));
        setDeleteTplId(null);
        setConfirmWord("");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppCanvas dir={dir} lang={lang}>
      <AppHeader>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="min-w-0">
            <div className="truncate text-lg font-bold text-teal-900 dark:text-teal-300">{t("adminTitle")}</div>
            <div className="truncate text-xs text-[var(--muted)]">{t("adminSub")}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PlatformLangSwitcher size="compact" />
            <ThemeToggleButton />
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href="/dashboard">{t("tenantDash")}</Link>
            </Button>
          </div>
        </div>
      </AppHeader>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <SegmentedControl
          aria-label="Admin tabs"
          value={tab}
          onChange={setTab}
          items={[
            { value: "overview", label: t("tabOverview") },
            { value: "users", label: t("tabUsers") },
            { value: "sites", label: t("tabSites") },
            { value: "domains", label: t("tabDomains") },
            { value: "templates", label: t("tabTemplates") },
          ]}
        />

        {tab === "overview" && overview ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["مستخدمون", overview.metrics.users],
                ["مواقع", overview.metrics.sites],
                ["منشورة", overview.metrics.published],
                ["مشاهدات 7 أيام", overview.metrics.views7d],
              ].map(([l, v]) => (
                <SoftCard key={String(l)} className="p-5">
                  <div className="text-xs text-[var(--muted)]">{l}</div>
                  <div className="mt-1 text-3xl font-bold tracking-tight">{v}</div>
                </SoftCard>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <SoftCard className="p-5">
                <h3 className="mb-3 font-semibold">أحدث الأحداث</h3>
                <ul className="space-y-2 text-sm">
                  {overview.recentEvents.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-start justify-between gap-3 border-b border-stone-100 py-2 dark:border-stone-800"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">{e.site.name}</span>
                        <span className="text-[var(--muted)]">
                          {" "}
                          · {e.type} · {e.path}
                        </span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--muted)]">
                        {new Date(e.createdAt).toLocaleString(lang === "ar" ? "ar" : "en")}
                      </span>
                    </li>
                  ))}
                </ul>
              </SoftCard>
              <SoftCard className="p-5">
                <h3 className="mb-3 font-semibold">أحدث المستخدمين</h3>
                <ul className="space-y-2 text-sm">
                  {overview.recentUsers.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-start justify-between gap-3 border-b border-stone-100 py-2 dark:border-stone-800"
                    >
                      <span className="min-w-0">
                        <span className="font-medium break-all">{u.email}</span>
                        <span className="ms-2 inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-700 dark:bg-stone-800 dark:text-stone-200">
                          {u.role}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-[var(--muted)]">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString(lang === "ar" ? "ar" : "en") : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </SoftCard>
            </div>
          </>
        ) : null}

        {tab === "users" ? (
          <SoftCard className="space-y-4 overflow-hidden p-0">
            <Toolbar className="m-3 sm:m-4">
              <div className="sf-search">
                <Search />
                <Input
                  value={usersQ}
                  onChange={(e) => setUsersQ(e.target.value)}
                  placeholder="بحث بالبريد أو الاسم"
                  aria-label="بحث المستخدمين"
                />
              </div>
            </Toolbar>
            <div className="overflow-x-auto px-4 pb-4 sm:px-5">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="text-start text-xs text-[var(--muted)]">
                    <th className="py-2 font-medium">المستخدم</th>
                    <th className="font-medium">الدور</th>
                    <th className="font-medium">مواقع</th>
                    <th className="font-medium">آخر دخول</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={String(u.id)} className="border-t border-stone-100 dark:border-stone-800">
                      <td className="max-w-[16rem] py-2.5">
                        <div className="truncate font-medium">{String(u.email)}</div>
                        <div className="truncate text-xs text-[var(--muted)]">{String(u.name || "")}</div>
                      </td>
                      <td>{String(u.role)}</td>
                      <td>{String((u._count as { sites: number } | undefined)?.sites ?? 0)}</td>
                      <td className="text-xs text-stone-500">
                        {u.lastLoginAt ? new Date(String(u.lastLoginAt)).toLocaleString(lang === "ar" ? "ar" : "en") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SoftCard>
        ) : null}

        {tab === "sites" ? (
          <SoftCard className="space-y-4 overflow-hidden p-0">
            <Toolbar className="m-3 sm:m-4">
              <div className="sf-search">
                <Search />
                <Input
                  value={sitesQ}
                  onChange={(e) => setSitesQ(e.target.value)}
                  placeholder="بحث بالاسم أو المالك"
                  aria-label="بحث المواقع"
                />
              </div>
            </Toolbar>
            <div className="overflow-x-auto px-4 pb-4 sm:px-5">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="text-start text-xs text-[var(--muted)]">
                    <th className="py-2 font-medium">الموقع</th>
                    <th className="font-medium">المالك</th>
                    <th className="font-medium">الحالة</th>
                    <th className="font-medium">أحداث</th>
                    <th className="font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((s) => (
                    <tr key={String(s.id)} className="border-t border-stone-100 dark:border-stone-800">
                      <td className="max-w-[14rem] py-2.5">
                        <div className="truncate font-medium">{String(s.name)}</div>
                        <div className="truncate font-mono text-xs text-[var(--muted)]" dir="ltr">
                          /s/{String(s.slug)}
                        </div>
                      </td>
                      <td className="max-w-[12rem] truncate text-xs">
                        {String((s.owner as { email: string } | undefined)?.email || "")}
                      </td>
                      <td>{s.publishedAt ? t("published") : t("draft")}</td>
                      <td>{String((s._count as { events: number } | undefined)?.events ?? 0)}</td>
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
            <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold">النطاقات المخصصة</div>
            <div className="divide-y divide-[var(--border)]">
              {domains.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">لا نطاقات مسجّلة بعد</div>
              ) : (
                domains.map((d) => (
                  <div key={String(d.id)} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <div className="font-semibold" dir="ltr">{String(d.customDomain || "")}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {String((d as { name?: string }).name || "")} · /s/{String(d.slug)} ·{" "}
                        {String((d.owner as { email?: string } | undefined)?.email || "")}
                      </div>
                    </div>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold dark:bg-stone-800">
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
            <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold">{t("tabTemplates")}</div>
            <div className="divide-y divide-[var(--border)]">
              {templates.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">—</div>
              ) : (
                templates.map((tpl) => (
                  <div key={String(tpl.id)} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{String(tpl.nameAr || tpl.name || "")}</div>
                      <div className="truncate text-xs text-[var(--muted)]" dir="ltr">
                        {String(tpl.slug)} · {String(tpl.category || "")}
                      </div>
                    </div>
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
                  </div>
                ))
              )}
            </div>
          </SoftCard>
        ) : null}

      </main>

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
            className="w-full max-w-md rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--foreground)] shadow-[var(--shadow-sm)]"
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
    </AppCanvas>
  );
}
