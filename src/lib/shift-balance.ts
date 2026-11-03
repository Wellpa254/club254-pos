export type ShiftBalanceInput = {
  opening_cash: number;
  sales: { total: number; payment_method: string }[];
  cash_expenses: number;
  declared_cash: number | null;
};

/** Drawer reconciliation: opening + cash sales − cash expenses paid out = expected; declared − expected = variance. */
export function reconcileShift(s: ShiftBalanceInput) {
  const byMethod: Record<string, number> = {};
  for (const x of s.sales) byMethod[x.payment_method] = (byMethod[x.payment_method] ?? 0) + Number(x.total);
  const totalSales = Object.values(byMethod).reduce((a, b) => a + b, 0);
  const cashSales = byMethod['cash'] ?? 0;
  const expected = Number(s.opening_cash) + cashSales - s.cash_expenses;
  const variance = s.declared_cash == null ? null : Number(s.declared_cash) - expected;
  return { byMethod, totalSales, cashSales, nonCashSales: totalSales - cashSales, expected, variance };
}
