import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PeriodPicker, usePeriod } from "@/components/period-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { addDays } from "@/lib/periods";
import { exportExcel } from "@/lib/reports";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Audit log — Club254" }, { name: "description", content: "Who changed what, and when." }] }),
  component: AuditPage,
});

const short = (v: unknown) => (v == null ? "" : JSON.stringify(v).slice(0, 160));

function AuditPage() {
  const period = usePeriod("week");
  const r = period.range;
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["audit", r.start, r.end],
    queryFn: async () => {
      const [{ data, error }, ppl] = await Promise.all([
        supabase.from("audit_logs").select("*").gte("created_at", `${r.start}T00:00:00+03:00`).lt("created_at", `${addDays(r.end, 1)}T00:00:00+03:00`).order("created_at", { ascending: false }).limit(1000),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      if (error) throw error;
      const who = new Map((ppl.data ?? []).map((p) => [p.id, p.full_name || p.email]));
      return (data ?? []).map((a) => ({ ...a, who: a.user_id ? who.get(a.user_id) ?? "Unknown" : "System" }));
    },
  });
  const s = search.toLowerCase();
  const rows = (q.data ?? []).filter((a) => !s || `${a.action} ${a.object_type} ${a.who} ${short(a.new_value)}`.toLowerCase().includes(s));

  return (
    <AppShell area="audit" title="Audit log" actions={<PeriodPicker period={period} />}>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Search action, person or details" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Button variant="outline" disabled={!rows.length} onClick={() => exportExcel([{ name: "Audit log", rows: rows.map((a) => ({ Time: fmtDateTime(a.created_at), Who: a.who, Action: a.action, Object: a.object_type, "Object ID": a.object_id, Before: short(a.previous_value), After: short(a.new_value) })) }], `club254-audit-${r.start}-to-${r.end}.xlsx`, { period: `${r.start} to ${r.end}` })}><Download className="size-4" />Export</Button>
      </div>
      <div className="surface-card divide-y">
        {q.isLoading ? <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          : !rows.length ? <div className="p-6 text-sm text-muted-foreground">No activity recorded in this period.</div>
          : rows.map((a) => (
            <details key={a.id} className="px-4 py-3">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                <span><span className="font-medium">{a.action.replace(/_/g, " ")}</span>{a.object_type && <span className="text-muted-foreground"> · {a.object_type}</span>}</span>
                <span className="text-xs text-muted-foreground">{a.who} · {fmtDateTime(a.created_at)}</span>
              </summary>
              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                <pre className="overflow-auto rounded bg-secondary/50 p-2"><div className="mb-1 text-muted-foreground">Before</div>{a.previous_value ? JSON.stringify(a.previous_value, null, 2) : "—"}</pre>
                <pre className="overflow-auto rounded bg-secondary/50 p-2"><div className="mb-1 text-muted-foreground">After</div>{a.new_value ? JSON.stringify(a.new_value, null, 2) : "—"}</pre>
              </div>
            </details>
          ))}
      </div>
    </AppShell>
  );
}
