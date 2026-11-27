import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculatePagination } from "./pagination.ts";

describe("Pagination Domain & Calculation Logic", () => {
  it("handles 0 items gracefully", () => {
    const res = calculatePagination(0, 10, 1);
    assert.equal(res.totalPages, 1);
    assert.equal(res.safePage, 1);
    assert.equal(res.startItem, 0);
    assert.equal(res.endItem, 0);
    assert.deepEqual(res.pages, [1]);
  });

  it("handles single page of results correctly", () => {
    const res = calculatePagination(5, 10, 1);
    assert.equal(res.totalPages, 1);
    assert.equal(res.safePage, 1);
    assert.equal(res.startItem, 1);
    assert.equal(res.endItem, 5);
    assert.deepEqual(res.pages, [1]);
  });

  it("calculates multi-page results for 60 students with pageSize 10", () => {
    // Page 1
    const p1 = calculatePagination(60, 10, 1);
    assert.equal(p1.totalPages, 6);
    assert.equal(p1.safePage, 1);
    assert.equal(p1.startItem, 1);
    assert.equal(p1.endItem, 10);
    assert.deepEqual(p1.pages, [1, 2, 3, 4, 5, 6]);

    // Page 3
    const p3 = calculatePagination(60, 10, 3);
    assert.equal(p3.safePage, 3);
    assert.equal(p3.startItem, 21);
    assert.equal(p3.endItem, 30);

    // Page 6 (Last page)
    const p6 = calculatePagination(60, 10, 6);
    assert.equal(p6.safePage, 6);
    assert.equal(p6.startItem, 51);
    assert.equal(p6.endItem, 60);
  });

  it("generates smart ellipsis for large page counts (100 items, pageSize 10)", () => {
    // Near beginning
    const start = calculatePagination(100, 10, 2);
    assert.deepEqual(start.pages, [1, 2, 3, 4, 5, "...", 10]);

    // In the middle
    const mid = calculatePagination(100, 10, 6);
    assert.deepEqual(mid.pages, [1, "...", 5, 6, 7, "...", 10]);

    // Near the end
    const end = calculatePagination(100, 10, 9);
    assert.deepEqual(end.pages, [1, "...", 6, 7, 8, 9, 10]);
  });

  it("clamps out-of-bounds current page numbers safely", () => {
    // Negative page clamped to 1
    const under = calculatePagination(50, 10, -3);
    assert.equal(under.safePage, 1);
    assert.equal(under.startItem, 1);

    // Zero page clamped to 1
    const zero = calculatePagination(50, 10, 0);
    assert.equal(zero.safePage, 1);

    // Page exceeding totalPages clamped to totalPages
    const over = calculatePagination(50, 10, 999);
    assert.equal(over.safePage, 5);
    assert.equal(over.startItem, 41);
    assert.equal(over.endItem, 50);
  });

  it("handles non-divisible totalItems correctly", () => {
    const res = calculatePagination(23, 10, 3);
    assert.equal(res.totalPages, 3);
    assert.equal(res.safePage, 3);
    assert.equal(res.startItem, 21);
    assert.equal(res.endItem, 23);
  });

  it("protects against zero or negative pageSize", () => {
    const res = calculatePagination(15, 0, 1);
    assert.equal(res.totalPages, 15);
  });
});
