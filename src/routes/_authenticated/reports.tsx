import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PeriodPicker, usePeriod } from "@/components/period-picker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { REPORTS, loadReport, exportExcel, type ReportKey } from "@/lib/reports";
import { fmtRange } from "@/lib/periods";
import { ksh } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Blooms Members Club" }, { name: "description", content: "Club reports with Excel export." }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const period = usePeriod("month");
  const [key, setKey] = useState<ReportKey>("pnl");
  const [busy, setBusy] = useState(false);
  const r = period.range;
  const q = useQuery({ queryKey: ["report", key, r.start, r.end], queryFn: () => loadReport(key, r) });
  const meta = REPORTS.find((x) => x.key === key)!;
  const rows = q.data ?? [];
  const cols = rows[0] ? Object.keys(rows[0]) : [];

  async function exportAll() {
    setBusy(true);
    try {
      const sheets = await Promise.all(REPORTS.map(async (x) => ({ key: x.key, name: x.label, rows: await loadReport(x.key, r) })));
      await exportExcel(sheets, `blooms-members-club-reports-${r.start}-to-${r.end}.xlsx`, { title: "Business Report", period: `${r.start} to ${r.end}` });
    } catch { toast.error("Could not build the export. Please try again."); }
    setBusy(false);
  }

  return (
    <AppShell area="reports" title="Reports" actions={<PeriodPicker period={period} />}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><div className="eyebrow">Reports center</div><h2 className="mt-1 text-2xl font-semibold tracking-tight">{fmtRange(r)}</h2></div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!rows.length} onClick={() => exportExcel([{ key, name: meta.label, rows }], `blooms-members-club-${key}-${r.start}-to-${r.end}.xlsx`, { period: `${r.start} to ${r.end}` })}><Download className="size-4" />This report</Button>
          <Button onClick={exportAll} disabled={busy}><FileSpreadsheet className="size-4" />{busy ? "Preparing…" : "Export all to Excel"}</Button>
        </div>
      </div>
      <div className="mb-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {REPORTS.map((x) => (
          <button key={x.key} onClick={() => setKey(x.key)} className={cn("surface-card p-3 text-left transition-colors", key === x.key && "ring-2 ring-primary")}>
            <div className="text-sm font-medium">{x.label}</div><div className="mt-0.5 text-xs text-muted-foreground">{x.desc}</div>
          </button>
        ))}
      </div>
      <div className="surface-card overflow-x-auto">
        {q.isLoading ? <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />)}</div>
          : q.isError ? <div className="p-6 text-sm text-destructive">This report couldn't load.</div>
          : !rows.length ? <div className="p-6 text-sm text-muted-foreground">No data in this period.</div>
          : (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground">{cols.map((c) => <th key={c} className="whitespace-nowrap px-4 py-3 font-medium">{c.replace(" (KSh)", "")}</th>)}</tr></thead>
              <tbody>{rows.slice(0, 300).map((row, i) => (
                <tr key={i} className="border-b last:border-0">{cols.map((c) => <td key={c} className={cn("whitespace-nowrap px-4 py-2.5", typeof row[c] === "number" && "tabular text-right")}>{c.includes("KSh") ? ksh(row[c] as number) : row[c] ?? "—"}</td>)}</tr>
              ))}</tbody>
            </table>
          )}
        {rows.length > 300 && <div className="border-t p-3 text-xs text-muted-foreground">Showing the first 300 of {rows.length} rows. The Excel export has all of them.</div>}
      </div>
    </AppShell>
  );
}
