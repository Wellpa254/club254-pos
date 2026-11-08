import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Boxes, Clock, Users, AlertTriangle, Wallet, TrendingUp, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PeriodPicker, usePeriod } from "@/components/period-picker";
import { FinanceChart, KpiCard, METRIC_LABEL, type Metric } from "@/components/finance";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMe } from "@/hooks/use-me";
import { usePnlDaily, useExpenseBreakdown } from "@/hooks/use-pnl";
import { ksh, greeting } from "@/lib/format";
import { computePnl, sumRows } from "@/lib/pnl";
import { fmtRange, groupRows, pctChange, previousRange, daysBetween } from "@/lib/periods";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Blooms Members Club" }, { name: "description", content: "Your club's performance at a glance." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useMe();
  const period = usePeriod("month");
  const prevRange = previousRange(period.range);
  const cur = usePnlDaily(period.range);
  const prev = usePnlDaily(prevRange);
  const curExp = useExpenseBreakdown(period.range);
  const prevExp = useExpenseBreakdown(prevRange);
  const [metric, setMetric] = useState<Metric>("revenue");
  const span = daysBetween(period.range.start, period.range.end);
  const [by, setBy] = useState<"day" | "week" | "month">("day");
  const grouping = span < 7 && by !== "day" ? "day" : by;

  const c = computePnl(sumRows(cur.data ?? []));
  const p = computePnl(sumRows(prev.data ?? []));
  const has = !!prev.data;
  const ch = (a: number, b: number) => (has ? pctChange(a, b) : undefined);

  const chartRows = useMemo(() => groupRows((cur.data ?? []) as never, grouping, ["revenue", "cogs", "expenses"])
    .map((r) => { const g = (k: string) => Number(r[k]); return { day: String(r["day"]), revenue: g("revenue"), cogs: g("cogs"), expenses: g("expenses"), gross: g("revenue") - g("cogs"), net: g("revenue") - g("cogs") - g("expenses") }; }), [cur.data, grouping]);

  const lowStock = useQuery({
    queryKey: ["low-stock"],
    queryFn: async () => ((await supabase.from("products").select("id,name,stock_qty,low_stock_threshold,unit").eq("active", true)).data ?? [])
      .filter((x) => x.unit !== "serving" && Number(x.stock_qty) <= Number(x.low_stock_threshold)).sort((a, b) => Number(a.stock_qty) - Number(b.stock_qty)),
  });
  const openShifts = useQuery({
    queryKey: ["open-shifts-count"],
    queryFn: async () => (await supabase.from("cashier_shifts").select("id", { count: "exact", head: true }).eq("status", "open")).count ?? 0,
  });

  // Business health: plain statements computed from real data only
  const signals: { tone: "good" | "bad" | "warn"; text: string }[] = [];
  if (has && p.revenue > 0) {
    const s = pctChange(c.revenue, p.revenue)!;
    signals.push({ tone: s >= 0 ? "good" : "bad", text: `Sales ${s >= 0 ? "increased" : "decreased"} ${Math.abs(s).toFixed(0)}% compared with the previous period.` });
    if (p.net !== 0) {
      const n = pctChange(c.net, p.net)!;
      if (n < 0 && s > 0) signals.push({ tone: "warn", text: `Net profit decreased ${Math.abs(n).toFixed(0)}% despite higher sales.` });
    }
  }
  for (const e of curExp.data ?? []) {
    const before = prevExp.data?.find((x) => x.category === e.category)?.total ?? 0;
    const d = pctChange(e.total, before);
    if (before > 0 && d !== null && d >= 20) signals.push({ tone: "warn", text: `${e.category} expenses increased ${d.toFixed(0)}%.` });
  }
  if (lowStock.data?.length) signals.push({ tone: "warn", text: `${lowStock.data.length} product${lowStock.data.length > 1 ? "s are" : " is"} at or below reorder level.` });

  return (
    <AppShell area="dashboard" title="Dashboard">
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight lg:text-3xl">{greeting()}, {me?.fullName.split(" ")[0]}</h2>
            <p className="mt-1 text-muted-foreground">Here's how your club is performing · <span className="text-foreground/80">{fmtRange(period.range)}</span></p>
          </div>
          <PeriodPicker period={period} />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Total sales" value={ksh(c.revenue)} change={ch(c.revenue, p.revenue)} />
          <KpiCard label="Cost of goods" value={ksh(c.cogs)} change={ch(c.cogs, p.cogs)} invert />
          <KpiCard label="Gross profit" value={ksh(c.gross)} change={ch(c.gross, p.gross)} />
          <KpiCard label="Operating expenses" value={ksh(c.expenses)} change={ch(c.expenses, p.expenses)} invert />
          <KpiCard label="Net profit" value={ksh(c.net)} change={ch(c.net, p.net)} />
          <KpiCard label="Profit margin" value={`${c.netMargin.toFixed(1)}%`} change={has ? c.netMargin - p.netMargin : undefined} sub="pts vs previous" />
        </div>

        <div className="surface-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ToggleGroup type="single" value={metric} onValueChange={(v) => v && setMetric(v as Metric)} className="rounded-lg bg-secondary p-1">
              {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => <ToggleGroupItem key={m} value={m} className="h-7 px-3 text-xs data-[state=on]:bg-background">{METRIC_LABEL[m]}</ToggleGroupItem>)}
            </ToggleGroup>
            <ToggleGroup type="single" value={grouping} onValueChange={(v) => v && setBy(v as never)} className="rounded-lg bg-secondary p-1">
              {(["day", "week", "month"] as const).map((g) => <ToggleGroupItem key={g} value={g} className="h-7 px-3 text-xs capitalize data-[state=on]:bg-background">{g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly"}</ToggleGroupItem>)}
            </ToggleGroup>
          </div>
          <div className="mt-5"><FinanceChart rows={chartRows} metric={metric} by={grouping} /></div>
        </div>

        <div className="flex flex-wrap gap-2">
          <QA to="/pos" icon={ShoppingCart} label="Open POS" />
          <QA to="/expenses" icon={Wallet} label="Add expense" />
          <QA to="/inventory" icon={Boxes} label="Record stock" />
          <QA to="/pnl" icon={TrendingUp} label="Profit & Loss" />
          <QA to="/shifts" icon={Clock} label="Review shifts" />
          {me?.roles.includes("owner") && <QA to="/staff" icon={Users} label="Manage staff" />}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="surface-card p-5">
            <div className="flex items-center gap-2 font-semibold"><Activity className="size-4 text-primary" />Business health</div>
            <div className="mt-4 space-y-2.5">
              {signals.length ? signals.map((s, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${s.tone === "good" ? "bg-success" : s.tone === "bad" ? "bg-destructive" : "bg-warning"}`} />
                  {s.text}
                </div>
              )) : <p className="text-sm text-muted-foreground">Not enough activity yet to compare periods. Signals appear as sales and expenses are recorded.</p>}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{openShifts.data ? `${openShifts.data} cashier shift(s) open right now.` : "No shifts open right now."}</p>
          </div>
          <div className="surface-card p-5">
            <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-warning" />Low stock</div>
            <div className="mt-3 space-y-2">
              {lowStock.data?.length ? lowStock.data.slice(0, 6).map((x) => (
                <div key={x.id} className="flex justify-between text-sm"><span>{x.name}</span><span className={Number(x.stock_qty) <= 0 ? "text-destructive tabular" : "text-warning tabular"}>{Number(x.stock_qty)} left</span></div>
              )) : <p className="text-sm text-muted-foreground">Everything is above its reorder level.</p>}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function QA({ to, icon: Icon, label }: { to: "/pos" | "/inventory" | "/shifts" | "/staff" | "/expenses" | "/pnl"; icon: typeof Boxes; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
      <Icon className="size-4 text-primary" />{label}
    </Link>
  );
}
