"use client";

import { useCallback, useEffect, useState } from "react";
import { SoftCard } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { usePlatformLang } from "@/components/platform-lang-provider";

type Settings = {
  provider: string;
  model: string;
  enabled: boolean;
  defaultDailyLimit: number;
  maxTokens: number;
  hasApiKey: boolean;
};

type QuotaRow = {
  userId: string;
  email: string;
  name: string | null;
  dailyLimit: number | null;
  usedToday: number;
};

type CatalogModel = { id: string; label: string; vision?: boolean };

const OTHER = "__other__";

export function AdminAiPanel() {
  const { t, lang } = usePlatformLang();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [quotas, setQuotas] = useState<QuotaRow[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [quotaUserId, setQuotaUserId] = useState("");
  const [quotaLimit, setQuotaLimit] = useState("20");
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [modelsSource, setModelsSource] = useState<"live" | "fallback" | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [customModel, setCustomModel] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/ai");
    if (!res.ok) return;
    const data = await res.json();
    setSettings(data.settings);
    setQuotas(data.quotas || []);
  }

  const loadModels = useCallback(async (provider: string, currentModel?: string) => {
    setModelsLoading(true);
    try {
      const res = await fetch(`/api/admin/ai/models?provider=${encodeURIComponent(provider)}`);
      if (!res.ok) {
        setModels([]);
        setModelsSource("fallback");
        setCustomModel(true);
        return;
      }
      const data = await res.json();
      const list = (data.models || []) as CatalogModel[];
      setModels(list);
      setModelsSource(data.source === "live" ? "live" : "fallback");
      if (currentModel && list.length && !list.some((m) => m.id === currentModel)) {
        setCustomModel(true);
      } else {
        setCustomModel(false);
      }
    } catch {
      setModels([]);
      setModelsSource("fallback");
      setCustomModel(true);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!settings?.provider) return;
    void loadModels(settings.provider, settings.model);
  }, [settings?.provider, loadModels]); // eslint-disable-line react-hooks/exhaustive-deps -- reload on provider change only

  async function save() {
    if (!settings || saving) return;
    setSaving(true);
    setMsg("");
    try {
      const body: Record<string, unknown> = {
        provider: settings.provider,
        model: settings.model,
        enabled: settings.enabled,
        defaultDailyLimit: settings.defaultDailyLimit,
        maxTokens: settings.maxTokens,
      };
      if (clearKey) body.apiKey = null;
      else if (apiKey.trim()) body.apiKey = apiKey.trim();
      const res = await fetch("/api/admin/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setMsg(t("aiError"));
        return;
      }
      const data = await res.json();
      setSettings(data.settings);
      setApiKey("");
      setClearKey(false);
      setMsg(lang === "ar" ? "تم الحفظ" : "Saved");
      void loadModels(data.settings.provider, data.settings.model);
    } finally {
      setSaving(false);
    }
  }

  async function saveUserQuota() {
    if (!quotaUserId.trim()) return;
    const n = quotaLimit.trim() === "" ? null : Number(quotaLimit);
    const res = await fetch("/api/admin/ai", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: quotaUserId.trim(), dailyLimit: n }),
    });
    if (res.ok) {
      setMsg(lang === "ar" ? "تم تحديث الحصة" : "Quota updated");
      void load();
    }
  }

  if (!settings) {
    return <SoftCard className="p-5 text-sm text-[var(--muted)]">{t("loading")}</SoftCard>;
  }

  const modelOptions = [
    ...models.map((m) => ({
      value: m.id,
      label: m.vision ? `${m.label} · vision` : m.label,
    })),
    { value: OTHER, label: t("aiModelOther") },
  ];

  const selectValue = customModel || !models.some((m) => m.id === settings.model) ? OTHER : settings.model;

  return (
    <div className="space-y-4">
      <SoftCard className="space-y-4 p-5">
        <div>
          <h2 className="text-base font-bold">{t("aiAdminTitle")}</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{t("aiAdminHint")}</p>
          <p className="mt-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px] leading-5 text-[var(--muted)]">
            {t("aiSecurityTip")}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("aiProvider")}</Label>
            <Select
              value={settings.provider}
              onValueChange={(v) => {
                setSettings({ ...settings, provider: v });
                setCustomModel(false);
              }}
              options={[
                { value: "openai", label: "OpenAI" },
                { value: "anthropic", label: "Anthropic" },
                { value: "xai", label: "xAI (Grok)" },
                { value: "google", label: "Google" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>{t("aiModel")}</Label>
              {modelsSource ? (
                <span className="text-[10px] text-[var(--muted)]">
                  {modelsLoading
                    ? t("aiModelsLoading")
                    : modelsSource === "live"
                      ? t("aiModelsLive")
                      : t("aiModelsFallback")}
                </span>
              ) : null}
            </div>
            <Select
              value={selectValue}
              onValueChange={(v) => {
                if (v === OTHER) {
                  setCustomModel(true);
                  return;
                }
                setCustomModel(false);
                setSettings({ ...settings, model: v });
              }}
              options={modelOptions}
              disabled={modelsLoading && models.length === 0}
              placeholder={modelsLoading ? t("aiModelsLoading") : "—"}
            />
            {customModel || selectValue === OTHER ? (
              <Input
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                className="mt-1.5 h-10 rounded-2xl font-mono text-xs"
                dir="ltr"
                placeholder="model-id"
              />
            ) : null}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("aiApiKey")}</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setClearKey(false);
              }}
              placeholder={settings.hasApiKey ? t("aiApiKeySet") : "sk-…"}
              className="h-10 rounded-2xl font-mono text-xs"
              dir="ltr"
              autoComplete="off"
            />
            {settings.hasApiKey ? (
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <input type="checkbox" checked={clearKey} onChange={(e) => setClearKey(e.target.checked)} />
                {t("aiApiKeyClear")}
              </label>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>{t("aiDefaultQuota")}</Label>
            <Input
              type="number"
              min={0}
              max={1000}
              value={settings.defaultDailyLimit}
              onChange={(e) =>
                setSettings({ ...settings, defaultDailyLimit: Number(e.target.value) || 0 })
              }
              className="h-10 rounded-2xl"
              dir="ltr"
            />
            <p className="text-[11px] leading-5 text-[var(--muted)]">{t("aiDefaultQuotaHelp")}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t("aiMaxTokens")}</Label>
            <Input
              type="number"
              min={256}
              max={128000}
              value={settings.maxTokens}
              onChange={(e) => setSettings({ ...settings, maxTokens: Number(e.target.value) || 4096 })}
              className="h-10 rounded-2xl"
              dir="ltr"
            />
            <p className="text-[11px] leading-5 text-[var(--muted)]">{t("aiMaxTokensHelp")}</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
          />
          {t("aiEnabled")}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" className="rounded-full bg-teal-800 hover:bg-teal-700" disabled={saving} onClick={() => void save()}>
            {saving ? t("saving") : t("aiSaveSettings")}
          </Button>
          {msg ? <span className="text-xs text-[var(--muted)]">{msg}</span> : null}
        </div>
      </SoftCard>

      <SoftCard className="space-y-3 p-5">
        <h3 className="font-semibold">{t("aiPerUserQuota")}</h3>
        <div className="grid gap-2 sm:grid-cols-[1fr_6rem_auto]">
          <Input
            placeholder="userId"
            value={quotaUserId}
            onChange={(e) => setQuotaUserId(e.target.value)}
            className="h-10 rounded-2xl font-mono text-xs"
            dir="ltr"
          />
          <Input
            type="number"
            value={quotaLimit}
            onChange={(e) => setQuotaLimit(e.target.value)}
            className="h-10 rounded-2xl"
            dir="ltr"
          />
          <Button type="button" variant="outline" className="rounded-full" onClick={() => void saveUserQuota()}>
            {t("save")}
          </Button>
        </div>
        <ul className="divide-y divide-[var(--border)] text-sm">
          {quotas.map((q) => (
            <li key={q.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="font-medium break-all">{q.email}</span>
                <span className="ms-2 font-mono text-[10px] text-[var(--muted)]" dir="ltr">
                  {q.userId}
                </span>
              </span>
              <span className="text-xs text-[var(--muted)]">
                {q.usedToday}/{q.dailyLimit ?? "default"}
              </span>
            </li>
          ))}
        </ul>
      </SoftCard>
    </div>
  );
}
