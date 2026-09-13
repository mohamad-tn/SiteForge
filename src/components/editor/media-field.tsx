"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Link2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { usePlatformLang } from "@/components/platform-lang-provider";

/** Client-side guard — server also enforces 8MB. */
export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;

export function MediaField({
  label,
  value,
  onChange,
  accept = "image/*,video/mp4,video/webm,video/quicktime",
  kind = "auto",
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  kind?: "image" | "video" | "auto";
}) {
  const { t } = usePlatformLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"upload" | "url">(value && !value.startsWith("/uploads/") ? "url" : "upload");

  function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (file.size > MEDIA_MAX_BYTES) {
      setError(t("uploadTooLarge"));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    setProgress(0);
    const fd = new FormData();
    fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
      else setProgress((p) => Math.min(90, p + 10));
    };
    xhr.onload = () => {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
      try {
        const data = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300 && data.url) {
          setProgress(100);
          onChange(data.url);
        } else {
          setError(data.error || t("uploadTooLarge"));
        }
      } catch {
        setError(t("uploadTooLarge"));
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      setError(t("uploadTooLarge"));
      if (inputRef.current) inputRef.current.value = "";
    };
    xhr.send(fd);
  }

  const isVideo =
    kind === "video" ||
    /\.(mp4|webm|mov)(\?|$)/i.test(value) ||
    value.includes("video");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11px] text-[var(--muted)]">{label}</Label>
        <div className="flex rounded-full bg-[var(--surface)] p-0.5 text-[10px] font-bold" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "upload"}
            title={t("uploadMode")}
            onClick={() => setMode("upload")}
            className={`rounded-full px-2 py-0.5 ${mode === "upload" ? "bg-[var(--card)] shadow-sm" : "text-[var(--muted)]"}`}
          >
            {t("uploadMode")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "url"}
            title={t("uploadUrlMode")}
            onClick={() => setMode("url")}
            className={`rounded-full px-2 py-0.5 ${mode === "url" ? "bg-[var(--card)] shadow-sm" : "text-[var(--muted)]"}`}
          >
            {t("uploadUrlMode")}
          </button>
        </div>
      </div>

      {mode === "upload" ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-3">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-full"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? `${t("uploadProgress")} ${progress}%` : t("uploadChoose")}
          </Button>
          {uploading ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full bg-teal-700 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}
          <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">{t("uploadHint")}</p>
        </div>
      ) : (
        <div className="relative">
          <Link2 className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 rounded-2xl ps-9 text-sm font-mono"
            dir="ltr"
            placeholder="https://… أو /uploads/…"
          />
        </div>
      )}

      {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}

      {value ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {isVideo ? (
            <video src={value} className="max-h-36 w-full object-cover" muted playsInline controls />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="max-h-36 w-full object-cover" />
          )}
          <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-2.5 py-1.5">
            <span className="truncate font-mono text-[10px] text-[var(--muted)]" dir="ltr">
              {value}
            </span>
            <button type="button" className="shrink-0 text-[10px] font-bold text-rose-600" onClick={() => onChange("")}>
              {t("uploadClear")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl bg-[var(--surface)] px-3 py-2 text-[11px] text-[var(--muted)]">
          <ImagePlus className="h-3.5 w-3.5" />
          {t("uploadEmpty")}
        </div>
      )}
    </div>
  );
}
