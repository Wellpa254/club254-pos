import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState, StatCard } from "@/components/app-shell";
import { PeriodPicker, usePeriod } from "@/components/period-picker";
import { Badge } from "@/components/ui/badge";
import { ksh, fmtDateTime } from "@/lib/format";
import { reconcileShift } from "@/lib/shift-balance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/shift-balance")({
  head: () => ({
    meta: [
      { title: "Shift Balance — Club254" },
      { name: "description", content: "Opening cash, sales, expenses and closing cash for every cashier shift, reconciled." },
      { property: "og:title", content: "Shift Balance — Club254" },
      { property: "og:description", content: "Reconcile every cashier shift's drawer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShiftBalancePage,
});

const METHOD: Record<string, string> = { cash: "Cash", mpesa: "M-Pesa", card: "Card" };

function ShiftBalancePage() {
  const period = usePeriod("week");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const from = `${period.range.start}T00:00:00+03:00`;
  const to = `${period.range.end}T23:59:59.999+03:00`;

  const q = useQuery({
    queryKey: ["shift-balance", from, to],
    queryFn: async () => {
      const { data: shifts, error } = await supabase.from("cashier_shifts").select("*").gte("opened_at", from).lte("opened_at", to).order("opened_at", { ascending: false });
      if (error) throw error;
      const ids = (shifts ?? []).map((s) => s.id);
      const cashierIds = [...new Set((shifts ?? []).map((s) => s.cashier_id))];
      const [sales, people, exps] = await Promise.all([
        ids.length ? supabase.from("sales").select("shift_id,total,payment_method").in("shift_id", ids) : Promise.resolve({ data: [] as { shift_id: string | null; total: number; payment_method: string }[] }),
        cashierIds.length ? supabase.from("profiles").select("id,full_name,email").in("id", cashierIds) : Promise.resolve({ data: [] as { id: string; full_name: string; email: string }[] }),
        supabase.from("expenses").select("amount,created_at,description").eq("payment_method", "cash").is("voided_at", null).gte("created_at", from).order("created_at"),
      ]);
      return (shifts ?? []).map((s) => {
        const end = s.closed_at ?? new Date().toISOString();
        const shiftExp = (exps.data ?? []).filter((e) => e.created_at >= s.opened_at && e.created_at <= end);
        const cashExp = shiftExp.reduce((a, e) => a + Number(e.amount), 0);
        const p = people.data?.find((x) => x.id === s.cashier_id);
        return {
          ...s,
          cashier: p?.full_name || p?.email || "Cashier",
          expenses: shiftExp,
          cashExp,
          r: reconcileShift({
            opening_cash: Number(s.opening_cash),
            sales: (sales.data ?? []).filter((x) => x.shift_id === s.id).map((x) => ({ total: Number(x.total), payment_method: x.payment_method })),
            cash_expenses: cashExp,
            declared_cash: s.declared_cash == null ? null : Number(s.declared_cash),
          }),
        };
      });
    },
  });

  const rows = q.data ?? [];
  const closed = rows.filter((r) => r.r.variance !== null);
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const netVar = closed.reduce((a, r) => a + (r.r.variance ?? 0), 0);

  return (
    <AppShell area="shift_balance" title="Shift balance">
      <div className="space-y-6">
        <PeriodPicker period={period} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Shifts" value={String(rows.length)} hint={`${rows.length - closed.length} still open`} />
          <StatCard label="Total sales" value={ksh(sum((r) => r.r.totalSales))} hint={`${ksh(sum((r) => r.r.cashSales))} in cash`} />
          <StatCard label="Cash expenses paid out" value={ksh(sum((r) => r.cashExp))} />
          <StatCard label="Net drawer variance" value={`${netVar > 0 ? "+" : ""}${ksh(netVar)}`} hint={`${closed.filter((r) => Math.abs(r.r.variance ?? 0) >= 1).length} shifts off balance`} />
        </div>
        <p className="text-xs text-muted-foreground">Expected cash = opening cash + cash sales − cash expenses recorded during the shift. M-Pesa and card sales don't go into the drawer.</p>
        <div className="surface-card overflow-x-auto">
          {rows.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="p-3" /><th className="p-3 font-medium">Shift</th><th className="p-3 font-medium">Cashier</th>
                  <th className="p-3 text-right font-medium">Opening</th><th className="p-3 text-right font-medium">Sales</th>
                  <th className="p-3 text-right font-medium">Cash expenses</th><th className="p-3 text-right font-medium">Expected</th>
                  <th className="p-3 text-right font-medium">Closing (counted)</th><th className="p-3 text-right font-medium">Variance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const v = s.r.variance;
                  const expanded = openRow === s.id;
                  return (
                    <Fragment key={s.id}>
                      <tr className="cursor-pointer border-b last:border-0 hover:bg-muted/40" onClick={() => setOpenRow(expanded ? null : s.id)}>
                        <td className="p-3 text-muted-foreground">{expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</td>
                        <td className="p-3">{fmtDateTime(s.opened_at)}<div className="text-xs text-muted-foreground">{s.closed_at ? `to ${fmtDateTime(s.closed_at)}` : "Open"}</div></td>
                        <td className="p-3">{s.cashier}</td>
                        <td className="p-3 text-right tabular-nums">{ksh(s.opening_cash)}</td>
                        <td className="p-3 text-right tabular-nums">{ksh(s.r.totalSales)}<div className="text-xs text-muted-foreground">{ksh(s.r.cashSales)} cash</div></td>
                        <td className="p-3 text-right tabular-nums">{s.cashExp ? `−${ksh(s.cashExp)}` : "—"}</td>
                        <td className="p-3 text-right tabular-nums">{ksh(s.r.expected)}</td>
                        <td className="p-3 text-right tabular-nums">{s.declared_cash == null ? "—" : ksh(s.declared_cash)}</td>
                        <td className="p-3 text-right">
                          {v === null ? <Badge variant="outline">Open</Badge> : Math.abs(v) < 1 ? <Badge className="bg-success/15 text-success">Balanced</Badge> : <span className={cn("font-semibold tabular-nums", v < 0 ? "text-destructive" : "text-warning")}>{v > 0 ? "+" : ""}{ksh(v)}</span>}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b bg-muted/20">
                          <td colSpan={9} className="p-4">
                            <div className="grid gap-6 md:grid-cols-3">
                              <div>
                                <div className="eyebrow mb-2">Reconciliation</div>
                                <Line l="Opening cash" v={ksh(s.opening_cash)} />
                                <Line l="+ Cash sales" v={ksh(s.r.cashSales)} />
                                <Line l="− Cash expenses" v={ksh(s.cashExp)} />
                                <Line l="= Expected in drawer" v={ksh(s.r.expected)} strong />
                                <Line l="Counted at close" v={s.declared_cash == null ? "—" : ksh(s.declared_cash)} />
                                <Line l="Variance" v={v === null ? "—" : `${v > 0 ? "+" : ""}${ksh(v)}`} strong />
                              </div>
                              <div>
                                <div className="eyebrow mb-2">Sales by payment</div>
                                {Object.keys(s.r.byMethod).length ? Object.entries(s.r.byMethod).map(([m, t]) => <Line key={m} l={METHOD[m] ?? m} v={ksh(t)} />) : <p className="text-muted-foreground">No sales</p>}
                              </div>
                              <div>
                                <div className="eyebrow mb-2">Cash expenses in this shift</div>
                                {s.expenses.length ? s.expenses.map((e, i) => <Line key={i} l={e.description || "Expense"} v={ksh(e.amount)} />) : <p className="text-muted-foreground">None</p>}
                                {s.discrepancy_reason && <p className="mt-3 text-xs text-muted-foreground">Cashier's note: {s.discrepancy_reason}</p>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState icon={Scale} title={q.isLoading ? "Loading shifts…" : "No shifts in this period"} body="Shifts appear here once cashiers open them." />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Line({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return <div className={cn("flex justify-between py-0.5", strong && "border-t pt-1 font-semibold")}><span>{l}</span><span className="tabular-nums">{v}</span></div>;
}
