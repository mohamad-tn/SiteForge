"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SiteContent } from "@/lib/design";
import { LOCALE_META, isLocaleCode, localeDir, tokensForRender } from "@/lib/design";
import { SiteRenderer } from "@/components/site-renderer";
import { useSearchParams } from "next/navigation";
import { sanitizeCustomCss } from "@/lib/sanitize-css";
import { SF_SITE_VIEW_ATTR } from "@/components/platform-lang-provider";
import { SiteChromeProvider } from "@/components/site-chrome-context";
import { SiteModalHost } from "@/components/site-modal-host";

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
  const collectionParam = search.get("collection") || undefined;
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
      body: JSON.stringify({
        slug,
        path: pageParam ? `/${pageParam}` : "/",
        locale,
        collection: collectionParam || undefined,
      }),
    }).catch(() => {});
  }, [slug, pageParam, locale, collectionParam]);

  const localeOptions = useMemo(
    () =>
      locales.map((code) => ({
        code,
        label: isLocaleCode(code) ? LOCALE_META[code].nativeLabel : code.toUpperCase(),
      })),
    [locales]
  );

  const toggleTheme = useCallback(() => {
    setMode((m) => (m === "light" ? "dark" : "light"));
  }, []);

  const cycleLocale = useCallback(() => {
    if (locales.length < 2) return;
    setLocale((cur) => {
      const i = locales.indexOf(cur);
      const next = locales[(i + 1) % locales.length];
      return next || locales[0];
    });
  }, [locales]);

  const chrome = useMemo(
    () => ({
      toggleTheme,
      cycleLocale,
      colorMode: mode,
      locale,
      locales,
    }),
    [toggleTheme, cycleLocale, mode, locale, locales]
  );

  const siteDir = localeDir(locale);

  // Locale/theme bar follows SITE mode (tokensForRender), not platform html.dark — no inverted pill.
  const siteTokens = useMemo(() => tokensForRender(content.tokens, mode, locale), [content.tokens, mode, locale]);
  const barBg = siteTokens.colors.surface;
  const barFg = siteTokens.colors.text;
  const barMuted = siteTokens.colors.muted;
  const barBorder = mode === "light" ? "#d6d3d1" : "#3f3a36";
  const barActiveBg = barFg;
  const barActiveFg = barBg;

  return (
    <div className="relative min-h-screen overflow-x-hidden" lang={locale} dir={siteDir} data-sf-tenant="public">
      {(() => {
        const css = sanitizeCustomCss(customCss);
        return css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null;
      })()}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center p-3 md:justify-end md:p-4">
        <div
          className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-1.5 rounded-2xl border p-1.5 shadow-[var(--shadow-md)] backdrop-blur-xl"
          style={{
            background: barBg,
            color: barFg,
            borderColor: barBorder,
          }}
          data-sf-site-chrome="locale-bar"
          data-sf-mode={mode}
        >
          <div className="flex flex-wrap items-center gap-0.5 px-0.5" role="group" aria-label="Language">
            {localeOptions.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => setLocale(opt.code)}
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition"
                style={
                  locale === opt.code
                    ? { background: barActiveBg, color: barActiveFg }
                    : { color: barMuted, background: "transparent" }
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="h-4 w-px shrink-0" style={{ background: barBorder }} aria-hidden />
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition"
            style={{ color: barMuted }}
            aria-label={mode === "light" ? "Dark" : "Light"}
            title={mode === "light" ? "Dark" : "Light"}
          >
            {mode === "light" ? "☾" : "☀"}
          </button>
        </div>
      </div>
      <SiteChromeProvider value={chrome}>
        <div className="sf-tenant-root overflow-x-hidden" lang={locale} dir={siteDir}>
          <SiteRenderer
            content={content}
            pageSlug={pageParam}
            locale={locale}
            colorMode={mode}
            siteSlug={slug}
            focusCollectionSlug={collectionParam}
          />
          <SiteModalHost uiLang={locale === "ar" ? "ar" : "en"} />
        </div>
      </SiteChromeProvider>
    </div>
  );
}
