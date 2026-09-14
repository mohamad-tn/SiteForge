"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePlatformLang } from "@/components/platform-lang-provider";
import type { SiteContent } from "@/lib/design";
import { Sparkles, X } from "lucide-react";
import Link from "next/link";

type Step = { step: string; message: string };
type ChatMsg = { role: "user" | "assistant" | "system"; text: string };

export function AiEditorPanel({
  open,
  onOpenChange,
  siteId,
  content,
  onApplyContent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  content: SiteContent;
  onApplyContent: (next: SiteContent) => void;
}) {
  const { t, lang, dir } = usePlatformLang();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [disabledReason, setDisabledReason] = useState<string | null>(null);
  const [quotaLabel, setQuotaLabel] = useState("");
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [open, messages, steps]);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setBusy(true);
    setDisabledReason(null);
    setSteps([]);
    setMessages((m) => [...m, { role: "user", text: message }]);
    setInput("");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          message,
          content,
          locale: content.defaultLocale,
        }),
      });

      if (res.status === 503) {
        const data = await res.json().catch(() => ({}));
        setDisabledReason(data.error === "AI_DISABLED" ? t("aiDisabledTenant") : t("aiError"));
        setBusy(false);
        return;
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((m) => [
          ...m,
          { role: "assistant", text: data.error === "QUOTA_EXCEEDED" ? t("aiQuotaExceeded") : data.error || t("aiError") },
        ]);
        setBusy(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const chunk of parts) {
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as {
              type: string;
              step?: string;
              message?: string;
              summary?: string;
              applied?: number;
              errors?: string[];
              content?: SiteContent;
              error?: string;
              quota?: { remaining: number; dailyLimit: number; usedToday: number };
            };
            if (evt.type === "step" && evt.step && evt.message) {
              setSteps((s) => [...s, { step: evt.step!, message: evt.message! }]);
            } else if (evt.type === "result" && evt.content) {
              onApplyContent(evt.content);
              const summary =
                evt.summary ||
                (lang === "ar"
                  ? `تم تطبيق ${evt.applied ?? 0} تعديلاً`
                  : `Applied ${evt.applied ?? 0} patch(es)`);
              setMessages((m) => [...m, { role: "assistant", text: summary }]);
              if (evt.quota) {
                setQuotaLabel(
                  lang === "ar"
                    ? `المتبقي اليوم: ${evt.quota.remaining}/${evt.quota.dailyLimit}`
                    : `Remaining today: ${evt.quota.remaining}/${evt.quota.dailyLimit}`
                );
              }
              if (evt.errors?.length) {
                setMessages((m) => [
                  ...m,
                  { role: "system", text: evt.errors!.slice(0, 3).join(" · ") },
                ]);
              }
            } else if (evt.type === "error") {
              setMessages((m) => [...m, { role: "assistant", text: evt.error || t("aiError") }]);
            }
          } catch {
            /* ignore bad SSE chunk */
          }
        }
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: t("aiError") }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex justify-end bg-[color-mix(in_oklab,var(--foreground)_35%,transparent)] backdrop-blur-[2px]" dir={dir} onClick={() => onOpenChange(false)}>
      <aside
        className="flex h-full w-full max-w-md flex-col border-s border-[var(--border)] bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("aiAssistant")}
      >
        <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{t("aiAssistant")}</div>
              <div className="truncate text-[10px] text-[var(--muted)]">{quotaLabel || t("aiAssistantHint")}</div>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => onOpenChange(false)} aria-label={t("close")}>
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div ref={scroller} className="sf-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {disabledReason ? (
            <div className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-50/70 p-4 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50">
              <p className="font-semibold">{t("aiDisabledTitle")}</p>
              <p className="mt-1 text-[13px] opacity-90">{disabledReason}</p>
              <p className="mt-3 text-[11px] text-[var(--muted)]">
                <Link href="/admin" className="font-semibold text-teal-800 underline-offset-2 hover:underline dark:text-teal-300">
                  {t("aiAdminLink")}
                </Link>
              </p>
            </div>
          ) : null}

          {messages.length === 0 && !disabledReason ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--muted)]">
              {t("aiEmptyHint")}
            </div>
          ) : null}

          {messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={`rounded-2xl px-3 py-2.5 text-sm leading-6 ${
                m.role === "user"
                  ? "ms-6 bg-teal-800 text-white"
                  : m.role === "system"
                    ? "border border-amber-500/30 bg-amber-50/50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-50"
                    : "me-6 bg-[var(--surface)] text-[var(--foreground)]"
              }`}
            >
              {m.text}
            </div>
          ))}

          {steps.length ? (
            <ol className="space-y-1.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
              {steps.map((s, i) => (
                <li key={`${s.step}-${i}`} className="flex items-start gap-2 text-[11px] text-[var(--muted)]">
                  <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" aria-hidden />
                  <span>
                    <span className="font-semibold text-[var(--foreground)]">{s.step}</span>
                    {" — "}
                    {s.message}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>

        <footer className="border-t border-[var(--border)] p-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("aiPlaceholder")}
            className="min-h-[88px] rounded-2xl text-sm"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] text-[var(--muted)]">{t("aiShortcutHint")}</span>
            <Button
              type="button"
              className="rounded-full bg-teal-800 hover:bg-teal-700"
              disabled={busy || !input.trim()}
              onClick={() => void send()}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {busy ? t("aiWorking") : t("aiSend")}
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
