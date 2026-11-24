"use client";

import React, { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Skeleton } from "./Skeleton";

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
  render: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T, index: number) => string;
  renderMobileCard?: (item: T, index: number) => React.ReactNode;
  emptyState?: React.ReactNode;
  loading?: boolean;
  loadingRowCount?: number;
  onRowClick?: (item: T) => void;
  className?: string;
  initialSortKey?: string;
  initialSortOrder?: "asc" | "desc";
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  renderMobileCard,
  emptyState,
  loading = false,
  loadingRowCount = 4,
  onRowClick,
  className = "",
  initialSortKey,
  initialSortOrder = "asc",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialSortOrder);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  }

  // Sort data if sortKey is set
  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const sorted = [...data];
    sorted.sort((a: any, b: any) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortOrder === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
    return sorted;
  }, [data, sortKey, sortOrder]);

  // Loading state
  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {/* Mobile Skeleton Cards */}
        <div className="lg:hidden space-y-3">
          {Array.from({ length: loadingRowCount }).map((_, i) => (
            <div
              key={`skel-card-${i}`}
              className="p-4 border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] space-y-2.5"
            >
              <Skeleton variant="rectangular" height={16} width="60%" />
              <Skeleton variant="rectangular" height={12} width="85%" />
              <Skeleton variant="rectangular" height={12} width="40%" />
            </div>
          ))}
        </div>

        {/* Desktop Skeleton Table */}
        <div className="hidden lg:block border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] overflow-hidden">
          <div className="h-10 bg-[#FAF9F6] border-b border-[#E4E1DA]" />
          <div className="p-4 space-y-3">
            {Array.from({ length: loadingRowCount }).map((_, i) => (
              <Skeleton key={`skel-row-${i}`} variant="rectangular" height={36} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (sortedData.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    return (
      <div className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-8 text-center text-xs text-[#5F6670]">
        No records found.
      </div>
    );
  }

  return (
    <div className={className}>
      {/* ============================================================ */}
      {/* 1. MOBILE/TABLET VIEW (< lg): Cards / DataRow Stack          */}
      {/* ============================================================ */}
      <div className="lg:hidden space-y-2.5">
        {sortedData.map((item, index) => {
          const key = keyExtractor(item, index);
          if (renderMobileCard) {
            return (
              <div key={key} onClick={() => onRowClick?.(item)}>
                {renderMobileCard(item, index)}
              </div>
            );
          }

          // Default fallback card
          return (
            <div
              key={key}
              onClick={() => onRowClick?.(item)}
              className="p-4 border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] shadow-xs space-y-2"
            >
              {columns.map((col) => (
                <div key={col.key} className="flex items-center justify-between text-xs">
                  <span className="text-[#5F6670]">{col.header}:</span>
                  <span className="font-medium text-[#1C1F23]">
                    {col.render(item, index)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* 2. DESKTOP VIEW (>= lg): Semantic HTML Table with Sticky Top */}
      {/* ============================================================ */}
      <div className="hidden lg:block border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[720px] overscroll-contain">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-[#FAF9F6] border-b border-[#E4E1DA]">
              <tr>
                {columns.map((col) => {
                  const alignClass = {
                    left: "text-left",
                    center: "text-center",
                    right: "text-right",
                  }[col.align || "left"];

                  return (
                    <th
                      key={col.key}
                      scope="col"
                      className={`px-4 py-3 text-xs font-semibold text-[#1C1F23] uppercase tracking-wider ${alignClass} ${col.className || ""}`}
                    >
                      {col.sortable ? (
                        <button
                          type="button"
                          onClick={() => handleSort(col.key)}
                          className="inline-flex items-center gap-1.5 hover:text-[#1F5C4D] transition-colors focus:outline-hidden"
                          aria-label={`Sort by ${col.header}`}
                        >
                          <span>{col.header}</span>
                          {sortKey === col.key ? (
                            sortOrder === "asc" ? (
                              <ArrowUp className="w-3.5 h-3.5 text-[#1F5C4D]" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-[#1F5C4D]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-[#5F6670]/60" />
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E1DA] text-xs text-[#1C1F23]">
              {sortedData.map((item, index) => {
                const key = keyExtractor(item, index);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(item)}
                    className={`transition-colors ${
                      onRowClick
                        ? "cursor-pointer hover:bg-[#FAF9F6]/80"
                        : "hover:bg-[#FAF9F6]/50"
                    }`}
                  >
                    {columns.map((col) => {
                      const alignClass = {
                        left: "text-left",
                        center: "text-center",
                        right: "text-right",
                      }[col.align || "left"];

                      return (
                        <td
                          key={col.key}
                          className={`px-4 py-3.5 tabular-nums ${alignClass} ${col.className || ""}`}
                        >
                          {col.render(item, index)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
