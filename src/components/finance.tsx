import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ksh } from "@/lib/format";
import { cn } from "@/lib/utils";

export function KpiCard({ label, value, change, invert, sub }: { label: string; value: string; change: number | null | undefined; invert?: boolean; sub?: string }) {
  const good = change == null ? null : invert ? change <= 0 : change >= 0;
  const Icon = change == null || change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="surface-card p-5">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 text-xl xl:text-[1.35rem] 2xl:text-[1.6rem] font-semibold leading-tight whitespace-nowrap tracking-tight tabular">{value}</div>
      <div className="mt-2 flex items-center gap-1.5 text-xs">
        {change === undefined ? <span className="h-4" /> : change === null ? (
          <span className="text-muted-foreground">No prior data</span>
        ) : (
          <>
            <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular",
              good ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive")}>
              <Icon className="size-3" />{Math.abs(change).toFixed(1)}%
            </span>
            <span className="text-muted-foreground">{sub ?? "vs previous period"}</span>
          </>
        )}
      </div>
    </div>
  );
}

export type ChartRow = { day: string; revenue: number; cogs: number; expenses: number; gross: number; net: number };
export type Metric = "revenue" | "gross" | "expenses" | "net";
export const METRIC_LABEL: Record<Metric, string> = { revenue: "Sales", gross: "Gross Profit", expenses: "Expenses", net: "Net Profit" };

const label = (d: string, by: string) => {
  const date = new Date(`${d}T00:00:00Z`);
  return by === "month"
    ? new Intl.DateTimeFormat("en-KE", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date)
    : new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
};

export function FinanceChart({ rows, metric, by }: { rows: ChartRow[]; metric: Metric; by: "day" | "week" | "month" }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={rows} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="day" tickFormatter={(d) => label(d, by)} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
          <Tooltip cursor={{ stroke: "var(--border)" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const r = payload[0]!.payload as ChartRow;
            return (
              <div className="rounded-lg border bg-popover p-3 text-xs shadow-xl">
                <div className="mb-1.5 font-medium">{label(r.day, by)}{by === "week" ? " (week)" : ""}</div>
                {([["Sales", r.revenue], ["COGS", r.cogs], ["Expenses", r.expenses], ["Gross profit", r.gross], ["Net profit", r.net]] as const).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-6"><span className="text-muted-foreground">{k}</span><span className="tabular">{ksh(v)}</span></div>
                ))}
              </div>
            );
          }} />
          <Area type="monotone" dataKey={metric} stroke="var(--chart-1)" strokeWidth={2} fill="url(#fill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
