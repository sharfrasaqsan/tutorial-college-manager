"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { calculatePagination } from "@/lib/pagination";

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
  showItemCount?: boolean;
  itemLabel?: string;
  compact?: boolean;
  hideOnSinglePage?: boolean;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  className = "",
  showItemCount = true,
  itemLabel = "results",
  compact = false,
  hideOnSinglePage = false,
}: PaginationProps) {
  const { totalPages, safePage, startItem, endItem, pages } = calculatePagination(
    totalItems,
    pageSize,
    currentPage
  );

  if (hideOnSinglePage && totalPages <= 1 && totalItems <= pageSize) {
    return null;
  }

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-1 text-xs text-[#5F6670] ${className}`}
      role="navigation"
      aria-label="Pagination"
    >
      {/* Left: Item Count info & Page Size selection */}
      <div className="flex items-center gap-3 flex-wrap">
        {showItemCount && (
          <span>
            Showing <strong className="text-[#1C1F23] font-semibold">{startItem}</strong> to{" "}
            <strong className="text-[#1C1F23] font-semibold">{endItem}</strong> of{" "}
            <strong className="text-[#1C1F23] font-semibold">{totalItems}</strong> {itemLabel}
          </span>
        )}

        {pageSizeOptions && pageSizeOptions.length > 0 && onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-[11px] text-[#5F6670]">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="bg-white border border-[#E4E1DA] text-[#1C1F23] rounded-[4px] px-2 py-1 text-xs focus:outline-hidden focus:border-[#1F5C4D] focus:ring-1 focus:ring-[#1F5C4D] cursor-pointer"
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page Navigation Controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* Jump to First Page */}
          {!compact && (
            <button
              type="button"
              onClick={() => onPageChange(1)}
              disabled={safePage === 1}
              aria-label="First page"
              className={`h-8 w-8 inline-flex items-center justify-center rounded-[4px] border transition-colors ${
                safePage === 1
                  ? "bg-[#FAF9F6] text-[#A8AFB8] border-[#E4E1DA]/60 cursor-not-allowed"
                  : "bg-white text-[#1C1F23] border-[#E4E1DA] hover:bg-[#FAF9F6] hover:border-[#1F5C4D] hover:text-[#1F5C4D] cursor-pointer"
              }`}
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage === 1}
            aria-label="Previous page"
            className={`h-8 px-2 inline-flex items-center justify-center gap-1 rounded-[4px] border transition-colors ${
              safePage === 1
                ? "bg-[#FAF9F6] text-[#A8AFB8] border-[#E4E1DA]/60 cursor-not-allowed"
                : "bg-white text-[#1C1F23] border-[#E4E1DA] hover:bg-[#FAF9F6] hover:border-[#1F5C4D] hover:text-[#1F5C4D] cursor-pointer"
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {!compact && <span className="hidden sm:inline">Prev</span>}
          </button>

          {/* Numbered Page Buttons */}
          <div className="flex items-center gap-1">
            {pages.map((p, idx) => {
              if (p === "...") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="h-8 w-6 inline-flex items-center justify-center text-[#5F6670] select-none"
                  >
                    …
                  </span>
                );
              }

              const isCurrent = p === safePage;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-label={`Page ${p}`}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`h-8 min-w-[32px] px-2 inline-flex items-center justify-center rounded-[4px] text-xs font-medium border transition-colors cursor-pointer ${
                    isCurrent
                      ? "bg-[#1F5C4D] text-white border-[#1F5C4D] font-bold shadow-xs"
                      : "bg-white text-[#1C1F23] border-[#E4E1DA] hover:bg-[#FAF9F6] hover:border-[#1F5C4D] hover:text-[#1F5C4D]"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Next Page */}
          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage === totalPages}
            aria-label="Next page"
            className={`h-8 px-2 inline-flex items-center justify-center gap-1 rounded-[4px] border transition-colors ${
              safePage === totalPages
                ? "bg-[#FAF9F6] text-[#A8AFB8] border-[#E4E1DA]/60 cursor-not-allowed"
                : "bg-white text-[#1C1F23] border-[#E4E1DA] hover:bg-[#FAF9F6] hover:border-[#1F5C4D] hover:text-[#1F5C4D] cursor-pointer"
            }`}
          >
            {!compact && <span className="hidden sm:inline">Next</span>}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Jump to Last Page */}
          {!compact && (
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              disabled={safePage === totalPages}
              aria-label="Last page"
              className={`h-8 w-8 inline-flex items-center justify-center rounded-[4px] border transition-colors ${
                safePage === totalPages
                  ? "bg-[#FAF9F6] text-[#A8AFB8] border-[#E4E1DA]/60 cursor-not-allowed"
                  : "bg-white text-[#1C1F23] border-[#E4E1DA] hover:bg-[#FAF9F6] hover:border-[#1F5C4D] hover:text-[#1F5C4D] cursor-pointer"
              }`}
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
