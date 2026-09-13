"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SoftCard, AppCanvas } from "@/components/ui/surface";
import { ThemeToggleButton } from "@/components/theme-provider";
import { PlatformLangSwitcher, usePlatformLang } from "@/components/platform-lang-provider";
import { ArrowRight, Sparkles, Zap, Languages, Menu, X } from "lucide-react";

export function HomeLanding() {
  const { lang, dir, t } = usePlatformLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const features = [
    [t("feat1t"), t("feat1d"), Sparkles],
    [t("feat2t"), t("feat2d"), Zap],
    [t("feat3t"), t("feat3d"), Languages],
  ] as const;
  const metrics = [t("homeMetric1"), t("homeMetric2"), t("homeMetric3")];

  const chromeActions = (
    <>
      <PlatformLangSwitcher size="compact" />
      <ThemeToggleButton />
      <Button asChild variant="ghost" className="rounded-full">
        <Link href="/login" onClick={() => setMenuOpen(false)}>
          {t("login")}
        </Link>
      </Button>
      <Button asChild className="rounded-full shadow-sm">
        <Link href="/signup" onClick={() => setMenuOpen(false)}>
          {t("signup")}
        </Link>
      </Button>
    </>
  );

  return (
    <AppCanvas dir={dir} lang={lang} className="overflow-x-hidden">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-teal-800 text-sm font-bold text-white shadow-sm dark:bg-teal-500 dark:text-teal-950">
            SF
          </div>
          <div className="truncate text-xl font-bold tracking-tight text-teal-900 dark:text-teal-300">SiteForge</div>
        </div>

        <div className="hidden min-w-0 flex-wrap items-center justify-end gap-1.5 sm:flex sm:gap-2">{chromeActions}</div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full sm:hidden"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? t("close") : t("mobileMenu")}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
        </Button>

        {menuOpen ? (
          <div
            className="flex w-full basis-full flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-[var(--foreground)] shadow-[var(--shadow-sm)] sm:hidden"
            data-sf-chrome="platform"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                {t("appUiLang")}
              </span>
              <PlatformLangSwitcher size="compact" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                {t("chromeTheme")}
              </span>
              <ThemeToggleButton />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild variant="ghost" className="flex-1 rounded-full">
                <Link href="/login" onClick={() => setMenuOpen(false)}>
                  {t("login")}
                </Link>
              </Button>
              <Button asChild className="flex-1 rounded-full shadow-sm">
                <Link href="/signup" onClick={() => setMenuOpen(false)}>
                  {t("signup")}
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-4 pb-16 pt-10 sm:px-6 md:pb-24 md:pt-16">
        <section className="relative overflow-hidden rounded-[2rem] border border-stone-200/70 bg-[var(--card)]/80 px-5 py-12 shadow-[var(--shadow-sm)] backdrop-blur sm:px-10 md:px-14 md:py-16 dark:border-stone-800">
          <div
            aria-hidden
            className="pointer-events-none absolute -end-16 -top-20 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl dark:bg-teal-400/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -start-10 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl"
          />
          <div className="relative max-w-3xl min-w-0">
            <p className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-teal-800/12 bg-[var(--card)] px-3.5 py-1.5 text-xs font-semibold text-teal-800 shadow-[var(--shadow-xs)] dark:border-teal-400/25 dark:text-teal-300">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600 dark:bg-teal-400" aria-hidden />
              <span className="min-w-0 break-words">{t("homeBadge")}</span>
            </p>
            <h1 className="mb-5 break-words text-3xl font-bold leading-[1.15] tracking-tight sm:text-4xl md:text-6xl md:leading-[1.05]">
              {t("homeTitle")}
            </h1>
            <p className="mb-9 max-w-2xl break-words text-base leading-8 text-[var(--muted)] md:text-lg">{t("homeBody")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-full px-7 shadow-sm">
                <Link href="/signup" className="inline-flex items-center gap-2">
                  {t("startNow")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full bg-[var(--card)]">
                <Link href="/s/demo-studio">{t("previewDemo")}</Link>
              </Button>
            </div>
          </div>
          <div className="relative mt-12 grid gap-3 sm:grid-cols-3">
            {metrics.map((label) => (
              <div key={label} className="sf-stat text-sm font-semibold tracking-tight">
                {label}
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {features.map(([title, desc, Icon]) => (
            <SoftCard
              key={title}
              className="border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <h3 className="mb-2 font-semibold tracking-tight text-[var(--foreground)]">{title}</h3>
              <p className="text-sm leading-7 text-[var(--muted)]">{desc}</p>
            </SoftCard>
          ))}
        </div>
      </main>

      <footer className="mx-auto max-w-6xl border-t border-stone-200/70 px-4 py-8 text-center text-xs text-[var(--muted)] dark:border-stone-800 sm:px-6">
        {t("homeFooterNote")}
      </footer>
    </AppCanvas>
  );
}
