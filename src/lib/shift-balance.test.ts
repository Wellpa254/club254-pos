import { describe, expect, it } from "vitest";
import { reconcileShift } from "./shift-balance";

describe("reconcileShift", () => {
  it("expected cash = opening + cash sales − cash expenses; card/M-Pesa excluded", () => {
    const r = reconcileShift({
      opening_cash: 5000,
      sales: [{ total: 3000, payment_method: "cash" }, { total: 2000, payment_method: "mpesa" }],
      cash_expenses: 500,
      declared_cash: 7300,
    });
    expect(r.expected).toBe(7500);
    expect(r.totalSales).toBe(5000);
    expect(r.variance).toBe(-200);
  });
  it("open shift has no variance", () => {
    expect(reconcileShift({ opening_cash: 1000, sales: [], cash_expenses: 0, declared_cash: null }).variance).toBeNull();
  });
});
