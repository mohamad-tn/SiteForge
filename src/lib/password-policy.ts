import { z } from "zod";

/** Shared password strength rules — signup, change-password, and UI checklist. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 100;

export type PasswordRuleId =
  | "minLength"
  | "upper"
  | "lower"
  | "number"
  | "special"
  | "match";

export type PasswordRuleState = {
  id: PasswordRuleId;
  ok: boolean;
};

const SPECIAL_RE = /[^A-Za-z0-9]/;

export function evaluatePasswordRules(
  password: string,
  confirm?: string
): PasswordRuleState[] {
  const rules: PasswordRuleState[] = [
    { id: "minLength", ok: password.length >= PASSWORD_MIN },
    { id: "upper", ok: /[A-Z]/.test(password) },
    { id: "lower", ok: /[a-z]/.test(password) },
    { id: "number", ok: /\d/.test(password) },
    { id: "special", ok: SPECIAL_RE.test(password) },
  ];
  if (typeof confirm === "string") {
    rules.push({
      id: "match",
      ok: confirm.length > 0 && password === confirm,
    });
  }
  return rules;
}

export function passwordMeetsPolicy(password: string): boolean {
  return evaluatePasswordRules(password).every((r) => r.ok);
}

export function passwordPolicyMessage(password: string): string | null {
  if (passwordMeetsPolicy(password)) return null;
  return `Password must be ${PASSWORD_MIN}+ chars with upper, lower, number, and special character`;
}

/** Zod refinement for a single password field. */
export const strongPasswordZod = z
  .string()
  .min(PASSWORD_MIN)
  .max(PASSWORD_MAX)
  .refine((p) => /[A-Z]/.test(p), { message: "Must include an uppercase letter" })
  .refine((p) => /[a-z]/.test(p), { message: "Must include a lowercase letter" })
  .refine((p) => /\d/.test(p), { message: "Must include a number" })
  .refine((p) => SPECIAL_RE.test(p), { message: "Must include a special character" });

export const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(PASSWORD_MAX),
    newPassword: strongPasswordZod,
    confirmPassword: z.string().min(1).max(PASSWORD_MAX),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
