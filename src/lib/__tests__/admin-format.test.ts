import { describe, expect, it } from "vitest";
import {
  ADMIN_PAGE_SIZE,
  eventTypeLabel,
  formatRelativeTime,
  pageCountFromTotal,
  paginateSlice,
  templateDisplayTitle,
} from "@/lib/admin-format";

describe("eventTypeLabel", () => {
  it("maps page_view to human AR/EN labels", () => {
    expect(eventTypeLabel("page_view", "ar")).toBe("زيارة صفحة");
    expect(eventTypeLabel("page_view", "en")).toBe("Page view");
  });

  it("prettifies unknown types", () => {
    expect(eventTypeLabel("custom_hit", "en")).toBe("Custom Hit");
  });
});

describe("formatRelativeTime", () => {
  it("returns relative minutes", () => {
    const now = Date.parse("2026-09-14T12:00:00.000Z");
    const then = new Date(now - 5 * 60 * 1000).toISOString();
    const en = formatRelativeTime(then, "en", now);
    expect(en).toMatch(/minute|5/i);
  });
});

describe("templateDisplayTitle", () => {
  it("picks nameAr for Arabic UI and name for English", () => {
    const tpl = { name: "Blank", nameAr: "فارغ", slug: "blank" };
    expect(templateDisplayTitle(tpl, "ar")).toBe("فارغ");
    expect(templateDisplayTitle(tpl, "en")).toBe("Blank");
  });

  it("does not duplicate slug as title", () => {
    const tpl = { name: "Blank", nameAr: "فارغ" };
    expect(templateDisplayTitle(tpl, "en")).not.toBe("blank");
  });
});

describe("paginateSlice", () => {
  it("pages at ADMIN_PAGE_SIZE", () => {
    const items = Array.from({ length: 45 }, (_, i) => i);
    const p1 = paginateSlice(items, 1);
    expect(p1.rows).toHaveLength(ADMIN_PAGE_SIZE);
    expect(p1.pageCount).toBe(3);
    expect(p1.total).toBe(45);
    const p3 = paginateSlice(items, 3);
    expect(p3.rows).toHaveLength(5);
  });
});

describe("pageCountFromTotal", () => {
  it("never returns 0", () => {
    expect(pageCountFromTotal(0)).toBe(1);
    expect(pageCountFromTotal(20)).toBe(1);
    expect(pageCountFromTotal(21)).toBe(2);
  });
});
