"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
import { KeyRound, Paperclip, RefreshCw, Sparkles, Square, X } from "lucide-react";

type Step = { step: string; message: string; at?: string };
type AttMeta = {
  type?: string;
  name?: string;
  mime?: string;
  mediaUrl?: string | null;
  previewUrl?: string | null;
};
type ChatMsg = {
  id?: string;
  role: "user" | "assistant" | "system" | "error";
  text: string;
  status?: string;
  attachmentMeta?: AttMeta[] | null;
  steps?: Step[] | null;
};

type LocalAttachment = AiAttachment & { id: string; previewUrl?: string };

type FailedSendPayload = {
  text: string;
  /** Wire payload for /api/ai/chat (no local preview ids) */
  attachments: AiAttachment[];
};

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

function stepLabel(
  step: string,
  t: (k: string) => string
): string {
  const map: Record<string, string> = {
    thinking: t("aiStepThinking"),
    planning: t("aiStepPlanning"),
    calling_model: t("aiStepCalling"),
    parsing: t("aiStepParsing"),
    repairing: t("aiStepRepairing"),
    repaired: t("aiStepRepaired"),
    applying: t("aiStepApplying"),
    done: t("aiStepDone"),
  };
  return map[step] || step;
}

function AttChips({
  items,
  onOpen,
  onRemove,
}: {
  items: { id?: string; name?: string; previewUrl?: string | null; type?: string }[];
  onOpen?: (url: string) => void;
  onRemove?: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {items.map((a, i) => {
        const url = a.previewUrl || undefined;
        return (
          <button
            key={a.id || `${a.name}-${i}`}
            type="button"
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] py-0.5 pe-1 ps-1 text-[10px] font-medium"
            onClick={() => url && onOpen?.(url)}
          >
            {a.type === "image" && url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="h-6 w-6 rounded-full object-cover" />
            ) : null}
            <span className="truncate pe-1" dir="ltr">
              {a.name || "file"}
            </span>
            {onRemove && a.id ? (
              <span
                role="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-[var(--card)]"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(a.id!);
                }}
              >
                <X className="h-3 w-3" />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
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
  const [aiAvailable, setAiAvailable] = useState(true);
  const [quotaLabel, setQuotaLabel] = useState("");
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [attachError, setAttachError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [userKey, setUserKey] = useState("");
  const [userProvider, setUserProvider] = useState("openai");
  const [userModel, setUserModel] = useState("gpt-4o-mini");
  const [userEnabled, setUserEnabled] = useState(false);
  const [hasUserKey, setHasUserKey] = useState(false);
  const [usageLabel, setUsageLabel] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** True only when user pressed Cancel — tab hide / network abort must not use this. */
  const userCancelRef = useRef(false);
  const inFlightAssistantIdRef = useRef<string | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;
  const openRef = useRef(open);
  openRef.current = open;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const lastFailedPayloadRef = useRef<FailedSendPayload | null>(null);
  const [canResend, setCanResend] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/status");
      if (!res.ok) return;
      const data = await res.json();
      setAiAvailable(Boolean(data.available));
      setHasUserKey(Boolean(data.hasUserKey));
      if (!data.available) {
        setDisabledReason(
          data.reason === "no_key" ? t("aiNeedKey") : t("aiDisabledTenant")
        );
      } else {
        setDisabledReason(null);
      }
    } catch {
      /* ignore */
    }
  }, [t]);

  const loadUserAi = useCallback(async () => {
    try {
      const res = await fetch("/api/account/ai");
      if (!res.ok) return;
      const data = await res.json();
      setUserProvider(data.settings?.provider || "openai");
      setUserModel(data.settings?.model || "gpt-4o-mini");
      setUserEnabled(Boolean(data.settings?.enabled));
      setHasUserKey(Boolean(data.settings?.hasApiKey));
      setUsageLabel(
        lang === "ar"
          ? `اليوم ${data.usage?.today ?? 0} · الشهر ${data.usage?.month ?? 0}`
          : `Today ${data.usage?.today ?? 0} · Month ${data.usage?.month ?? 0}`
      );
    } catch {
      /* ignore */
    }
  }, [lang]);

  const mapHistoryMsg = useCallback(
    (m: {
      id: string;
      role: string;
      text: string;
      status?: string;
      attachmentMeta?: AttMeta[];
      steps?: Step[];
    }): ChatMsg => ({
      id: m.id,
      role:
        m.status === "error"
          ? "error"
          : m.role === "user"
            ? "user"
            : m.role === "assistant"
              ? "assistant"
              : "system",
      text:
        m.status === "cancelled"
          ? `${m.text || ""}${m.text ? " · " : ""}${t("aiCancelled")}`
          : m.text,
      status: m.status,
      attachmentMeta: m.attachmentMeta,
      steps: m.steps as Step[] | null,
    }),
    [t]
  );

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai/chat?siteId=${encodeURIComponent(siteId)}`);
      if (!res.ok) return;
      const data = await res.json();
      // Don't clobber in-flight local messages while a request is running
      if (busyRef.current) {
        setNextCursor(data.nextCursor || null);
        return;
      }
      setMessages((data.messages || []).map(mapHistoryMsg));
      setNextCursor(data.nextCursor || null);
      setHistoryLoaded(true);
    } catch {
      /* ignore */
    }
  }, [siteId, mapHistoryMsg]);

  // Load status/history when drawer opens — never abort in-flight work on close
  useEffect(() => {
    if (!open) return;
    void loadStatus();
    void loadUserAi();
    void loadHistory();
  }, [open, loadStatus, loadUserAi, loadHistory]);

  useEffect(() => {
    if (!open) return;
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [open, messages, steps]);


  function upsertMessage(msg: ChatMsg) {
    setMessages((m) => {
      if (msg.id) {
        const idx = m.findIndex((x) => x.id === msg.id);
        if (idx >= 0) {
          const next = [...m];
          next[idx] = { ...next[idx], ...msg };
          return next;
        }
      }
      return [...m, msg];
    });
  }

  async function cancelInFlight() {
    userCancelRef.current = true;
    const messageId = inFlightAssistantIdRef.current;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (messageId) {
      try {
        await fetch("/api/ai/chat/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId, messageId }),
        });
      } catch {
        /* best-effort */
      }
    }
  }

  /** After unexpected disconnect: poll chat + reload draft instead of aiError. */
  async function recoverAfterDisconnect(
    assistantId: string | null
  ): Promise<"ok" | "error" | "cancelled" | null> {
    setMessages((m) => [
      ...m,
      { role: "system", text: t("aiRecovering"), status: "partial" },
    ]);
    for (let i = 0; i < 20; i++) {
      if (userCancelRef.current) return null;
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await fetch(`/api/ai/chat?siteId=${encodeURIComponent(siteId)}`);
        if (!res.ok) continue;
        const data = await res.json();
        const msgs = (data.messages || []) as {
          id: string;
          role: string;
          text: string;
          status?: string;
          steps?: Step[];
        }[];
        const target =
          (assistantId && msgs.find((m) => m.id === assistantId)) ||
          [...msgs].reverse().find((m) => m.role === "assistant");
        if (!target || target.status === "partial") continue;
        // Reload draft from server (AI route persists when applied > 0)
        try {
          const siteRes = await fetch(`/api/sites/${encodeURIComponent(siteId)}`);
          if (siteRes.ok) {
            const siteData = await siteRes.json();
            const draft = siteData.site?.draftContent;
            if (draft) onApplyContent(draft as SiteContent);
          }
        } catch {
          /* ignore */
        }
        if (target.status === "cancelled") {
          setMessages((m) => [
            ...m,
            {
              id: target.id,
              role: "system",
              text: t("aiCancelled"),
              status: "cancelled",
              steps: target.steps,
            },
          ]);
          return "cancelled";
        }
        if (target.status === "error") {
          upsertMessage({
            id: target.id,
            role: "error",
            text: target.text || t("aiError"),
            status: "error",
            steps: target.steps,
          });
          return "error";
        }
        upsertMessage({
          id: target.id,
          role: "assistant",
          text: target.text || t("aiNoEdits"),
          status: "ok",
          steps: target.steps,
        });
        return "ok";
      } catch {
        /* retry */
      }
    }
    return null;
  }

  async function loadOlder() {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(
        `/api/ai/chat?siteId=${encodeURIComponent(siteId)}&cursor=${encodeURIComponent(nextCursor)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const older = (data.messages || []).map(
        (m: {
          id: string;
          role: string;
          text: string;
          status?: string;
          attachmentMeta?: AttMeta[];
          steps?: Step[];
        }) => mapHistoryMsg(m)
      );
      setMessages((prev) => [...older, ...prev]);
      setNextCursor(data.nextCursor || null);
    } finally {
      setLoadingOlder(false);
    }
  }

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
            /* dataUrl only */
          }
          const dataUrl = await readFileAsDataUrl(file);
          next.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: "image",
            name: file.name.slice(0, 200),
            mime,
            mediaUrl,
            dataUrl,
            previewUrl: mediaUrl || dataUrl,
          });
        } else if (
          AI_TEXT_MIMES.has(mime) ||
          mime.startsWith("text/") ||
          /\.(txt|md|json|css|html|js|ts)$/i.test(file.name)
        ) {
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

  async function savePersonalKey() {
    setSavingKey(true);
    try {
      const body: Record<string, unknown> = {
        provider: userProvider,
        model: userModel,
        enabled: true,
      };
      if (userKey.trim()) body.apiKey = userKey.trim();
      const res = await fetch("/api/account/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setUserKey("");
        await loadUserAi();
        await loadStatus();
        setKeyOpen(false);
      }
    } finally {
      setSavingKey(false);
    }
  }

  async function clearPersonalKey() {
    setSavingKey(true);
    try {
      await fetch("/api/account/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearKey: true }),
      });
      await loadUserAi();
      await loadStatus();
    } finally {
      setSavingKey(false);
    }
  }

  function markSendFailed() {
    setCanResend(Boolean(lastFailedPayloadRef.current));
  }

  function markSendSucceeded() {
    lastFailedPayloadRef.current = null;
    setCanResend(false);
  }

  /** Drop trailing error / partial / cancelled assistant bubbles after the last user turn. */
  function clearTrailingFailureBubbles() {
    setMessages((m) => {
      let lastUser = -1;
      for (let i = m.length - 1; i >= 0; i--) {
        if (m[i].role === "user") {
          lastUser = i;
          break;
        }
      }
      if (lastUser < 0) return m;
      const kept = m.slice(0, lastUser + 1);
      const rest = m.slice(lastUser + 1).filter(
        (x) =>
          !(
            x.role === "error" ||
            x.status === "error" ||
            x.status === "partial" ||
            x.status === "cancelled"
          )
      );
      return [...kept, ...rest];
    });
  }

  async function send(opts?: { resend?: boolean }) {
    const isResend = Boolean(opts?.resend);
    if (busy) return;

    let message = "";
    let payloadAttachments: AiAttachment[] = [];
    let localAtts: AttMeta[] = [];

    if (isResend) {
      const failed = lastFailedPayloadRef.current;
      if (!failed) return;
      message = failed.text.trim();
      payloadAttachments = failed.attachments;
      if (!message && !payloadAttachments.length) return;
      clearTrailingFailureBubbles();
    } else {
      message = input.trim();
      if ((!message && !attachments.length) || busy) return;
      localAtts = attachments.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        previewUrl: a.previewUrl || a.mediaUrl || a.dataUrl || null,
      }));
      payloadAttachments = attachments.map((a) => {
        const { id, previewUrl, ...rest } = a;
        void id;
        void previewUrl;
        return rest;
      });
    }

    if (!aiAvailable) {
      setKeyOpen(true);
      return;
    }

    const wireMessage =
      message ||
      (lang === "ar"
        ? "راجع المرفقات وطبق التعديلات المناسبة."
        : "Review attachments and apply suitable edits.");

    lastFailedPayloadRef.current = {
      text: message,
      attachments: payloadAttachments,
    };
    setCanResend(false);

    setBusy(true);
    setDisabledReason(null);
    setSteps([]);

    if (!isResend) {
      setMessages((m) => [
        ...m,
        {
          role: "user",
          text: message || (lang === "ar" ? "مرفقات" : "Attachments"),
          attachmentMeta: localAtts,
        },
      ]);
      setInput("");
      setAttachments([]);
    }

    const ac = new AbortController();
    abortRef.current = ac;
    userCancelRef.current = false;
    inFlightAssistantIdRef.current = null;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          message: wireMessage,
          content: contentRef.current,
          locale: contentRef.current.defaultLocale,
          platformLang: lang === "ar" ? "ar" : "en",
          attachments: payloadAttachments,
        }),
        signal: ac.signal,
      });

      if (res.status === 503) {
        const data = await res.json().catch(() => ({}));
        setDisabledReason(data.error === "AI_DISABLED" ? t("aiNeedKey") : t("aiError"));
        setAiAvailable(false);
        markSendFailed();
        setBusy(false);
        return;
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((m) => [
          ...m,
          {
            role: "error",
            text:
              data.error === "QUOTA_EXCEEDED" ? t("aiQuotaExceeded") : data.error || t("aiError"),
            status: "error",
          },
        ]);
        markSendFailed();
        setBusy(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let liveSteps: Step[] = [];
      let sawTerminal = false;
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
              at?: string;
              summary?: string;
              applied?: number;
              errors?: string[];
              content?: SiteContent;
              error?: string;
              hint?: string;
              rawSnippet?: string;
              messageId?: string;
              steps?: Step[];
              quota?: { remaining: number; dailyLimit: number; usedToday: number };
            };
            if (evt.type === "started" && evt.messageId) {
              inFlightAssistantIdRef.current = evt.messageId;
              upsertMessage({
                id: evt.messageId,
                role: "assistant",
                text: t("aiWorking"),
                status: "partial",
              });
            } else if (evt.type === "step" && evt.step && evt.message) {
              const rec = { step: evt.step, message: evt.message, at: evt.at };
              liveSteps = [...liveSteps, rec];
              setSteps(liveSteps);
            } else if (evt.type === "result" && evt.content) {
              onApplyContent(evt.content);
              const appliedN = evt.applied ?? 0;
              const summary =
                appliedN === 0
                  ? evt.summary || t("aiNoEdits")
                  : evt.summary ||
                    (lang === "ar"
                      ? `تم تطبيق ${appliedN} تعديلاً`
                      : `Applied ${appliedN} patch(es)`);
              const finalSteps = evt.steps?.length ? evt.steps : liveSteps;
              upsertMessage({
                id: evt.messageId,
                role: appliedN === 0 ? "system" : "assistant",
                text: summary,
                status: appliedN === 0 ? "error" : "ok",
                steps: finalSteps,
              });
              if (appliedN === 0) markSendFailed();
              else markSendSucceeded();
              sawTerminal = true;
              setBusy(false);
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
            } else if (evt.type === "cancelled") {
              upsertMessage({
                id: evt.messageId,
                role: "system",
                text: t("aiCancelled"),
                status: "cancelled",
                steps: evt.steps || liveSteps,
              });
              sawTerminal = true;
              setBusy(false);
            } else if (evt.type === "error") {
              // Prefer clean server error text immediately; keep steps on the bubble.
              const detail = (evt.error || "").trim() || t("aiError");
              upsertMessage({
                id: evt.messageId || inFlightAssistantIdRef.current || undefined,
                role: "error",
                text: detail.slice(0, 800),
                status: "error",
                steps: evt.steps || liveSteps,
              });
              markSendFailed();
              sawTerminal = true;
              setBusy(false);
              // Keep timeline steps visible with the error message (do not wipe yet)
              if ((evt.steps || liveSteps)?.length) {
                setSteps(evt.steps?.length ? evt.steps : liveSteps);
              }
            }
          } catch {
            /* ignore bad SSE */
          }
        }
      }
      if (!sawTerminal && !userCancelRef.current) {
        // Stream ended without result/error — treat as soft failure for resend.
        markSendFailed();
      }
    } catch (e) {
      const isAbort = (e as Error)?.name === "AbortError";
      if (isAbort && userCancelRef.current) {
        upsertMessage({
          id: inFlightAssistantIdRef.current || undefined,
          role: "system",
          text: t("aiCancelled"),
          status: "cancelled",
        });
      } else if (isAbort || e instanceof TypeError) {
        // Tab background / network abort — durable server run; poll for completion.
        const recovered = await recoverAfterDisconnect(inFlightAssistantIdRef.current);
        if (!recovered && !userCancelRef.current) {
          upsertMessage({
            id: inFlightAssistantIdRef.current || undefined,
            role: "error",
            text: t("aiError"),
            status: "error",
          });
          markSendFailed();
        } else if (recovered === "ok") {
          markSendSucceeded();
        } else if (recovered === "error") {
          markSendFailed();
        }
      } else {
        const detail =
          e instanceof Error && e.message && e.message.length < 400
            ? e.message
            : t("aiError");
        // Try history recovery for a richer server-persisted error text
        const aid = inFlightAssistantIdRef.current;
        let shown = detail;
        if (aid) {
          try {
            const res = await fetch(`/api/ai/chat?siteId=${encodeURIComponent(siteId)}`);
            if (res.ok) {
              const data = await res.json();
              const target = (data.messages || []).find(
                (m: { id: string }) => m.id === aid
              ) as { text?: string; status?: string; steps?: Step[] } | undefined;
              if (target?.status === "error" && target.text) {
                shown = target.text;
                upsertMessage({
                  id: aid,
                  role: "error",
                  text: shown,
                  status: "error",
                  steps: target.steps,
                });
                shown = "";
              }
            }
          } catch {
            /* ignore */
          }
        }
        if (shown) {
          upsertMessage({
            id: aid || undefined,
            role: "error",
            text: shown,
            status: "error",
          });
        }
        markSendFailed();
      }
    } finally {
      abortRef.current = null;
      inFlightAssistantIdRef.current = null;
      setBusy(false);
      // Keep last steps briefly; errors keep steps on the message bubble
      setTimeout(() => {
        if (!busyRef.current) setSteps([]);
      }, 1200);
    }
  }

  // Keep panel mounted so fetch + state survive drawer close (CSS hide only)
  return (
    <div
      className={
        open
          ? "fixed inset-0 z-[85] flex justify-end bg-[color-mix(in_oklab,var(--foreground)_35%,transparent)] backdrop-blur-[2px]"
          : "pointer-events-none fixed inset-0 z-[85] hidden"
      }
      dir={dir}
      onClick={() => {
        if (open) onOpenChange(false);
      }}
      aria-hidden={!open}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col border-s border-[var(--border)] bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal={open}
        aria-label={t("aiAssistant")}
      >
        <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{t("aiAssistant")}</div>
              <div className="truncate text-[10px] text-[var(--muted)]">
                {busy ? t("aiWorking") : quotaLabel || t("aiAssistantHint")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {busy ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-rose-700 dark:text-rose-300"
                onClick={() => cancelInFlight()}
                aria-label={t("aiCancel")}
              >
                <Square className="h-3 w-3 fill-current" />
                {t("aiCancel")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
              aria-label={t("close")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div
          ref={scroller}
          className="sf-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4"
          onScroll={(e) => {
            if (e.currentTarget.scrollTop < 40 && nextCursor) void loadOlder();
          }}
        >
          {nextCursor ? (
            <button
              type="button"
              className="mx-auto block text-[11px] font-semibold text-teal-800 dark:text-teal-300"
              disabled={loadingOlder}
              onClick={() => void loadOlder()}
            >
              {loadingOlder ? "…" : t("aiLoadOlder")}
            </button>
          ) : null}

          {disabledReason ? (
            <div className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-50/70 p-4 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50">
              <p className="font-semibold">{t("aiDisabledTitle")}</p>
              <p className="mt-1 text-[13px] opacity-90">{disabledReason}</p>
              <Button
                type="button"
                size="sm"
                className="mt-3 rounded-full"
                onClick={() => setKeyOpen(true)}
              >
                <KeyRound className="h-3.5 w-3.5" />
                {t("aiPersonalKey")}
              </Button>
            </div>
          ) : null}

          {messages.length === 0 && !disabledReason && historyLoaded ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--muted)]">
              {t("aiEmptyHint")}
            </div>
          ) : null}

          {messages.map((m, i) => (
            <div
              key={m.id || `${m.role}-${i}`}
              className={`rounded-2xl px-3 py-2.5 text-sm leading-6 ${
                m.role === "user"
                  ? "ms-6 bg-teal-800 text-white"
                  : m.role === "error"
                    ? "border border-rose-500/35 bg-rose-50/80 text-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
                    : m.role === "system"
                      ? "border border-amber-500/30 bg-amber-50/50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-50"
                      : "me-6 bg-[var(--surface)] text-[var(--foreground)]"
              }`}
            >
              {m.text}
              {m.attachmentMeta?.length ? (
                <AttChips
                  items={(m.attachmentMeta || []).map((a, idx) => ({
                    id: `${i}-${idx}`,
                    name: a.name || undefined,
                    type: a.type || undefined,
                    previewUrl: a.previewUrl || a.mediaUrl || null,
                  }))}
                  onOpen={(url) => setLightbox(url)}
                />
              ) : null}
              {m.steps?.length && (m.role === "assistant" || m.role === "error") ? (
                <ol className="mt-2 space-y-1 border-t border-black/10 pt-2 dark:border-white/10">
                  {m.steps.map((s, si) => (
                    <li key={`${s.step}-${si}`} className="text-[10px] opacity-80">
                      <span className="font-semibold">{stepLabel(s.step, t)}</span>
                      {" — "}
                      {s.message}
                    </li>
                  ))}
                </ol>
              ) : null}
              {canResend &&
              !busy &&
              (m.role === "error" || m.status === "error") &&
              i === messages.length - 1 ? (
                <div className="mt-2 flex justify-start">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full border-rose-500/40 bg-white/70 text-rose-800 hover:bg-white dark:bg-rose-950/40 dark:text-rose-100"
                    disabled={busy || !aiAvailable}
                    onClick={() => void send({ resend: true })}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    {t("aiResend")}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}

          {busy && steps.length ? (
            <ol
              className="space-y-1.5 rounded-2xl border border-teal-500/30 bg-teal-50/50 p-3 dark:bg-teal-950/20"
              aria-live="polite"
              aria-label={t("aiTimeline")}
            >
              <li className="text-[10px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                {t("aiTimeline")}
              </li>
              {steps.map((s, i) => (
                <li
                  key={`${s.step}-${i}`}
                  className="flex items-start gap-2 text-[11px] text-[var(--muted)]"
                >
                  <span
                    className={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      i === steps.length - 1 ? "animate-pulse bg-teal-600" : "bg-teal-600/50"
                    }`}
                    aria-hidden
                  />
                  <span>
                    <span className="font-semibold text-[var(--foreground)]">
                      {stepLabel(s.step, t)}
                    </span>
                    {" — "}
                    {s.message}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>

        <footer className="border-t border-[var(--border)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-800 dark:text-teal-300"
              onClick={() => setKeyOpen((v) => !v)}
            >
              <KeyRound className="h-3 w-3" />
              {t("aiPersonalKey")}
            </button>
            <span className="truncate text-[10px] text-[var(--muted)]">{usageLabel}</span>
          </div>
          {keyOpen ? (
            <div className="mb-3 space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="text-[11px] leading-5 text-[var(--muted)]">{t("aiPersonalKeyHint")}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">{t("aiProvider")}</Label>
                  <Select
                    value={userProvider}
                    onValueChange={(v) => setUserProvider(v)}
                    options={[
                      { value: "openai", label: "OpenAI" },
                      { value: "anthropic", label: "Anthropic" },
                      { value: "google", label: "Google" },
                      { value: "xai", label: "xAI" },
                    ]}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">{t("aiModel")}</Label>
                  <Input
                    value={userModel}
                    onChange={(e) => setUserModel(e.target.value)}
                    className="h-8 text-xs"
                    inputMode="text"
                    autoComplete="off"
                    valueDir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">{t("aiApiKey")}</Label>
                <Input
                  type="password"
                  value={userKey}
                  onChange={(e) => setUserKey(e.target.value)}
                  placeholder={hasUserKey ? t("aiApiKeySet") : "sk-…"}
                  className="h-8 text-xs"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  disabled={savingKey || (!userKey.trim() && !hasUserKey)}
                  onClick={() => void savePersonalKey()}
                >
                  {t("aiSaveSettings")}
                </Button>
                {hasUserKey ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={savingKey}
                    onClick={() => void clearPersonalKey()}
                  >
                    {t("aiApiKeyClear")}
                  </Button>
                ) : null}
              </div>
              {userEnabled && hasUserKey ? (
                <p className="text-[10px] text-teal-700 dark:text-teal-300">{t("aiUsingPersonalKey")}</p>
              ) : null}
            </div>
          ) : null}

          {attachments.length ? (
            <AttChips
              items={attachments.map((a) => ({
                id: a.id,
                name: a.name,
                type: a.type,
                previewUrl: a.previewUrl || null,
              }))}
              onOpen={(url) => setLightbox(url)}
              onRemove={(id) => setAttachments((list) => list.filter((x) => x.id !== id))}
            />
          ) : null}
          {attachError ? (
            <p className="mb-1.5 text-[11px] text-rose-600 dark:text-rose-400">{attachError}</p>
          ) : null}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("aiPlaceholder")}
            className="min-h-[88px] rounded-2xl text-sm"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              // IME composition: ignore Enter while composing
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.shiftKey) return; // newline
              e.preventDefault();
              if ((!input.trim() && !attachments.length) || busy) return;
              void send();
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
            {busy ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-rose-500/40 text-rose-700 dark:text-rose-300"
                onClick={() => cancelInFlight()}
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                {t("aiCancel")}
              </Button>
            ) : (
              <Button
                type="button"
                className="rounded-full bg-teal-800 hover:bg-teal-700"
                disabled={(!input.trim() && !attachments.length) || !aiAvailable}
                onClick={() => void send()}
                title={!aiAvailable ? t("aiNeedKey") : undefined}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {t("aiSend")}
              </Button>
            )}
          </div>
        </footer>
      </aside>

      {lightbox
        ? createPortal(
            <div
              className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-6"
              onClick={() => setLightbox(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox}
                alt=""
                className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
