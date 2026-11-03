import { describe, it, expect } from "vitest";
import { presetRange, previousRange, pctChange } from "./periods";
import { computePnl } from "./pnl";

describe("periods", () => {
  it("this week starts on Monday", () => {
    expect(presetRange("week", "2026-10-31")).toEqual({ start: "2026-10-26", end: "2026-10-31" });
  });
  it("last month covers the full previous month", () => {
    expect(presetRange("last_month", "2026-10-31")).toEqual({ start: "2026-09-01", end: "2026-09-30" });
  });
  it("previous period has the same length, right before", () => {
    expect(previousRange({ start: "2026-10-01", end: "2026-10-31" })).toEqual({ start: "2026-08-31", end: "2026-09-30" });
  });
  it("percentage change vs previous", () => {
    expect(pctChange(112.4, 100)).toBeCloseTo(12.4);
    expect(pctChange(5, 0)).toBeNull();
  });
});

describe("profit and loss", () => {
  it("net profit = revenue - COGS - expenses", () => {
    const p = computePnl({ revenue: 1000, cogs: 600, expenses: 270 });
    expect(p.gross).toBe(400);
    expect(p.net).toBe(130);
    expect(p.grossMargin).toBe(40);
    expect(p.netMargin).toBe(13);
  });
});
