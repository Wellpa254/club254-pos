export type Totals = { revenue: number; cogs: number; expenses: number };

/** Core P&L rules: purchases are never expenses; COGS comes from goods sold. */
export function computePnl(t: Totals) {
  const gross = t.revenue - t.cogs;
  const net = gross - t.expenses;
  return {
    ...t,
    gross,
    net,
    grossMargin: t.revenue ? (gross / t.revenue) * 100 : 0,
    netMargin: t.revenue ? (net / t.revenue) * 100 : 0,
  };
}

export function sumRows(rows: { revenue: number | string; cogs: number | string; expenses: number | string }[]): Totals {
  return rows.reduce<Totals>((a, r) => ({
    revenue: a.revenue + Number(r.revenue), cogs: a.cogs + Number(r.cogs), expenses: a.expenses + Number(r.expenses),
  }), { revenue: 0, cogs: 0, expenses: 0 });
}
