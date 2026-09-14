import { describe, expect, it } from "vitest";
import { z } from "zod";

/** Mirrors /api/account/password body schema for unit coverage without DB. */
const schema = z
  .object({
    currentPassword: z.string().min(1).max(100),
    newPassword: z.string().min(6).max(100),
    confirmPassword: z.string().min(6).max(100),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

describe("change-password zod", () => {
  it("accepts matching passwords ≥6", () => {
    const r = schema.safeParse({
      currentPassword: "demo1234",
      newPassword: "newpass1",
      confirmPassword: "newpass1",
    });
    expect(r.success).toBe(true);
  });

  it("rejects mismatch and short passwords", () => {
    expect(
      schema.safeParse({
        currentPassword: "x",
        newPassword: "short",
        confirmPassword: "short",
      }).success
    ).toBe(false);
    expect(
      schema.safeParse({
        currentPassword: "demo1234",
        newPassword: "newpass1",
        confirmPassword: "other",
      }).success
    ).toBe(false);
  });
});
