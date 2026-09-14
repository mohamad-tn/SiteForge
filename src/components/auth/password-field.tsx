"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Check, Circle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  evaluatePasswordRules,
  type PasswordRuleId,
} from "@/lib/password-policy";
import { cn } from "@/lib/utils";

const RULE_LABELS: Record<PasswordRuleId, { ar: string; en: string }> = {
  minLength: { ar: "٨ أحرف على الأقل", en: "At least 8 characters" },
  upper: { ar: "حرف كبير", en: "Uppercase letter" },
  lower: { ar: "حرف صغير", en: "Lowercase letter" },
  number: { ar: "رقم", en: "Number" },
  special: { ar: "رمز خاص (!@#…)", en: "Special character (!@#…)" },
  match: { ar: "تطابق التأكيد", en: "Passwords match" },
};

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required,
  disabled,
  placeholder,
  className,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="pe-10"
        />
        <button
          type="button"
          className="absolute end-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function PasswordChecklist({
  password,
  confirm,
  lang = "ar",
  className,
}: {
  password: string;
  confirm?: string;
  lang?: "ar" | "en";
  className?: string;
}) {
  const rules = useMemo(
    () => evaluatePasswordRules(password, confirm),
    [password, confirm]
  );
  if (!password && !(confirm && confirm.length)) return null;
  return (
    <ul className={cn("space-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2", className)}>
      {rules.map((r) => (
        <li
          key={r.id}
          className={cn(
            "flex items-center gap-2 text-[11px] font-medium",
            r.ok ? "text-teal-700 dark:text-teal-300" : "text-[var(--muted)]"
          )}
        >
          {r.ok ? (
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <Circle className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
          )}
          <span>{RULE_LABELS[r.id][lang]}</span>
        </li>
      ))}
    </ul>
  );
}

export function passwordRulesPass(password: string, confirm?: string): boolean {
  return evaluatePasswordRules(password, confirm).every((r) => r.ok);
}

/** Alias for shared naming (Input/TextField/PasswordField/SearchField). */
export const PasswordField = PasswordInput;
