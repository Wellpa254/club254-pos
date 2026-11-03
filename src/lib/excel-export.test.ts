import { describe, it, expect } from "vitest";
import { summarize } from "./excel-export";
describe("summarize", () => {
  it("excludes voided sales and voided expenses from dashboard totals", () => {
    const { kpis, charts } = summarize([
      { key: "sales", name: "Sales", rows: [{ Payment: "cash", "Total (KSh)": 500, Status: "completed" }, { Payment: "mpesa", "Total (KSh)": 900, Status: "voided" }] },
      { key: "expenses", name: "Expenses", rows: [{ Category: "Rent", "Amount (KSh)": 35000, Status: "Voided: test" }, { Category: "Wages", "Amount (KSh)": 1000, Status: "Active" }] },
    ]);
    expect(kpis.find((k) => k.label === "TOTAL REVENUE")?.value).toBe(500);
    expect(kpis.find((k) => k.label === "EXPENSES")?.value).toBe(1000);
    expect(charts.find((c) => c.title === "Payment methods")?.cats).toEqual(["Cash"]);
  });
});
