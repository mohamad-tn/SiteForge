"use client";

import { useEffect, useMemo, useState } from "react";
import type { SiteContent } from "@/lib/design";
import { LOCALE_META, isLocaleCode, localeDir } from "@/lib/design";
import { SiteRenderer } from "@/components/site-renderer";
import { useSearchParams } from "next/navigation";
import { sanitizeCustomCss } from "@/lib/sanitize-css";
import { SF_SITE_VIEW_ATTR } from "@/components/platform-lang-provider";

function detectSystem(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Published site view.
 * Site locale MUST NOT permanently overwrite platform chrome:
 * - lang/dir scoped on a root wrapper
 * - documentElement updated only while mounted, then restored
 */
export function PublicSiteView({
  content,
  slug,
  customCss,
  favicon,
}: {
  content: SiteContent;
  slug: string;
  customCss?: string | null;
  favicon?: string | null;
}) {
  const search = useSearchParams();
  const pageParam = search.get("p") || undefined;
  const locales = content.locales?.length ? content.locales : [content.defaultLocale || "ar"];
  const defaultLocale = content.defaultLocale || locales[0];
  const [locale, setLocale] = useState(defaultLocale);
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const pref = content.tokens.themeMode || "system";
    if (pref === "system") setMode(detectSystem());
    else setMode(pref);
  }, [content.tokens.themeMode]);

  // Claim documentElement for the lifetime of this view; restore platform on leave.
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute(SF_SITE_VIEW_ATTR, "1");
    return () => {
      html.removeAttribute(SF_SITE_VIEW_ATTR);
      const platform =
        html.dataset.sfPlatformLang ||
        localStorage.getItem("sf-platform-lang") ||
        localStorage.getItem("siteforge-ui-lang");
      if (platform === "ar" || platform === "en") {
        html.lang = platform;
        html.dir = platform === "ar" ? "rtl" : "ltr";
      }
      window.dispatchEvent(new Event("sf-platform-lang"));
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (!html.hasAttribute(SF_SITE_VIEW_ATTR)) return;
    html.lang = locale;
    html.dir = localeDir(locale);
  }, [locale]);

  useEffect(() => {
    if (favicon) {
      let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = favicon;
    }
  }, [favicon]);

  useEffect(() => {
    fetch("/api/analytics/hit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, path: pageParam ? `/${pageParam}` : "/", locale }),
    }).catch(() => {});
  }, [slug, pageParam, locale]);

  const localeOptions = useMemo(
    () =>
      locales.map((code) => ({
        code,
        label: isLocaleCode(code) ? LOCALE_META[code].nativeLabel : code.toUpperCase(),
      })),
    [locales]
  );

  const siteDir = localeDir(locale);

  return (
    <div className="relative min-h-screen" lang={locale} dir={siteDir} data-sf-tenant="public">
      {(() => {
        const css = sanitizeCustomCss(customCss);
        return css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null;
      })()}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center p-3 md:justify-end md:p-4">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-black/5 bg-white/80 p-1 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-stone-900/80">
          <div className="flex items-center gap-0.5 px-0.5">
            {localeOptions.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => setLocale(opt.code)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  locale === opt.code
                    ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                    : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-stone-200 dark:bg-stone-700" />
          <button
            type="button"
            onClick={() => setMode((m) => (m === "light" ? "dark" : "light"))}
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            {mode === "light" ? "☾" : "☀"}
          </button>
        </div>
      </div>
      <div className="sf-tenant-root" lang={locale} dir={siteDir}>
        <SiteRenderer
          content={content}
          pageSlug={pageParam}
          locale={locale}
          colorMode={mode}
          siteSlug={slug}
        />
      </div>
    </div>
  );
}
