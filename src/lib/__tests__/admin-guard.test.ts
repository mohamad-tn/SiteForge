import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("admin gate hardening", () => {
  it("has server layout requireAdmin/DB role check", () => {
    const layout = readFileSync(join(process.cwd(), "src/app/admin/layout.tsx"), "utf8");
    expect(layout).toContain("prisma.user.findUnique");
    expect(layout).toContain("غير مصرح");
    expect(layout).toMatch(/role !== "ADMIN"/);
  });

  it("requireAdminSession refreshes role from DB", () => {
    const api = readFileSync(join(process.cwd(), "src/lib/api.ts"), "utf8");
    expect(api).toContain("requireAdminSession");
    expect(api).toContain('db.role !== "ADMIN"');
  });

  it("every /api/admin route uses requireAdminSession", () => {
    const files = [
      "src/app/api/admin/overview/route.ts",
      "src/app/api/admin/users/route.ts",
      "src/app/api/admin/sites/route.ts",
      "src/app/api/admin/domains/route.ts",
      "src/app/api/admin/ai/route.ts",
      "src/app/api/admin/ai/models/route.ts",
    ];
    for (const f of files) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src).toContain("requireAdminSession");
    }
  });
});
