"use client";

import React, { useState, useEffect } from "react";
import { Pagination } from "@/components/ui/Pagination";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
  render?: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderCard?: (item: T, index: number) => React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
  pageSize?: number;
  pageSizeOptions?: number[];
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  itemLabel?: string;
  pagination?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  renderCard,
  emptyState,
  className = "",
  pageSize,
  pageSizeOptions,
  currentPage,
  onPageChange,
  onPageSizeChange,
  itemLabel = "items",
  pagination = false,
}: DataTableProps<T>) {
  const isPaginationEnabled = pagination || typeof pageSize === "number";
  const defaultPageSize = pageSize || 10;

  const [internalPage, setInternalPage] = useState<number>(1);
  const [internalPageSize, setInternalPageSize] = useState<number>(defaultPageSize);

  // Sync internal state if props change
  useEffect(() => {
    if (pageSize) {
      setInternalPageSize(pageSize);
    }
  }, [pageSize]);

  // Reset to page 1 if data length changes significantly or filters change
  useEffect(() => {
    if (currentPage === undefined) {
      const activeSize = pageSize || internalPageSize;
      const maxPages = Math.max(1, Math.ceil(data.length / activeSize));
      if (internalPage > maxPages) {
        setInternalPage(1);
      }
    }
  }, [data.length, currentPage, pageSize, internalPageSize, internalPage]);

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const activePage = currentPage !== undefined ? currentPage : internalPage;
  const activePageSize = pageSize !== undefined ? pageSize : internalPageSize;

  const handlePageChange = (page: number) => {
    if (onPageChange) {
      onPageChange(page);
    } else {
      setInternalPage(page);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    if (onPageSizeChange) {
      onPageSizeChange(newSize);
    } else {
      setInternalPageSize(newSize);
    }
  };

  const displayData = isPaginationEnabled
    ? data.slice((activePage - 1) * activePageSize, activePage * activePageSize)
    : data;

  return (
    <div className={`w-full flex flex-col gap-3 ${className}`}>
      {/* Mobile & Tablet Card Stack (<1024px) */}
      <div className="lg:hidden flex flex-col gap-2.5">
        {renderCard
          ? displayData.map((item, idx) => (
              <React.Fragment key={keyExtractor(item, idx)}>
                {renderCard(item, (activePage - 1) * activePageSize + idx)}
              </React.Fragment>
            ))
          : displayData.map((item, idx) => (
              <div
                key={keyExtractor(item, idx)}
                className="bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] p-4 flex flex-col gap-1.5"
              >
                {columns.map((col) => (
                  <div key={col.key} className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-[#5F6670] font-medium">{col.header}</span>
                    <span className="text-[#1C1F23]">
                      {col.render
                        ? col.render(item, (activePage - 1) * activePageSize + idx)
                        : (item as any)[col.key]}
                    </span>
                  </div>
                ))}
              </div>
            ))}
      </div>

      {/* Desktop Semantic Table (>=1024px) */}
      <div className="hidden lg:block border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#FAF9F6] border-b border-[#E4E1DA] sticky top-0 z-10 select-none">
              <tr>
                {columns.map((col) => {
                  const alignClass =
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left";
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      className={`py-3 px-4 font-semibold text-[#5F6670] uppercase tracking-wider text-[11px] ${alignClass} ${
                        col.className || ""
                      }`}
                    >
                      {col.header}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E1DA]">
              {displayData.map((item, idx) => {
                const globalIdx = (activePage - 1) * activePageSize + idx;
                return (
                  <tr
                    key={keyExtractor(item, idx)}
                    className="hover:bg-[#FAF9F6]/80 transition-colors group"
                  >
                    {columns.map((col) => {
                      const alignClass =
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                          ? "text-center"
                          : "text-left";
                      return (
                        <td
                          key={col.key}
                          className={`py-3.5 px-4 text-[#1C1F23] align-middle ${alignClass} ${
                            col.className || ""
                          }`}
                        >
                          {col.render ? col.render(item, globalIdx) : (item as any)[col.key]}
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

      {/* Pagination Footer */}
      {isPaginationEnabled && data.length > 0 && (
        <Pagination
          currentPage={activePage}
          totalItems={data.length}
          pageSize={activePageSize}
          onPageChange={handlePageChange}
          pageSizeOptions={pageSizeOptions}
          onPageSizeChange={handlePageSizeChange}
          itemLabel={itemLabel}
        />
      )}
    </div>
  );
}
