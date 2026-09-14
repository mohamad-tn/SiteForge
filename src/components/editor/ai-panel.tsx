"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePlatformLang } from "@/components/platform-lang-provider";
import type { SiteContent } from "@/lib/design";
import {
  AI_IMAGE_MAX_BYTES,
  AI_IMAGE_MIMES,
  AI_MAX_ATTACHMENTS,
  AI_TEXT_MAX_BYTES,
  AI_TEXT_MIMES,
  type AiAttachment,
} from "@/lib/ai/attachments";
import { Paperclip, Sparkles, X } from "lucide-react";
import Link from "next/link";

type Step = { step: string; message: string };
type ChatMsg = { role: "user" | "assistant" | "system"; text: string };

type LocalAttachment = AiAttachment & { id: string };

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsText(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

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
  const [attachBusy, setAttachBusy] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [disabledReason, setDisabledReason] = useState<string | null>(null);
  const [quotaLabel, setQuotaLabel] = useState("");
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [howOpen, setHowOpen] = useState(false);
  const [attachError, setAttachError] = useState("");
  const scroller = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [open, messages, steps]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setAttachError("");
    const room = AI_MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      setAttachError(t("aiAttachTooMany"));
      return;
    }
    setAttachBusy(true);
    try {
      const next: LocalAttachment[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        const mime = file.type || "application/octet-stream";
        if (AI_IMAGE_MIMES.has(mime)) {
          if (file.size > AI_IMAGE_MAX_BYTES) {
            setAttachError(t("aiAttachTooLarge"));
            continue;
          }
          let mediaUrl: string | undefined;
          try {
            const fd = new FormData();
            fd.set("file", file);
            fd.set("siteId", siteId);
            const up = await fetch("/api/uploads", { method: "POST", body: fd });
            if (up.ok) {
              const data = await up.json();
              mediaUrl = data.url as string;
            }
          } catch {
            /* fall through to dataUrl-only */
          }
          const dataUrl = await readFileAsDataUrl(file);
          next.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: "image",
            name: file.name.slice(0, 200),
            mime,
            mediaUrl,
            dataUrl,
          });
        } else if (AI_TEXT_MIMES.has(mime) || mime.startsWith("text/") || /\.(txt|md|json|css|html|js|ts)$/i.test(file.name)) {
          if (file.size > AI_TEXT_MAX_BYTES) {
            setAttachError(t("aiAttachTooLarge"));
            continue;
          }
          const text = await readFileAsText(file);
          next.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: "text",
            name: file.name.slice(0, 200),
            mime: mime.startsWith("text/") || AI_TEXT_MIMES.has(mime) ? mime : "text/plain",
            text,
          });
        } else {
          setAttachError(t("aiAttachBadType"));
        }
      }
      if (next.length) setAttachments((a) => [...a, ...next].slice(0, AI_MAX_ATTACHMENTS));
    } finally {
      setAttachBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function send() {
    const message = input.trim();
    if ((!message && !attachments.length) || busy) return;
    setBusy(true);
    setDisabledReason(null);
    setSteps([]);
    const label =
      attachments.length > 0
        ? `${message || "…"}${lang === "ar" ? " · مرفقات: " : " · attachments: "}${attachments.map((a) => a.name).join(", ")}`
        : message;
    setMessages((m) => [...m, { role: "user", text: label }]);
    setInput("");
    const payloadAttachments = attachments.map((a) => {
      const { id, ...rest } = a;
      void id;
      return rest;
    });
    setAttachments([]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          message: message || (lang === "ar" ? "راجع المرفقات وطبق التعديلات المناسبة." : "Review attachments and apply suitable edits."),
          content,
          locale: content.defaultLocale,
          attachments: payloadAttachments,
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
          <details
            open={howOpen}
            onToggle={(e) => setHowOpen((e.target as HTMLDetailsElement).open)}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          >
            <summary className="cursor-pointer text-xs font-semibold text-[var(--foreground)]">{t("aiHowItWorks")}</summary>
            <ol className="mt-2 space-y-1.5 pb-1 text-[11px] leading-5 text-[var(--muted)]">
              <li>{t("aiHowStep1")}</li>
              <li>{t("aiHowStep2")}</li>
              <li>{t("aiHowStep3")}</li>
              <li>{t("aiHowStep4")}</li>
              <li>{t("aiHowStep5")}</li>
            </ol>
          </details>

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
          {attachments.length ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] py-0.5 pe-1 ps-2 text-[10px] font-medium"
                >
                  <span className="truncate" dir="ltr">
                    {a.name}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-[var(--card)]"
                    aria-label={t("aiAttachRemove")}
                    onClick={() => setAttachments((list) => list.filter((x) => x.id !== a.id))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          {attachError ? <p className="mb-1.5 text-[11px] text-rose-600 dark:text-rose-400">{attachError}</p> : null}
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
            <div className="flex min-w-0 items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp,image/gif,.txt,.md,.json,.css,.html,text/plain,text/markdown,application/json,text/css,text/html"
                multiple
                onChange={(e) => void addFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full"
                disabled={busy || attachBusy || attachments.length >= AI_MAX_ATTACHMENTS}
                onClick={() => fileRef.current?.click()}
                aria-label={t("aiAttach")}
                title={t("aiAttachHint")}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <span className="truncate text-[10px] text-[var(--muted)]">
                {attachBusy ? t("aiAttachBusy") : t("aiShortcutHint")}
              </span>
            </div>
            <Button
              type="button"
              className="rounded-full bg-teal-800 hover:bg-teal-700"
              disabled={busy || (!input.trim() && !attachments.length)}
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
