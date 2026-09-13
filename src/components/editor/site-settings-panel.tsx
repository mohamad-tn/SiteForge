"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  CUSTOM_CSS_TRUST_BLURB_AR,
  CUSTOM_CSS_TRUST_BLURB_EN,
  sanitizeCustomCss,
} from "@/lib/sanitize-css";
import { usePlatformLang } from "@/components/platform-lang-provider";
import { SiteSecretsPanel } from "@/components/editor/site-secrets-panel";
import { MediaField } from "@/components/editor/media-field";
import {
  normalizeHostname,
  recommendDnsRecords,
  RENDER_DASHBOARD_URL,
  type DomainLiveStatus,
} from "@/lib/domain-ssl";

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

export type SiteSettingsFocus = "seo" | "domain" | "secrets" | null;

export function SiteSettingsPanel({
  siteId,
  settings,
  onChange,
  focusSection = null,
  focusNonce = 0,
}: {
  siteId: string;
  settings: SiteSettings;
  onChange: (patch: Partial<SiteSettings>) => void;
  focusSection?: SiteSettingsFocus;
  focusNonce?: number;
}) {
  const { t, lang } = usePlatformLang();
  const seoRef = useRef<HTMLDivElement | null>(null);
  const domainRef = useRef<HTMLDivElement | null>(null);
  const secretsRef = useRef<HTMLDivElement | null>(null);
  const previewCss = sanitizeCustomCss(settings.customCss);
  const [liveStatus, setLiveStatus] = useState<DomainLiveStatus | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  useEffect(() => {
    if (!focusSection) return;
    const map = { seo: seoRef, domain: domainRef, secrets: secretsRef } as const;
    const el = map[focusSection]?.current;
    if (!el) return;
    const timer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-teal-600/40");
      window.setTimeout(() => el.classList.remove("ring-2", "ring-teal-600/40"), 1200);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [focusSection, focusNonce]);

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

  const dnsRec = useMemo(
    () => (settings.customDomain ? recommendDnsRecords(settings.customDomain) : null),
    [settings.customDomain]
  );

  const liveBadgeClass: Record<DomainLiveStatus, string> = {
    none: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
    "dns-pending": "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    "ssl-pending": "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
    active: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
    error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  };

  const effectiveLive: DomainLiveStatus =
    liveStatus ||
    (settings.domainStatus === "active"
      ? "active"
      : settings.domainStatus === "error"
        ? "error"
        : settings.domainStatus === "pending"
          ? "dns-pending"
          : "none");

  const liveBadgeLabel =
    effectiveLive === "dns-pending"
      ? t("domainDnsPending")
      : effectiveLive === "ssl-pending"
        ? t("domainSslPending")
        : effectiveLive === "active"
          ? t("domainActive")
          : effectiveLive === "error"
            ? t("domainError")
            : t("domainNone");

  const verifyDomain = useCallback(async () => {
    setVerifying(true);
    setVerifyError("");
    try {
      const res = await fetch(`/api/sites/${siteId}/domain-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persist: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data?.error || t("domainVerifyFail"));
        return;
      }
      setLiveStatus(data.status as DomainLiveStatus);
      if (data.legacyStatus) {
        onChange({ domainStatus: data.legacyStatus });
      }
    } catch {
      setVerifyError(t("domainVerifyFail"));
    } finally {
      setVerifying(false);
    }
  }, [onChange, siteId, t]);

  return (
    <div className="space-y-4">
      <div
        id="sf-site-seo"
        ref={seoRef}
        className="scroll-mt-4 space-y-4 rounded-2xl transition-[box-shadow] duration-300"
      >
      <div className="rounded-2xl border border-teal-700/15 bg-teal-50/60 px-3 py-2.5 dark:bg-teal-950/30">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-800 dark:text-teal-200">
          {t("seoSiteTitle")}
        </h3>
        <p className="mt-1 text-[11px] leading-5 text-stone-600 dark:text-[var(--muted)]">
          {t("seoSiteBody")}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-stone-600 dark:text-stone-300">{t("siteNameLabel")}</Label>
        <Input
          value={settings.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-10 rounded-2xl text-sm"
          dir="auto"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] text-stone-600 dark:text-stone-300">{t("seoTitleLabel")}</Label>
        <Input
          value={settings.seoTitle}
          onChange={(e) => onChange({ seoTitle: e.target.value })}
          className="h-10 rounded-2xl text-sm"
          dir="auto"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] text-stone-600 dark:text-stone-300">{t("seoDescLabel")}</Label>
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

      <div className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-3 dark:border-stone-800 dark:bg-stone-950/40">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-600 dark:text-stone-400">
          {t("seoChecklistTitle")}
        </div>
        <ul className="space-y-1.5 text-[11px] leading-5 text-stone-700 dark:text-stone-300">
          {[
            { ok: Boolean(settings.seoTitle.trim()), label: t("seoCheckTitle") },
            { ok: Boolean(settings.seoDescription.trim()), label: t("seoCheckDesc") },
            { ok: Boolean(settings.ogImage.trim()), label: t("seoCheckOg") },
          ].map((row) => (
            <li key={row.label} className="flex items-start gap-2">
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  row.ok ? "bg-teal-700 text-white" : "border border-stone-300 text-stone-500 dark:border-stone-600"
                }`}
                aria-hidden
              >
                {row.ok ? "✓" : ""}
              </span>
              <span className={row.ok ? "" : "text-amber-800 dark:text-amber-200"}>{row.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10px] leading-4 text-stone-600 dark:text-[var(--muted)]">{t("seoChecklistHint")}</p>
      </div>

      </div>

      <div
        id="sf-site-domain"
        ref={domainRef}
        className="scroll-mt-4 space-y-3 rounded-2xl border border-stone-200/80 p-3 transition-[box-shadow] duration-300 dark:border-stone-800"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-600 dark:text-[var(--muted)]">
            {t("customDomainTitle")}
          </h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${liveBadgeClass[effectiveLive]}`}>
            {liveBadgeLabel}
          </span>
        </div>
        <p className="text-[11px] leading-5 text-stone-600 dark:text-stone-300">{t("customDomainHint")}</p>

        <div className="space-y-1.5">
          <Label className="text-[11px] text-stone-600 dark:text-stone-300">{t("domainLabel")}</Label>
          <Input
            value={settings.customDomain}
            onChange={(e) => {
              const raw = e.target.value.trim().toLowerCase();
              const v = normalizeHostname(raw) || raw;
              setLiveStatus(null);
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

        <ol className="space-y-2 rounded-xl border border-teal-700/15 bg-teal-50/50 p-3 text-[11px] leading-5 text-stone-700 dark:bg-teal-950/30 dark:text-stone-200">
          <li>
            <span className="font-bold text-teal-800 dark:text-teal-200">1.</span> {t("domainStepSave")}
          </li>
          <li>
            <span className="font-bold text-teal-800 dark:text-teal-200">2.</span>{" "}
            {t("domainStepRender")}{" "}
            <a
              href={RENDER_DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-teal-800 underline underline-offset-2 dark:text-teal-200"
              dir="ltr"
            >
              Render dashboard
            </a>
          </li>
          <li>
            <span className="font-bold text-teal-800 dark:text-teal-200">3.</span> {t("domainStepDns")}
          </li>
          <li>
            <span className="font-bold text-teal-800 dark:text-teal-200">4.</span> {t("domainStepVerify")}
          </li>
        </ol>

        {dnsRec ? (
          <div className="space-y-2 rounded-xl bg-stone-50 p-2.5 dark:bg-stone-950/50" dir="ltr">
            <div className="mb-1 font-mono text-[10px] text-stone-600 dark:text-[var(--muted)]">DNS</div>
            {dnsRec.records.map((rec, i) => (
              <div
                key={`${rec.type}-${rec.host}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200/80 bg-white px-2.5 py-2 text-[11px] dark:border-stone-800 dark:bg-stone-900"
              >
                <div className="min-w-0 font-mono leading-5">
                  <div>
                    <span className="font-bold">{rec.type}</span> {rec.host}
                  </div>
                  <div className="text-stone-600 dark:text-stone-300">→ {rec.value}</div>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-stone-800 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-100"
                  onClick={() => {
                    void navigator.clipboard?.writeText(`${rec.type} ${rec.host} ${rec.value}`);
                  }}
                >
                  {t("domainCopyRecord")}
                </button>
              </div>
            ))}
            {dnsRec.kind === "apex" ? (
              <p className="text-[10px] leading-4 text-stone-600 dark:text-stone-400">{t("domainApexNote")}</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="rounded-full"
            disabled={!settings.customDomain || verifying}
            onClick={() => void verifyDomain()}
          >
            {verifying ? t("domainVerifying") : t("domainVerify")}
          </Button>
          {verifyError ? (
            <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">{verifyError}</span>
          ) : null}
        </div>

        <p className="text-[10px] leading-4 text-stone-600 dark:text-stone-300">{t("domainSslHonest")}</p>

        <div className="space-y-1.5">
          <Label className="text-[11px] text-stone-600 dark:text-stone-300">{t("domainStatusLabel")}</Label>
          <Select
            value={settings.domainStatus}
            onValueChange={(v) => onChange({ domainStatus: v as SiteSettings["domainStatus"] })}
            options={statusOptions}
          />
          <p className="text-[10px] leading-4 text-stone-600 dark:text-[var(--muted)]">{t("domainManualOverrideHint")}</p>
        </div>
      </div>

      <div id="sf-site-secrets" ref={secretsRef} className="scroll-mt-4 rounded-2xl transition-[box-shadow] duration-300">
        <SiteSecretsPanel siteId={siteId} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-stone-600 dark:text-stone-300">{t("customCssLabel")}</Label>
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
          <Label className="text-[11px] text-stone-600 dark:text-stone-300">{t("cssPreviewLabel")}</Label>
          <iframe
            title="CSS preview"
            sandbox="allow-same-origin"
            srcDoc={srcDoc}
            className="h-36 w-full rounded-2xl border border-stone-200/80 bg-white dark:border-stone-800"
          />
          <p className="text-[10px] leading-relaxed text-stone-600 dark:text-[var(--muted)]">{t("cssPreviewHint")}</p>
        </div>
      </div>
    </div>
  );
}
