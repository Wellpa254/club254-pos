import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PeriodPicker, usePeriod } from "@/components/period-picker";
import { usePnlDaily, useExpenseBreakdown } from "@/hooks/use-pnl";
import { computePnl, sumRows } from "@/lib/pnl";
import { fmtRange } from "@/lib/periods";
import { ksh } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pnl")({
  head: () => ({ meta: [{ title: "Profit & Loss — Club254" }, { name: "description", content: "Revenue, cost of goods, expenses and net profit." }] }),
  component: PnlPage,
});

function PnlPage() {
  const period = usePeriod("month");
  const rows = usePnlDaily(period.range);
  const breakdown = useExpenseBreakdown(period.range);
  const [open, setOpen] = useState(true);
  const p = computePnl(sumRows(rows.data ?? []));
  const tx = (rows.data ?? []).reduce((a, r) => a + r.transactions, 0);

  return (
    <AppShell area="pnl" title="Profit & Loss" actions={<PeriodPicker period={period} />}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <div className="eyebrow">Statement</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{fmtRange(period.range)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tx} completed sales. Stock purchases affect profit only when the goods are sold.</p>
        </div>
        <div className="surface-card divide-y">
          <Line label="Revenue" sub="Completed sales" value={p.revenue} strong />
          <Line label="Cost of goods sold" sub="Weighted-average cost of items sold" value={-p.cogs} />
          <Line label="Gross profit" value={p.gross} strong highlight extra={`${p.grossMargin.toFixed(1)}% gross margin`} />
          <div>
            <button className="flex w-full items-center justify-between px-6 py-4 text-left" onClick={() => setOpen(!open)}>
              <div><div className="text-sm">Operating expenses</div><div className="text-xs text-muted-foreground">{breakdown.data?.length ?? 0} categories</div></div>
              <div className="flex items-center gap-3"><span className="tabular">{ksh(-p.expenses)}</span><ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} /></div>
            </button>
            {open && (
              <div className="bg-secondary/40 px-6 py-2">
                {breakdown.data?.length ? breakdown.data.map((b) => (
                  <div key={b.category} className="flex justify-between py-1.5 text-sm"><span className="text-muted-foreground">{b.category}</span><span className="tabular">{ksh(b.total)}</span></div>
                )) : <div className="py-2 text-sm text-muted-foreground">No expenses recorded in this period.</div>}
              </div>
            )}
          </div>
          <Line label="Net profit" value={p.net} strong highlight big extra={`${p.netMargin.toFixed(1)}% net margin`} />
        </div>
      </div>
    </AppShell>
  );
}

function Line({ label, sub, value, strong, highlight, big, extra }: { label: string; sub?: string; value: number; strong?: boolean; highlight?: boolean; big?: boolean; extra?: string }) {
  return (
    <div className={cn("flex items-center justify-between px-6 py-4", highlight && "bg-accent/40")}>
      <div>
        <div className={cn("text-sm", strong && "font-semibold")}>{label}</div>
        {(sub || extra) && <div className="text-xs text-muted-foreground">{sub ?? extra}</div>}
      </div>
      <div className={cn("tabular", strong && "font-semibold", big && "text-2xl", highlight && value < 0 && "text-destructive", big && value > 0 && "text-gold")}>{ksh(value)}</div>
    </div>
  );
}
