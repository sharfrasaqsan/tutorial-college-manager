export interface PaginationCalculation {
  totalPages: number;
  safePage: number;
  startItem: number;
  endItem: number;
  pages: (number | "...")[];
}

export function calculatePagination(
  totalItems: number,
  pageSize: number,
  currentPage: number
): PaginationCalculation {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = totalItems === 0 ? 0 : (safePage - 1) * safePageSize + 1;
  const endItem = Math.min(safePage * safePageSize, totalItems);

  let pages: (number | "...")[];
  if (totalPages <= 7) {
    pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else if (safePage <= 4) {
    pages = [1, 2, 3, 4, 5, "...", totalPages];
  } else if (safePage >= totalPages - 3) {
    pages = [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  } else {
    pages = [1, "...", safePage - 1, safePage, safePage + 1, "...", totalPages];
  }

  return {
    totalPages,
    safePage,
    startItem,
    endItem,
    pages,
  };
}
