import { describe, expect, it } from "vitest";
import { isWaitingForPrice, productEditProblem } from "./product-edit";

const ok = { name: "Vat 69 375ml", sku: "SPR-VAT-69-375ML", selling_price: "1100", low_stock_threshold: "2", active: true };

describe("productEditProblem", () => {
  it("accepts a complete form", () => expect(productEditProblem(ok)).toBeNull());
  it("needs a name and SKU", () => {
    expect(productEditProblem({ ...ok, name: "  " })).toMatch(/name/i);
    expect(productEditProblem({ ...ok, sku: "" })).toMatch(/sku/i);
  });
  it("rejects blank, negative or non-numeric prices and alert levels", () => {
    expect(productEditProblem({ ...ok, selling_price: "" })).toMatch(/price/i);
    expect(productEditProblem({ ...ok, selling_price: "-5" })).toMatch(/price/i);
    expect(productEditProblem({ ...ok, selling_price: "abc" })).toMatch(/price/i);
    expect(productEditProblem({ ...ok, low_stock_threshold: "-1" })).toMatch(/low-stock/i);
  });
  it("won't switch a product on at KSh 0, but allows a hidden product at 0", () => {
    expect(productEditProblem({ ...ok, selling_price: "0" })).toMatch(/above 0/);
    expect(productEditProblem({ ...ok, selling_price: "0", active: false })).toBeNull();
  });
});

describe("isWaitingForPrice", () => {
  it("flags only inactive products priced at 0", () => {
    expect(isWaitingForPrice({ active: false, selling_price: 0 })).toBe(true);
    expect(isWaitingForPrice({ active: false, selling_price: "0.00" })).toBe(true);
    expect(isWaitingForPrice({ active: true, selling_price: 0 })).toBe(false);
    expect(isWaitingForPrice({ active: false, selling_price: 350 })).toBe(false);
  });
});
