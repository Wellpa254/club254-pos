import { describe, it, expect } from "vitest";
import { topProducts } from "./reports";
describe("topProducts", () => {
  it("sums per product and sorts by revenue", () => {
    const r = topProducts([{ product_name: "Keg", quantity: 2, subtotal: 240 }, { product_name: "Choma", quantity: 1, subtotal: 1200 }, { product_name: "Keg", quantity: 1, subtotal: 120 }]);
    expect(r[0]).toEqual({ Product: "Choma", "Qty sold": 1, "Revenue (KSh)": 1200 });
    expect(r[1]).toEqual({ Product: "Keg", "Qty sold": 3, "Revenue (KSh)": 360 });
  });
});
