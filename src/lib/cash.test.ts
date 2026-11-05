import { describe, expect, it } from "vitest";
import { cashChange, quickCashAmounts } from "./cash";

describe("quickCashAmounts", () => {
  it("suggests round-ups and the next notes, smallest first, at most three", () => {
    expect(quickCashAmounts(350)).toEqual([400, 500, 1000]);
    expect(quickCashAmounts(100)).toEqual([200, 500, 1000]);
    expect(quickCashAmounts(1950)).toEqual([2000, 5000]);
    expect(quickCashAmounts(1100)).toEqual([1500, 2000, 5000]);
  });
  it("never suggests the exact total or less", () => {
    for (const t of [50, 99, 100, 500, 1000, 2500, 4999, 5000, 12000]) {
      for (const a of quickCashAmounts(t)) expect(a).toBeGreaterThan(t);
    }
  });
  it("returns nothing for an empty or invalid total", () => {
    expect(quickCashAmounts(0)).toEqual([]);
    expect(quickCashAmounts(-5)).toEqual([]);
    expect(quickCashAmounts(Number.NaN)).toEqual([]);
  });
});

describe("cashChange", () => {
  it("returns change when enough cash is given", () => {
    expect(cashChange(1950, 2000)).toEqual({ change: 50, short: 0 });
    expect(cashChange(350, 350)).toEqual({ change: 0, short: 0 });
  });
  it("returns how much is short otherwise", () => {
    expect(cashChange(1950, 1000)).toEqual({ change: 0, short: 950 });
  });
});
