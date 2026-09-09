"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlatformLang } from "@/components/platform-lang-provider";

type SecretMeta = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

const copy = {
  ar: {
    title: "أسرار الموقع",
    body: "خزّن مفاتيح API على الخادم فقط. في محرر ربط API استخدم secret:NAME أو {{secret:NAME}} — القيمة الحقيقية لا تُنشر في JSON الموقع.",
    name: "اسم السر",
    value: "القيمة (مرة واحدة فقط)",
    add: "حفظ السر",
    empty: "لا أسرار بعد. أضف مثلاً WEBHOOK_TOKEN ثم اختره من تبويب API.",
    delete: "حذف",
    refresh: "تحديث",
    saved: "تم الحفظ — لن تُعرض القيمة مجدداً.",
    err: "تعذّر الحفظ",
    nameHint: "حروف وأرقام و _ - ويبدأ بحرف (مثل API_KEY)",
  },
  en: {
    title: "Site secrets",
    body: "Store API keys server-side only. In the API action editor use secret:NAME or {{secret:NAME}} — the real value never ships in published JSON.",
    name: "Secret name",
    value: "Value (write-only)",
    add: "Save secret",
    empty: "No secrets yet. Add e.g. WEBHOOK_TOKEN then pick it from the API tab.",
    delete: "Delete",
    refresh: "Refresh",
    saved: "Saved — value will not be shown again.",
    err: "Could not save",
    nameHint: "Letters, digits, _ -; must start with a letter (e.g. API_KEY)",
  },
} as const;

export function SiteSecretsPanel({ siteId }: { siteId: string }) {
  const { lang } = usePlatformLang();
  const c = copy[lang];
  const [rows, setRows] = useState<SecretMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/secrets`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.secrets || []);
      }
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/sites/${siteId}/secrets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg(typeof data.error === "string" ? data.error : c.err);
        return;
      }
      setName("");
      setValue("");
      setMsg(c.saved);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/sites/${siteId}/secrets?secretId=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await load();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-teal-700/15 bg-gradient-to-b from-teal-50/50 to-transparent p-3 dark:from-teal-950/25 dark:border-teal-500/15">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-800 dark:text-teal-200">
          {c.title}
        </h3>
        <Button size="sm" variant="ghost" className="h-7 rounded-full text-[11px]" onClick={load}>
          {c.refresh}
        </Button>
      </div>
      <p className="text-[11px] leading-5 text-stone-600 dark:text-stone-400">{c.body}</p>

      <div className="space-y-2 rounded-2xl border border-stone-200/80 bg-white/70 p-2.5 dark:border-stone-800 dark:bg-stone-950/40">
        <div className="space-y-1.5">
          <Label className="text-[11px] text-stone-500">{c.name}</Label>
          <Input
            dir="ltr"
            className="h-9 rounded-2xl font-mono text-sm"
            placeholder="API_TOKEN"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="text-[10px] text-stone-400">{c.nameHint}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-stone-500">{c.value}</Label>
          <Input
            dir="ltr"
            type="password"
            autoComplete="new-password"
            className="h-9 rounded-2xl font-mono text-sm"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-full"
          disabled={busy || !name.trim() || !value}
          onClick={save}
        >
          {c.add}
        </Button>
        {msg ? <p className="text-[10px] text-teal-800 dark:text-teal-300">{msg}</p> : null}
      </div>

      {loading ? <p className="text-xs text-stone-400">…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="py-2 text-center text-[11px] text-stone-400">{c.empty}</p>
      ) : null}
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-stone-200/80 px-2.5 py-2 text-xs dark:border-stone-800"
          >
            <div className="min-w-0">
              <div className="truncate font-mono font-semibold text-stone-800 dark:text-stone-100" dir="ltr">
                {r.name}
              </div>
              <div className="text-[10px] text-stone-400" dir="ltr">
                •••••••• · {new Date(r.updatedAt).toLocaleString(lang === "ar" ? "ar" : "en")}
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 text-[11px] font-semibold text-red-600"
              onClick={() => remove(r.id)}
            >
              {c.delete}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
