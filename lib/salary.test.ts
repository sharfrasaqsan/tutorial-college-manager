import { test, describe } from "node:test";
import assert from "node:assert";
import { getSalaryStatus, formatInvoiceNumber } from "./salary.ts";

describe("Salary Library", () => {
  test("status is onHold until required sessions are held", () => {
    assert.strictEqual(getSalaryStatus(7, 8, false), "onHold");
    assert.strictEqual(getSalaryStatus(0, 8, false), "onHold");
  });

  test("status becomes ready once required sessions are reached", () => {
    assert.strictEqual(getSalaryStatus(8, 8, false), "ready");
    assert.strictEqual(getSalaryStatus(9, 8, false), "ready");
  });

  test("status is paid when marked paid regardless of session count", () => {
    assert.strictEqual(getSalaryStatus(8, 8, true), "paid");
    assert.strictEqual(getSalaryStatus(6, 8, true), "paid");
  });

  test("generates invoice number in SAL-YYYY-MM-NNN format", () => {
    assert.strictEqual(formatInvoiceNumber(2026, 11, 1), "SAL-2026-11-001");
    assert.strictEqual(formatInvoiceNumber("2026", "2026-05", 42), "SAL-2026-05-042");
  });
});
