"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppCanvas, AppHeader, SoftCard, Toolbar } from "@/components/ui/surface";
import { SegmentedControl } from "@/components/ui/segmented";
import { ThemeToggleButton } from "@/components/theme-provider";
import { PlatformLangSwitcher, usePlatformLang } from "@/components/platform-lang-provider";
import { Search } from "lucide-react";

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
  const [tab, setTab] = useState<"overview" | "users" | "sites" | "domains">("overview");
  const [domains, setDomains] = useState<Array<Record<string, unknown>>>([]);

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
                        <span className="text-stone-400">
                          {" "}
                          · {e.type} · {e.path}
                        </span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-[11px] text-stone-400">
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
                      <span className="shrink-0 text-[11px] text-stone-400">
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
                  <tr className="text-start text-xs text-stone-400">
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
                        <div className="truncate text-xs text-stone-400">{String(u.name || "")}</div>
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
                  <tr className="text-start text-xs text-stone-400">
                    <th className="py-2 font-medium">الموقع</th>
                    <th className="font-medium">المالك</th>
                    <th className="font-medium">الحالة</th>
                    <th className="font-medium">أحداث</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((s) => (
                    <tr key={String(s.id)} className="border-t border-stone-100 dark:border-stone-800">
                      <td className="max-w-[14rem] py-2.5">
                        <div className="truncate font-medium">{String(s.name)}</div>
                        <div className="truncate font-mono text-xs text-stone-400" dir="ltr">
                          /s/{String(s.slug)}
                        </div>
                      </td>
                      <td className="max-w-[12rem] truncate text-xs">
                        {String((s.owner as { email: string } | undefined)?.email || "")}
                      </td>
                      <td>{s.publishedAt ? t("published") : t("draft")}</td>
                      <td>{String((s._count as { events: number } | undefined)?.events ?? 0)}</td>
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

      </main>
    </AppCanvas>
  );
}
