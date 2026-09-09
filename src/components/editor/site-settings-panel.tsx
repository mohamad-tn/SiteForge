"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  CUSTOM_CSS_TRUST_BLURB_AR,
  CUSTOM_CSS_TRUST_BLURB_EN,
  sanitizeCustomCss,
} from "@/lib/sanitize-css";
import { usePlatformLang } from "@/components/platform-lang-provider";
import { SiteSecretsPanel } from "@/components/editor/site-secrets-panel";
import { MediaField } from "@/components/editor/media-field";

export type SiteSettings = {
  name: string;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  favicon: string;
  customCss: string;
  customDomain: string;
  domainStatus: "none" | "pending" | "active" | "error";
};

export function SiteSettingsPanel({
  siteId,
  settings,
  onChange,
}: {
  siteId: string;
  settings: SiteSettings;
  onChange: (patch: Partial<SiteSettings>) => void;
}) {
  const { t, lang } = usePlatformLang();
  const previewCss = sanitizeCustomCss(settings.customCss);
  const srcDoc = useMemo(() => {
    const css = previewCss || "/* add CSS to preview */";
    const sampleTitle = lang === "ar" ? "معاينة قسم" : "Section preview";
    const sampleBody =
      lang === "ar"
        ? "إطار معزول (sandbox بدون سكربت) لتجربة CSS بأمان نسبي."
        : "Sandboxed iframe (no scripts) for a relatively safe CSS preview.";
    const htmlLang = lang === "ar" ? "ar" : "en";
    const dir = lang === "ar" ? "rtl" : "ltr";
    return `<!doctype html><html lang="${htmlLang}" dir="${dir}"><head><meta charset="utf-8"/><style>
body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#faf8f5;color:#1c1917}
.sample{padding:16px;border-radius:16px;border:1px solid #e7e1d6;background:#fff}
.sample h2{margin:0 0 8px;font-size:18px}
.sample p{margin:0;font-size:13px;line-height:1.6;color:#78716c}
${css}
</style></head><body><div class="sf-tenant-root"><div class="sample"><h2>${sampleTitle}</h2><p>${sampleBody}</p></div></div></body></html>`;
  }, [previewCss, lang]);

  const statusOptions = [
    { value: "none", label: t("domainNone") },
    { value: "pending", label: t("domainPending") },
    { value: "active", label: t("domainActive") },
    { value: "error", label: t("domainError") },
  ];
  const badgeClass: Record<SiteSettings["domainStatus"], string> = {
    none: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
    pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    active: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
    error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  };
  const badgeLabel =
    statusOptions.find((o) => o.value === settings.domainStatus)?.label || t("domainNone");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-teal-700/15 bg-teal-50/60 px-3 py-2.5 dark:bg-teal-950/30">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-800 dark:text-teal-200">
          {t("seoSiteTitle")}
        </h3>
        <p className="mt-1 text-[11px] leading-5 text-stone-600 dark:text-stone-400">
          {t("seoSiteBody")}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-stone-500">{t("siteNameLabel")}</Label>
        <Input
          value={settings.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-10 rounded-2xl text-sm"
          dir="auto"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] text-stone-500">{t("seoTitleLabel")}</Label>
        <Input
          value={settings.seoTitle}
          onChange={(e) => onChange({ seoTitle: e.target.value })}
          className="h-10 rounded-2xl text-sm"
          dir="auto"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] text-stone-500">{t("seoDescLabel")}</Label>
        <Textarea
          value={settings.seoDescription}
          onChange={(e) => onChange({ seoDescription: e.target.value })}
          className="min-h-[80px] rounded-2xl text-sm"
        />
      </div>
      <MediaField
        label={t("ogImageLabel")}
        value={settings.ogImage}
        onChange={(url) => onChange({ ogImage: url })}
        kind="image"
        accept="image/*"
      />
      <MediaField
        label={t("faviconLabel")}
        value={settings.favicon}
        onChange={(url) => onChange({ favicon: url })}
        kind="image"
        accept="image/*"
      />

      <div className="space-y-3 rounded-2xl border border-stone-200/80 p-3 dark:border-stone-800">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">
            {t("customDomainTitle")}
          </h3>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeClass[settings.domainStatus]}`}
          >
            {badgeLabel}
          </span>
        </div>
        <p className="text-[11px] leading-5 text-stone-500">{t("customDomainHint")}</p>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-stone-500">{t("domainLabel")}</Label>
          <Input
            value={settings.customDomain}
            onChange={(e) => {
              const v = e.target.value.trim().toLowerCase();
              onChange({
                customDomain: v,
                domainStatus: v
                  ? settings.domainStatus === "none"
                    ? "pending"
                    : settings.domainStatus
                  : "none",
              });
            }}
            className="h-10 rounded-2xl font-mono text-sm"
            dir="ltr"
            placeholder="www.example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-stone-500">{t("domainStatusLabel")}</Label>
          <Select
            value={settings.domainStatus}
            onValueChange={(v) => onChange({ domainStatus: v as SiteSettings["domainStatus"] })}
            options={statusOptions}
          />
        </div>
        {settings.customDomain ? (
          <div
            className="rounded-xl bg-stone-50 p-2.5 text-[11px] leading-5 dark:bg-stone-950/50"
            dir="ltr"
          >
            <div className="mb-1 font-mono text-[10px] text-stone-500">DNS</div>
            <div>
              CNAME <strong>{settings.customDomain}</strong> → <strong>siteforge.host</strong>
            </div>
          </div>
        ) : null}
      </div>

      <SiteSecretsPanel siteId={siteId} />

      <div className="space-y-1.5">
        <Label className="text-[11px] text-stone-500">{t("customCssLabel")}</Label>
        <Textarea
          value={settings.customCss}
          onChange={(e) => onChange({ customCss: e.target.value })}
          className="min-h-[120px] rounded-2xl font-mono text-xs"
          dir="ltr"
          placeholder={".sf-tenant-root h1 { letter-spacing: -0.02em; }"}
        />
        <p className="text-[10px] leading-relaxed text-amber-800/90 dark:text-amber-200/80">
          {lang === "ar" ? CUSTOM_CSS_TRUST_BLURB_AR : CUSTOM_CSS_TRUST_BLURB_EN}
        </p>
        <div className="space-y-1.5 pt-1">
          <Label className="text-[11px] text-stone-500">{t("cssPreviewLabel")}</Label>
          <iframe
            title="CSS preview"
            sandbox="allow-same-origin"
            srcDoc={srcDoc}
            className="h-36 w-full rounded-2xl border border-stone-200/80 bg-white dark:border-stone-800"
          />
          <p className="text-[10px] leading-relaxed text-stone-400">{t("cssPreviewHint")}</p>
        </div>
      </div>
    </div>
  );
}
