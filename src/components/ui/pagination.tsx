"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type PaginationProps = {
  page: number;
  pageCount: number;
  total?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  label?: string;
  className?: string;
  dir?: "rtl" | "ltr";
};

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  label,
  className,
  dir,
}: PaginationProps) {
  const safeCount = Math.max(1, pageCount);
  const safePage = Math.min(Math.max(1, page), safeCount);
  const canPrev = safePage > 1;
  const canNext = safePage < safeCount;
  const PrevIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const NextIcon = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div
      className={cn(
        "sf-pagination flex flex-wrap items-center justify-between gap-2 border-t border-[color-mix(in_oklab,var(--border)_80%,transparent)] px-3 py-2.5",
        className
      )}
      data-sf-pagination=""
    >
      <div className="min-w-0 text-[11px] text-[var(--muted)]">
        {label
          ? label
          : total != null
            ? `${Math.min((safePage - 1) * (pageSize || 20) + 1, total)}–${Math.min(safePage * (pageSize || 20), total)} / ${total}`
            : `${safePage} / ${safeCount}`}
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-2.5"
          disabled={!canPrev}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
        >
          <PrevIcon className="h-3.5 w-3.5" aria-hidden />
        </Button>
        <span className="min-w-[3.5rem] text-center text-[11px] font-semibold tabular-nums">
          {safePage} / {safeCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-2.5"
          disabled={!canNext}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
        >
          <NextIcon className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
