import React from "react";

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
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  renderCard,
  emptyState,
  className = "",
}: DataTableProps<T>) {
  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Mobile & Tablet Card Stack (<1024px) */}
      <div className="lg:hidden flex flex-col gap-2.5">
        {renderCard
          ? data.map((item, idx) => (
              <React.Fragment key={keyExtractor(item, idx)}>
                {renderCard(item, idx)}
              </React.Fragment>
            ))
          : data.map((item, idx) => (
              <div
                key={keyExtractor(item, idx)}
                className="bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] p-4 flex flex-col gap-1.5"
              >
                {columns.map((col) => (
                  <div key={col.key} className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-[#5F6670] font-medium">{col.header}</span>
                    <span className="text-[#1C1F23]">
                      {col.render ? col.render(item, idx) : (item as any)[col.key]}
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
              {data.map((item, idx) => (
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
                        {col.render ? col.render(item, idx) : (item as any)[col.key]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
