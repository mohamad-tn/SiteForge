"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePlatformLang } from "@/components/platform-lang-provider";

type Submission = {
  id: string;
  blockId: string | null;
  data: Record<string, unknown>;
  createdAt: string;
};

export function SubmissionsPanel({ siteId }: { siteId: string }) {
  const { t, lang } = usePlatformLang();
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/submissions`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.submissions || []);
      }
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    await fetch(`/api/sites/${siteId}/submissions?submissionId=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          {t("repliesTitle")}
        </h3>
        <Button size="sm" variant="ghost" className="h-7 rounded-full text-[11px]" onClick={load}>
          {t("refresh")}
        </Button>
      </div>
      {loading ? <p className="text-xs text-[var(--muted)]">{t("loading")}</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-[var(--muted)]">{t("repliesEmpty")}</p>
      ) : null}
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border border-[var(--border)] p-3 text-xs"
          >
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
              <span dir="ltr">
                {new Date(r.createdAt).toLocaleString(lang === "ar" ? "ar" : "en")}
              </span>
              <button
                type="button"
                className="font-semibold text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                onClick={() => remove(r.id)}
              >
                {t("delete")}
              </button>
            </div>
            <dl className="space-y-1">
              {Object.entries(r.data || {}).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="shrink-0 font-semibold text-[var(--muted)]">{k}:</dt>
                  <dd className="break-words text-[var(--foreground)]">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
