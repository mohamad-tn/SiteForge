"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented";
import {
  HTTP_METHODS,
  JSON_CONTENT_TYPE_PRESET,
  defaultHttpAction,
  newKvRow,
  parseClickBehavior,
  parseHttpAction,
  type BodyMode,
  type ClickBehavior,
  type HttpAction,
  type HttpMethod,
  type KvRow,
  type RunMode,
} from "@/lib/http-action";
import type { PlatformLang } from "@/lib/platform-i18n";

type Tab = "headers" | "query" | "path" | "body";

const copy = {
  ar: {
    title: "ربط بخدمة خارجية",
    subtitle: "عند النقر أو إرسال النموذج، أرسل البيانات إلى خدمتك (مثل Zapier أو واجهتك).",
    enabled: "تفعيل الإرسال الخارجي",
    clickBehavior: "ماذا يحدث عند النقر؟",
    linkOnly: "فتح الرابط فقط",
    httpOnly: "إرسال البيانات فقط",
    both: "أرسل ثم افتح الرابط",
    method: "نوع الطلب",
    url: "رابط الخدمة",
    urlHint: "مثال: https://hooks.zapier.com/... — يمكنك وضع {id} في المسار وتعبئته من تبويب المسار.",
    runMode: "كيف يُرسل الطلب؟",
    proxy: "عبر SiteForge (موصى به — أسرار آمنة)",
    browser: "من متصفح الزائر (يحتاج CORS)",
    proxyHint: "الوكيل يمنع SSRF ويحلّ أسرار الموقع من الخزنة على الخادم فقط. استخدم secret:NAME أو {{secret:NAME}} بدل لصق المفتاح.",
    browserHint: "يحتاج API الخاص بك إلى السماح بـ CORS من نطاق موقعك. لا تضع أسراراً — ستظهر في كود الصفحة.",
    secretWarn:
      "الخزنة: أضف السر من إعدادات الموقع → «أسرار الموقع»، ثم اختره هنا لـ Authorization. المنشور يحتوي الاسم فقط (secret:NAME) والقيمة تُحقن في الوكيل.",
    pickSecret: "إدراج سر من الخزنة",
    bearerSecret: "Authorization: Bearer + سر",
    noSecrets: "لا أسرار — أضفها من تبويب الموقع",
    vaultHint: "القيمة في JSON المنشور ستكون مرجعًا فقط، وليست المفتاح الحقيقي.",
    tabs: { headers: "رؤوس", query: "استعلام", path: "مسار", body: "جسم" },
    addRow: "إضافة صف",
    key: "المفتاح",
    value: "القيمة",
    secret: "سر",
    presetJson: "Content-Type: JSON",
    bodyMode: "نوع الجسم",
    none: "بدون",
    json: "JSON",
    form: "نموذج (x-www-form-urlencoded)",
    raw: "نص خام",
    bodyJson: "قالب JSON",
    bodyJsonHint: "للكتل من نوع نموذج: تُدمج حقول الزائر تلقائياً مع القالب والحقول الثابتة أدناه.",
    bodyRaw: "النص الخام",
    staticFields: "حقول ثابتة إضافية",
    successMsg: "رسالة النجاح (اختياري)",
    errorMsg: "رسالة الخطأ (اختياري)",
    saveLocal: "حفظ نسخة محلية في صندوق الردود أيضاً",
    helpForm:
      "للنماذج: اختر POST + عبر SiteForge، الصق رابط الخدمة (Zapier / Make / n8n)، ثم انشر. تُرسل حقول النموذج تلقائياً.",
    test: "تجربة الطلب",
    testing: "جاري التجربة…",
    testHint: "يجرّب الإعداد الحالي ويعرض النتيجة هنا دون مغادرة المحرر.",
    testNeedUrl: "أدخل رابط الخدمة أولاً",
    testSummary: "ملخص الطلب",
    testResponse: "الرد",
    testOk: "نجح",
    testFail: "فشل",
  },
  en: {
    title: "Connect external service",
    subtitle: "On click or form submit, send data to your service (Zapier, webhook, your API).",
    enabled: "Enable external send",
    clickBehavior: "What happens on click?",
    linkOnly: "Open link only",
    httpOnly: "Send data only",
    both: "Send then open link",
    method: "Request type",
    url: "Service URL",
    urlHint: "Example: https://hooks.zapier.com/... — use {id} in the path and fill it from the Path tab.",
    runMode: "How should it send?",
    proxy: "Via SiteForge (recommended — secrets stay safe)",
    browser: "From visitor browser (needs CORS)",
    proxyHint: "Proxy blocks SSRF and resolves site vault secrets server-side. Prefer secret:NAME or {{secret:NAME}} over pasting keys.",
    browserHint: "Your API must allow CORS from your site origin. Never put secrets here — they ship in page JSON.",
    secretWarn:
      "Vault: add secrets under Site settings → Site secrets, then pick one for Authorization. Published JSON stores only the name (secret:NAME); the proxy injects the value.",
    pickSecret: "Insert vault secret",
    bearerSecret: "Authorization: Bearer + secret",
    noSecrets: "No secrets — add them in the Site tab",
    vaultHint: "Published JSON will keep a reference only — never the real key.",
    tabs: { headers: "Headers", query: "Query", path: "Path", body: "Body" },
    addRow: "Add row",
    key: "Key",
    value: "Value",
    secret: "Secret",
    presetJson: "Content-Type: JSON",
    bodyMode: "Body type",
    none: "None",
    json: "JSON",
    form: "Form (x-www-form-urlencoded)",
    raw: "Raw text",
    bodyJson: "JSON template",
    bodyJsonHint: "For form blocks: visitor fields are merged into the template plus static fields below.",
    bodyRaw: "Raw body",
    staticFields: "Extra static fields",
    successMsg: "Success message (optional)",
    errorMsg: "Error message (optional)",
    saveLocal: "Also save a local copy in the replies inbox",
    helpForm:
      "For forms: pick POST + Via SiteForge, paste your webhook URL (Zapier / Make / n8n), then publish. Form fields are sent automatically.",
    test: "Test request",
    testing: "Testing…",
    testHint: "Runs the current setup and shows the result here without leaving the editor.",
    testNeedUrl: "Enter the service URL first",
    testSummary: "Request summary",
    testResponse: "Response",
    testOk: "Success",
    testFail: "Failed",
  },
} as const;

function KvEditor({
  rows,
  onChange,
  showSecret,
  lang,
  secretNames,
}: {
  rows: KvRow[];
  onChange: (rows: KvRow[]) => void;
  showSecret?: boolean;
  lang: PlatformLang;
  secretNames?: string[];
}) {
  const c = copy[lang];
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={row.id} className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              className="h-8 flex-1 min-w-[5rem] rounded-xl font-mono text-xs"
              dir="ltr"
              placeholder={c.key}
              value={row.key}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, key: e.target.value };
                onChange(next);
              }}
            />
            <Input
              className="h-8 flex-[1.4] min-w-[6rem] rounded-xl font-mono text-xs"
              dir="ltr"
              type={row.secret && !row.value.startsWith("secret:") && !row.value.includes("{{secret:") ? "password" : "text"}
              placeholder={c.value}
              value={row.value}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, value: e.target.value };
                onChange(next);
              }}
            />
            {showSecret ? (
              <label className="flex items-center gap-1 text-[10px] text-stone-500 shrink-0">
                <input
                  type="checkbox"
                  className="accent-teal-700"
                  checked={!!row.secret}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...row, secret: e.target.checked };
                    onChange(next);
                  }}
                />
                {c.secret}
              </label>
            ) : null}
            <button
              type="button"
              className="h-8 w-8 rounded-xl text-stone-400 hover:bg-stone-100 hover:text-red-600 dark:hover:bg-stone-800"
              aria-label="Remove"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
          {showSecret && secretNames && secretNames.length > 0 ? (
            <select
              className="h-7 w-full rounded-xl border border-stone-200 bg-white px-2 font-mono text-[10px] dark:border-stone-700 dark:bg-stone-950"
              dir="ltr"
              defaultValue=""
              onChange={(e) => {
                const n = e.target.value;
                if (!n) return;
                const next = [...rows];
                next[i] = { ...row, value: `secret:${n}`, secret: true };
                onChange(next);
                e.target.value = "";
              }}
            >
              <option value="">{c.pickSecret}…</option>
              {secretNames.map((n) => (
                <option key={n} value={n}>
                  secret:{n}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        className="text-[11px] font-semibold text-teal-800 dark:text-teal-300"
        onClick={() => onChange([...rows, newKvRow()])}
      >
        + {c.addRow}
      </button>
    </div>
  );
}

export function ApiActionEditor({
  props,
  lang,
  siteId,
  isForm,
  showClickBehavior,
  onChange,
}: {
  props: Record<string, unknown>;
  lang: PlatformLang;
  siteId?: string;
  isForm?: boolean;
  showClickBehavior?: boolean;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const c = copy[lang];
  const action = useMemo(() => parseHttpAction(props.httpAction), [props.httpAction]);
  const behavior = parseClickBehavior(props.clickBehavior);
  const [tab, setTab] = useState<Tab>("headers");
  const [secretNames, setSecretNames] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    status: number | null;
    message?: string;
    summary?: unknown;
    bodyPreview?: string | null;
    error?: string;
    dryRun?: boolean;
  } | null>(null);

  const loadSecrets = useCallback(async () => {
    if (!siteId) return;
    try {
      const res = await fetch(`/api/sites/${siteId}/secrets`);
      if (res.ok) {
        const data = await res.json();
        setSecretNames((data.secrets || []).map((s: { name: string }) => s.name));
      }
    } catch {
      /* ignore */
    }
  }, [siteId]);

  useEffect(() => {
    loadSecrets();
  }, [loadSecrets]);

  function patchAction(partial: Partial<HttpAction>) {
    const next = { ...action, ...partial };
    onChange({ httpAction: next });
  }

  function setEnabled(v: boolean) {
    const next = action.url || action.enabled ? { ...action, enabled: v } : defaultHttpAction({ enabled: v, runMode: isForm ? "proxy" : "proxy" });
    onChange({
      httpAction: next,
      ...(v && showClickBehavior && behavior === "link" ? { clickBehavior: isForm ? "http" : "http" } : {}),
    });
  }

  async function runTest() {
    if (!action.url?.trim()) {
      setTestResult({ ok: false, status: null, message: c.testNeedUrl });
      return;
    }
    if (!siteId) {
      setTestResult({ ok: false, status: null, message: "Missing site" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const sampleData = isForm
        ? { name: "Test User", email: "test@example.com", message: "SiteForge test" }
        : { source: "siteforge-editor-test" };
      const res = await fetch(`/api/sites/${siteId}/http-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ httpAction: action, sampleData }),
      });
      const data = await res.json().catch(() => ({}));
      setTestResult({
        ok: !!data.ok && res.ok,
        status: data.status ?? res.status,
        message: data.message || data.error || (res.ok ? c.testOk : c.testFail),
        summary: data.summary,
        bodyPreview: data.bodyPreview ?? null,
        error: data.error,
        dryRun: data.dryRun,
      });
    } catch {
      setTestResult({ ok: false, status: null, message: c.testFail });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-teal-700/15 bg-gradient-to-b from-teal-50/60 to-transparent p-3 dark:from-teal-950/30 dark:border-teal-500/15">
      <div>
        <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100">{c.title}</h3>
        <p className="mt-0.5 text-[11px] leading-5 text-stone-500 dark:text-stone-400">{c.subtitle}</p>
      </div>

      {isForm ? (
        <p className="rounded-xl bg-white/70 px-2.5 py-2 text-[10px] leading-5 text-stone-600 dark:bg-stone-950/40 dark:text-stone-300">
          {c.helpForm}
        </p>
      ) : null}

      <label className="flex items-center gap-2 rounded-2xl border border-stone-200/80 bg-white/80 px-3 py-2.5 text-sm dark:border-stone-800 dark:bg-stone-950/50">
        <input
          type="checkbox"
          className="accent-teal-700"
          checked={action.enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span className="font-medium">{c.enabled}</span>
      </label>

      {!action.enabled ? null : (
        <>
          {showClickBehavior ? (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-stone-500">{c.clickBehavior}</Label>
              <SegmentedControl
                aria-label={c.clickBehavior}
                value={behavior}
                onChange={(v) => onChange({ clickBehavior: v as ClickBehavior })}
                items={[
                  { value: "link", label: c.linkOnly },
                  { value: "http", label: c.httpOnly },
                  { value: "both", label: c.both },
                ]}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-[11px] text-stone-500">{c.method}</Label>
            <div className="overflow-x-auto">
              <SegmentedControl
                aria-label={c.method}
                value={action.method}
                onChange={(v) => patchAction({ method: v as HttpMethod })}
                items={HTTP_METHODS.map((m) => ({ value: m, label: m }))}
                className="min-w-max"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-stone-500">{c.url}</Label>
            <Input
              dir="ltr"
              className="h-10 rounded-2xl font-mono text-sm"
              placeholder="https://api.example.com/hooks/{id}"
              value={action.url}
              onChange={(e) => patchAction({ url: e.target.value })}
            />
            <p className="text-[10px] leading-4 text-stone-400">{c.urlHint}</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-stone-500">{c.runMode}</Label>
            <Select
              value={action.runMode}
              onValueChange={(v) => patchAction({ runMode: v as RunMode })}
              options={[
                { value: "proxy", label: c.proxy },
                { value: "browser", label: c.browser },
              ]}
            />
            <p className="text-[10px] leading-5 text-amber-900/80 dark:text-amber-100/80">
              {action.runMode === "proxy" ? c.proxyHint : c.browserHint}
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/25 bg-amber-50/80 px-2.5 py-2 text-[10px] leading-5 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100/90">
            {c.secretWarn}
          </div>

          <div className="flex gap-0.5 rounded-2xl bg-stone-100/90 p-1 dark:bg-stone-950">
            {(Object.keys(c.tabs) as Tab[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`flex-1 rounded-xl py-1.5 text-[10px] font-semibold transition ${
                  tab === k
                    ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-50"
                    : "text-stone-500 hover:text-stone-800 dark:text-stone-400"
                }`}
              >
                {c.tabs[k]}
              </button>
            ))}
          </div>

          {tab === "headers" ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-[10px] font-semibold text-teal-800 dark:text-teal-300"
                  onClick={() => {
                    const has = action.headers.some((h) => h.key.toLowerCase() === "content-type");
                    if (has) return;
                    patchAction({ headers: [...action.headers, newKvRow(JSON_CONTENT_TYPE_PRESET)] });
                  }}
                >
                  + {c.presetJson}
                </button>
                {secretNames.length > 0 ? (
                  <select
                    className="h-7 max-w-full rounded-xl border border-teal-700/20 bg-white px-2 font-mono text-[10px] dark:bg-stone-950"
                    dir="ltr"
                    defaultValue=""
                    onChange={(e) => {
                      const n = e.target.value;
                      if (!n) return;
                      const without = action.headers.filter((h) => h.key.toLowerCase() !== "authorization");
                      patchAction({
                        headers: [
                          ...without,
                          newKvRow({ key: "Authorization", value: `Bearer {{secret:${n}}}`, secret: true }),
                        ],
                      });
                      e.target.value = "";
                    }}
                  >
                    <option value="">{c.bearerSecret}…</option>
                    {secretNames.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                ) : siteId ? (
                  <span className="text-[10px] text-stone-400">{c.noSecrets}</span>
                ) : null}
              </div>
              <p className="text-[10px] leading-4 text-stone-400">{c.vaultHint}</p>
              <KvEditor
                lang={lang}
                showSecret
                secretNames={secretNames}
                rows={action.headers}
                onChange={(headers) => patchAction({ headers })}
              />
            </div>
          ) : null}

          {tab === "query" ? (
            <KvEditor lang={lang} rows={action.query} onChange={(query) => patchAction({ query })} />
          ) : null}

          {tab === "path" ? (
            <KvEditor lang={lang} rows={action.pathParams} onChange={(pathParams) => patchAction({ pathParams })} />
          ) : null}

          {tab === "body" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-stone-500">{c.bodyMode}</Label>
                <Select
                  value={action.bodyMode}
                  onValueChange={(v) => patchAction({ bodyMode: v as BodyMode })}
                  options={[
                    { value: "none", label: c.none },
                    { value: "json", label: c.json },
                    { value: "form", label: c.form },
                    { value: "raw", label: c.raw },
                  ]}
                />
              </div>
              {action.bodyMode === "json" ? (
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-stone-500">{c.bodyJson}</Label>
                  <Textarea
                    dir="ltr"
                    className="min-h-[100px] rounded-2xl font-mono text-xs"
                    value={action.bodyJson}
                    onChange={(e) => patchAction({ bodyJson: e.target.value })}
                  />
                  <p className="text-[10px] text-stone-400">{c.bodyJsonHint}</p>
                </div>
              ) : null}
              {action.bodyMode === "raw" ? (
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-stone-500">{c.bodyRaw}</Label>
                  <Textarea
                    dir="ltr"
                    className="min-h-[80px] rounded-2xl font-mono text-xs"
                    value={action.bodyRaw}
                    onChange={(e) => patchAction({ bodyRaw: e.target.value })}
                  />
                </div>
              ) : null}
              {(action.bodyMode === "json" || action.bodyMode === "form") && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-stone-500">{c.staticFields}</Label>
                  <KvEditor
                    lang={lang}
                    rows={action.formFields}
                    onChange={(formFields) => patchAction({ formFields })}
                  />
                </div>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-stone-500">{c.successMsg}</Label>
              <Input
                className="h-9 rounded-2xl text-sm"
                value={action.successMessage}
                onChange={(e) => patchAction({ successMessage: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-stone-500">{c.errorMsg}</Label>
              <Input
                className="h-9 rounded-2xl text-sm"
                value={action.errorMessage}
                onChange={(e) => patchAction({ errorMessage: e.target.value })}
              />
            </div>
          </div>

          {isForm ? (
            <label className="flex items-center gap-2 rounded-2xl border border-stone-200/80 px-3 py-2.5 text-sm dark:border-stone-800">
              <input
                type="checkbox"
                className="accent-teal-700"
                checked={action.saveLocally}
                onChange={(e) => patchAction({ saveLocally: e.target.checked })}
              />
              {c.saveLocal}
            </label>
          ) : null}

          <div className="space-y-2 rounded-2xl border border-stone-200/80 bg-white/80 p-3 dark:border-stone-800 dark:bg-stone-950/40">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-stone-800 dark:text-stone-100">{c.test}</div>
                <p className="text-[10px] leading-4 text-stone-400">{c.testHint}</p>
              </div>
              <button
                type="button"
                disabled={testing || !siteId}
                onClick={runTest}
                className="shrink-0 rounded-full bg-teal-800 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50 hover:bg-teal-700"
              >
                {testing ? c.testing : c.test}
              </button>
            </div>
            {testResult ? (
              <div
                className={`rounded-xl border px-2.5 py-2 text-[11px] leading-5 ${
                  testResult.ok
                    ? "border-teal-600/30 bg-teal-50/80 text-teal-950 dark:bg-teal-950/40 dark:text-teal-100"
                    : "border-rose-500/30 bg-rose-50/80 text-rose-950 dark:bg-rose-950/40 dark:text-rose-100"
                }`}
              >
                <div className="font-bold">
                  {testResult.ok ? c.testOk : c.testFail}
                  {testResult.status != null ? ` · HTTP ${testResult.status}` : ""}
                  {testResult.dryRun ? " · dry-run" : ""}
                </div>
                {testResult.message ? <p className="mt-1">{testResult.message}</p> : null}
                {testResult.summary ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-semibold">{c.testSummary}</summary>
                    <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-black/5 p-2 font-mono text-[10px] dark:bg-white/5" dir="ltr">
{JSON.stringify(testResult.summary, null, 2)}
                    </pre>
                  </details>
                ) : null}
                {testResult.bodyPreview ? (
                  <details className="mt-2" open>
                    <summary className="cursor-pointer font-semibold">{c.testResponse}</summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-black/5 p-2 font-mono text-[10px] dark:bg-white/5" dir="ltr">
{testResult.bodyPreview}
                    </pre>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

export function blockSupportsHttpAction(type: string): boolean {
  return type === "button" || type === "form" || type === "navbar" || type === "hero" || type === "cta" || type === "contact";
}

export function blockShowsClickBehavior(type: string): boolean {
  return type === "button" || type === "navbar" || type === "hero" || type === "cta" || type === "contact";
}
