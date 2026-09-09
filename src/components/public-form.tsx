"use client";

import { useState } from "react";
import { parseHttpAction } from "@/lib/http-action";
import { executeBlockHttpAction } from "@/components/public-http-action";

type FieldKey = "name" | "email" | "message" | string;

export function PublicForm({
  siteSlug,
  blockId,
  fields,
  fieldLabels,
  submitLabel,
  successMessage,
  primary,
  radius,
  muted,
  secondary,
  surface,
  bg,
  httpActionRaw,
}: {
  siteSlug: string;
  blockId: string;
  fields: FieldKey[];
  fieldLabels?: Record<string, string>;
  submitLabel: string;
  successMessage: string;
  primary: string;
  radius: number;
  muted: string;
  secondary: string;
  surface: string;
  bg: string;
  httpActionRaw?: unknown;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState(successMessage);

  const httpAction = parseHttpAction(httpActionRaw);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErr("");
    try {
      // Prefer external HTTP when enabled
      if (httpAction.enabled) {
        if (httpAction.runMode === "proxy") {
          const res = await fetch(`/api/s/${encodeURIComponent(siteSlug)}/http`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              blockId,
              data: values,
              website: honeypot,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.ok === false) {
            setErr(data.message || data.error || httpAction.errorMessage || "تعذّر الإرسال");
            setStatus("err");
            return;
          }
          setOkMsg(data.message || httpAction.successMessage || successMessage);
          setStatus("ok");
          setValues({});
          return;
        }

        // browser mode: optional local save + direct fetch
        if (httpAction.saveLocally) {
          await fetch(`/api/s/${encodeURIComponent(siteSlug)}/forms`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ blockId, data: values, website: honeypot }),
          }).catch(() => null);
        }
        const result = await executeBlockHttpAction({
          siteSlug,
          blockId,
          action: httpAction,
          formData: values,
        });
        if (!result.ok) {
          setErr(result.message || httpAction.errorMessage || "تعذّر الإرسال");
          setStatus("err");
          return;
        }
        setOkMsg(result.message || httpAction.successMessage || successMessage);
        setStatus("ok");
        setValues({});
        return;
      }

      // Default: SiteForge FormSubmission only
      const res = await fetch(`/api/s/${encodeURIComponent(siteSlug)}/forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockId,
          data: values,
          website: honeypot,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error || "تعذّر الإرسال");
        setStatus("err");
        return;
      }
      setOkMsg(successMessage);
      setStatus("ok");
      setValues({});
    } catch {
      setErr("تعذّر الإرسال");
      setStatus("err");
    }
  }

  if (status === "ok") {
    return (
      <div
        className="p-5 border text-sm leading-7"
        style={{ borderRadius: radius, borderColor: `${secondary}12`, background: surface, color: secondary }}
      >
        {okMsg}
      </div>
    );
  }

  const labels: Record<string, string> = {
    name: "الاسم",
    email: "البريد",
    message: "الرسالة",
    ...(fieldLabels || {}),
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 p-5 border" style={{ borderRadius: radius, borderColor: `${secondary}12`, background: surface }}>
      <input
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="absolute opacity-0 h-0 w-0 -z-10"
        style={{ position: "absolute", left: "-9999px" }}
        name="website"
      />
      {fields.map((key) => {
        const label = labels[key] || key;
        if (key === "message") {
          return (
            <div key={key} className="space-y-1">
              <label className="text-xs font-medium" style={{ color: muted }}>
                {label}
              </label>
              <textarea
                required
                rows={4}
                value={values[key] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                className="w-full border px-3 py-2 text-sm"
                style={{ borderRadius: radius / 2, borderColor: `${secondary}14`, background: bg, color: secondary }}
              />
            </div>
          );
        }
        return (
          <div key={key} className="space-y-1">
            <label className="text-xs font-medium" style={{ color: muted }}>
              {label}
            </label>
            <input
              required
              type={key === "email" ? "email" : "text"}
              value={values[key] || ""}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              className="w-full border px-3 py-2 text-sm h-10"
              style={{ borderRadius: radius / 2, borderColor: `${secondary}14`, background: bg, color: secondary }}
            />
          </div>
        );
      })}
      {err ? (
        <p className="text-xs text-red-600">{err}</p>
      ) : null}
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full h-10 text-white text-sm font-semibold disabled:opacity-60"
        style={{ background: primary, borderRadius: radius / 2 }}
      >
        {status === "loading" ? "جاري الإرسال…" : submitLabel}
      </button>
    </form>
  );
}
