"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { KeyRound, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlatformLang } from "@/components/platform-lang-provider";
import { cn } from "@/lib/utils";

function initials(email?: string | null, name?: string | null) {
  const base = (name || email || "?").trim();
  if (!base) return "?";
  const parts = base.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function AccountMenu({
  email: emailProp,
  name: nameProp,
  className,
}: {
  email?: string | null;
  name?: string | null;
  className?: string;
}) {
  const { t, lang, dir } = usePlatformLang();
  const { data: session } = useSession();
  const email = emailProp ?? session?.user?.email ?? null;
  const name = nameProp ?? session?.user?.name ?? null;
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOkMsg("");
    if (newPassword.length < 6) {
      setError(t("changePasswordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("changePasswordMismatch"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 400 && String(data.error || "").toLowerCase().includes("current")) {
          setError(t("changePasswordWrongCurrent"));
        } else if (String(data.error || "").toLowerCase().includes("match")) {
          setError(t("changePasswordMismatch"));
        } else {
          setError(data.error || t("changePasswordFailed"));
        }
        return;
      }
      setOkMsg(t("changePasswordOk"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setPwOpen(false);
        setOkMsg("");
      }, 900);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={cn("relative", className)} ref={rootRef}>
        <button
          type="button"
          className="inline-flex max-w-[12rem] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] py-1 pe-2.5 ps-1 text-start transition hover:border-teal-700/35"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((o) => !o)}
          title={email || t("accountMenu")}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-800 text-[10px] font-bold text-white dark:bg-teal-500 dark:text-teal-950">
            {initials(email, name)}
          </span>
          <span className="min-w-0 hidden sm:block">
            <span className="block truncate text-[11px] font-semibold leading-tight text-[var(--foreground)]">
              {name || email || t("accountMenu")}
            </span>
            {name && email ? (
              <span className="block truncate text-[10px] leading-tight text-[var(--muted)]" dir="ltr">
                {email}
              </span>
            ) : null}
          </span>
        </button>
        {open ? (
          <div
            role="menu"
            className="absolute end-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-[var(--shadow-md)]"
            dir={dir}
          >
            <div className="border-b border-[var(--border)] px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <UserRound className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden />
                <span className="min-w-0 truncate">{name || t("accountMenu")}</span>
              </div>
              {email ? (
                <div className="mt-0.5 truncate text-[10px] text-[var(--muted)]" dir="ltr">
                  {email}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start text-xs font-semibold hover:bg-[var(--surface)]"
              onClick={() => {
                setOpen(false);
                setPwOpen(true);
                setError("");
                setOkMsg("");
              }}
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden />
              {t("changePassword")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              {t("signOut")}
            </button>
          </div>
        ) : null}
      </div>

      {pwOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sf-change-pw-title"
          onClick={() => {
            if (!saving) setPwOpen(false);
          }}
        >
          <form
            className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]"
            dir={dir}
            lang={lang}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void submitPassword(e)}
          >
            <h3 id="sf-change-pw-title" className="text-lg font-bold tracking-tight">
              {t("changePassword")}
            </h3>
            <p className="mt-1 text-xs text-[var(--muted)]">{t("changePasswordHint")}</p>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sf-pw-current">{t("currentPassword")}</Label>
                <Input
                  id="sf-pw-current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  dir="ltr"
                  autoComplete="current-password"
                  className="sf-field"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sf-pw-new">{t("newPassword")}</Label>
                <Input
                  id="sf-pw-new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  dir="ltr"
                  autoComplete="new-password"
                  className="sf-field"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sf-pw-confirm">{t("confirmPassword")}</Label>
                <Input
                  id="sf-pw-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  dir="ltr"
                  autoComplete="new-password"
                  className="sf-field"
                />
              </div>
              {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
              {okMsg ? <p className="text-sm text-teal-700 dark:text-teal-300">{okMsg}</p> : null}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={saving}
                onClick={() => setPwOpen(false)}
              >
                {t("close")}
              </Button>
              <Button type="submit" className="rounded-full" disabled={saving}>
                {saving ? t("saving") : t("changePasswordSave")}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
