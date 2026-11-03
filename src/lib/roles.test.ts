import { describe, it, expect } from "vitest";
import { canAccess, homeFor } from "./roles";

describe("role access", () => {
  it("cashier only reaches POS and shifts", () => {
    expect(canAccess(["cashier"], "pos")).toBe(true);
    expect(canAccess(["cashier"], "inventory")).toBe(false);
    expect(canAccess(["cashier"], "dashboard")).toBe(false);
    expect(canAccess(["cashier"], "staff")).toBe(false);
  });
  it("stock manager reaches inventory but not POS", () => {
    expect(canAccess(["stock_manager"], "inventory")).toBe(true);
    expect(canAccess(["stock_manager"], "pos")).toBe(false);
  });
  it("purchases are for cost roles, never cashiers", () => {
    expect(canAccess(["cashier"], "purchases")).toBe(false);
    expect(canAccess(["stock_manager"], "purchases")).toBe(true);
    expect(canAccess(["manager"], "purchases")).toBe(true);
  });
  it("only owner manages staff", () => {
    expect(canAccess(["manager"], "staff")).toBe(false);
    expect(canAccess(["owner"], "staff")).toBe(true);
  });
  it("routes each role to its home after login", () => {
    expect(homeFor(["owner"])).toBe("/dashboard");
    expect(homeFor(["cashier"])).toBe("/pos");
    expect(homeFor(["stock_manager"])).toBe("/inventory");
  });
});

import { canAccess as _ca } from "./roles";
describe("shift balance access", () => {
  it("owner and manager only", () => {
    expect(_ca(["owner"], "shift_balance")).toBe(true);
    expect(_ca(["manager"], "shift_balance")).toBe(true);
    expect(_ca(["cashier"], "shift_balance")).toBe(false);
    expect(_ca(["stock_manager"], "shift_balance")).toBe(false);
  });
});

describe("reports and audit access", () => {
  it("owner and manager see reports; only owner sees audit log", () => {
    expect(canAccess(["manager"], "reports")).toBe(true);
    expect(canAccess(["cashier"], "reports")).toBe(false);
    expect(canAccess(["stock_manager"], "reports")).toBe(false);
    expect(canAccess(["owner"], "audit")).toBe(true);
    expect(canAccess(["manager"], "audit")).toBe(false);
  });
});
