import type { PlatformLang } from "@/lib/platform-i18n";

/** Known analytics / platform event types → human labels. */
const EVENT_LABELS: Record<string, { ar: string; en: string }> = {
  page_view: { ar: "زيارة صفحة", en: "Page view" },
  form_submit: { ar: "إرسال نموذج", en: "Form submit" },
  publish: { ar: "نشر", en: "Publish" },
  unpublish: { ar: "إلغاء النشر", en: "Unpublish" },
  create: { ar: "إنشاء", en: "Create" },
  update: { ar: "تحديث", en: "Update" },
  delete: { ar: "حذف", en: "Delete" },
  login: { ar: "تسجيل دخول", en: "Login" },
  signup: { ar: "إنشاء حساب", en: "Sign up" },
};

export function eventTypeLabel(type: string, lang: PlatformLang): string {
  const key = (type || "").trim().toLowerCase();
  const hit = EVENT_LABELS[key];
  if (hit) return hit[lang];
  // Fallback: prettify snake_case
  const pretty = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return pretty || type || "—";
}

export function knownEventTypes(): string[] {
  return Object.keys(EVENT_LABELS);
}

/** Relative time for admin activity feeds (Asia/Damascus-friendly labels via locale). */
export function formatRelativeTime(
  iso: string | Date,
  lang: PlatformLang,
  nowMs: number = Date.now()
): string {
  const then = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  if (!Number.isFinite(then)) return "—";
  const diffSec = Math.round((then - nowMs) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang === "ar" ? "ar" : "en", { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, "month");
  return rtf.format(Math.round(diffMonth / 12), "year");
}

/** Template display title: AR → nameAr, EN → name (English field). */
export function templateDisplayTitle(
  tpl: { name?: string | null; nameAr?: string | null; nameEn?: string | null },
  lang: PlatformLang
): string {
  if (lang === "ar") {
    return (tpl.nameAr || tpl.nameEn || tpl.name || "").trim() || "—";
  }
  return (tpl.nameEn || tpl.name || tpl.nameAr || "").trim() || "—";
}

export const ADMIN_PAGE_SIZE = 20;

export function paginateSlice<T>(items: T[], page: number, pageSize: number = ADMIN_PAGE_SIZE) {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / safeSize));
  const start = (Math.min(safePage, pageCount) - 1) * safeSize;
  return {
    rows: items.slice(start, start + safeSize),
    total,
    page: Math.min(safePage, pageCount),
    pageSize: safeSize,
    pageCount,
  };
}

export function pageCountFromTotal(total: number, pageSize: number = ADMIN_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}
