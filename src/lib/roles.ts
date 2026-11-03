export type Role = "owner" | "manager" | "cashier" | "stock_manager";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  stock_manager: "Stock Manager",
};

export type NavKey = "dashboard" | "pos" | "inventory" | "shifts" | "pnl" | "expenses" | "purchases" | "staff" | "shift_balance" | "reports" | "audit";

/** Which app areas each role may open. The database enforces the same rules. */
export const ROLE_ACCESS: Record<Role, NavKey[]> = {
  owner: ["dashboard", "pos", "inventory", "shifts", "shift_balance", "pnl", "expenses", "purchases", "reports", "audit", "staff"],
  manager: ["dashboard", "pos", "inventory", "shifts", "shift_balance", "pnl", "expenses", "purchases", "reports"],
  cashier: ["pos", "shifts"],
  stock_manager: ["inventory", "purchases"],
};

export function canAccess(roles: Role[], key: NavKey) {
  return roles.some((r) => ROLE_ACCESS[r].includes(key));
}

export function homeFor(roles: Role[]): "/dashboard" | "/pos" | "/inventory" | "/profile" {
  if (roles.includes("owner") || roles.includes("manager")) return "/dashboard";
  if (roles.includes("cashier")) return "/pos";
  if (roles.includes("stock_manager")) return "/inventory";
  return "/profile";
}
