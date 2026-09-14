import { describe, expect, it } from "vitest";
import {
  changePasswordBodySchema,
  evaluatePasswordRules,
  passwordMeetsPolicy,
  strongPasswordZod,
} from "@/lib/password-policy";

describe("password policy", () => {
  it("accepts strong passwords", () => {
    expect(passwordMeetsPolicy("Demo1234!")).toBe(true);
    expect(strongPasswordZod.safeParse("Demo1234!").success).toBe(true);
  });

  it("rejects weak passwords", () => {
    expect(passwordMeetsPolicy("demo1234")).toBe(false);
    expect(passwordMeetsPolicy("short1!")).toBe(false);
    expect(passwordMeetsPolicy("NoNumber!")).toBe(false);
    expect(strongPasswordZod.safeParse("demo1234").success).toBe(false);
  });

  it("live checklist tracks match", () => {
    const rules = evaluatePasswordRules("Demo1234!", "Demo1234!");
    expect(rules.every((r) => r.ok)).toBe(true);
    const bad = evaluatePasswordRules("Demo1234!", "other");
    expect(bad.find((r) => r.id === "match")?.ok).toBe(false);
  });

  it("change-password body schema", () => {
    expect(
      changePasswordBodySchema.safeParse({
        currentPassword: "Demo1234!",
        newPassword: "Newpass1!",
        confirmPassword: "Newpass1!",
      }).success
    ).toBe(true);
    expect(
      changePasswordBodySchema.safeParse({
        currentPassword: "x",
        newPassword: "weak",
        confirmPassword: "weak",
      }).success
    ).toBe(false);
  });
});
