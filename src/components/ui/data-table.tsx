"use client";

import type { ReactNode } from "react";
import { SoftCard, Toolbar } from "@/components/ui/surface";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  toolbar?: ReactNode;
  empty?: ReactNode;
  page?: number;
  pageCount?: number;
  total?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  paginationLabel?: string;
  dir?: "rtl" | "ltr";
  className?: string;
  tableClassName?: string;
  loading?: boolean;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  toolbar,
  empty,
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  paginationLabel,
  dir,
  className,
  tableClassName,
  loading,
}: DataTableProps<T>) {
  const showPager = typeof page === "number" && typeof pageCount === "number" && onPageChange;

  return (
    <SoftCard className={cn("sf-data-table space-y-0 overflow-hidden p-0", className)}>
      {toolbar ? <Toolbar className="m-3">{toolbar}</Toolbar> : null}
      <div className="overflow-x-auto px-2 pb-1 sm:px-3">
        <table className={cn("sf-dense-table sf-data-table-grid min-w-full", tableClassName)}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.id} className={col.headerClassName}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-sm text-[var(--muted)]">
                  …
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-sm text-[var(--muted)]">
                  {empty ?? "—"}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={rowKey(row)} data-zebra={i % 2 === 1 ? "true" : "false"}>
                  {columns.map((col) => (
                    <td key={col.id} className={col.className}>
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {showPager ? (
        <Pagination
          page={page!}
          pageCount={pageCount!}
          total={total}
          pageSize={pageSize}
          onPageChange={onPageChange!}
          label={paginationLabel}
          dir={dir}
        />
      ) : null}
    </SoftCard>
  );
}
