"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SoftCard, AppCanvas } from "@/components/ui/surface";
import { ThemeToggleButton } from "@/components/theme-provider";
import { PlatformLangSwitcher, usePlatformLang } from "@/components/platform-lang-provider";

export function HomeLanding() {
  const { lang, dir, t } = usePlatformLang();
  const features = [
    [t("feat1t"), t("feat1d")],
    [t("feat2t"), t("feat2d")],
    [t("feat3t"), t("feat3d")],
  ];

  return (
    <AppCanvas dir={dir} lang={lang}>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <div className="text-xl font-bold tracking-tight text-teal-900 dark:text-teal-300">SiteForge</div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <PlatformLangSwitcher size="compact" />
          <ThemeToggleButton />
          <Button asChild variant="ghost" className="rounded-full">
            <Link href="/login">{t("login")}</Link>
          </Button>
          <Button asChild className="rounded-full shadow-sm">
            <Link href="/signup">{t("signup")}</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
        <div className="max-w-3xl">
          <p className="mb-4 inline-flex rounded-full border border-teal-800/12 bg-[var(--card)]/85 px-3.5 py-1.5 text-xs font-semibold text-teal-800 shadow-[var(--shadow-xs)] backdrop-blur dark:border-teal-400/25 dark:text-teal-300">
            {t("homeBadge")}
          </p>
          <h1 className="mb-6 text-4xl font-bold leading-[1.12] tracking-tight md:text-6xl">{t("homeTitle")}</h1>
          <p className="mb-10 max-w-2xl text-lg leading-8 text-[var(--muted)]">{t("homeBody")}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-7 shadow-sm">
              <Link href="/signup">{t("startNow")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link href="/s/demo-studio">{t("previewDemo")}</Link>
            </Button>
          </div>
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {features.map(([title, desc]) => (
            <SoftCard key={title} className="p-6 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
              <h3 className="mb-2 font-semibold tracking-tight">{title}</h3>
              <p className="text-sm leading-7 text-[var(--muted)]">{desc}</p>
            </SoftCard>
          ))}
        </div>
      </main>
    </AppCanvas>
  );
}
