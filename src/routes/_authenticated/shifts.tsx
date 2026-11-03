import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState, StatCard } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useMe } from "@/hooks/use-me";
import { ksh, fmtDateTime, friendlyError } from "@/lib/format";
import { openShiftQuery, StartShift } from "@/components/start-shift";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/shifts")({
  head: () => ({ meta: [{ title: "Shifts — Club254" }, { name: "description", content: "Open, close and review cashier shifts." }] }),
  component: ShiftsPage,
});

function ShiftsPage() {
  const { data: me } = useMe();
  const isAdmin = !!me?.roles.some((r) => r === "owner" || r === "manager");
  const open = useQuery(openShiftQuery(me?.id));

  return (
    <AppShell area="shifts" title="Shifts">
      <div className="mx-auto max-w-5xl space-y-8">
        {open.data ? <CloseShift shift={open.data} /> : !open.isLoading && me?.roles.includes("cashier") ? <StartShift /> : null}
        <History isAdmin={isAdmin} uid={me?.id} />
      </div>
    </AppShell>
  );
}

function CloseShift({ shift }: { shift: { id: string; opening_cash: number; opened_at: string } }) {
  const qc = useQueryClient();
  const [declared, setDeclared] = useState("");
  const [reason, setReason] = useState("");
  const sales = useQuery({
    queryKey: ["my-sales", shift.id],
    queryFn: async () => (await supabase.from("sales").select("total,payment_method").eq("shift_id", shift.id)).data ?? [],
  });
  const cash = (sales.data ?? []).filter((s) => s.payment_method === "cash").reduce((a, s) => a + Number(s.total), 0);
  const all = (sales.data ?? []).reduce((a, s) => a + Number(s.total), 0);
  const expected = Number(shift.opening_cash) + cash;
  const diff = declared === "" ? null : Number(declared) - expected;

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("close_shift", { _declared: Number(declared), _reason: reason });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Shift closed"); qc.invalidateQueries(); },
    onError: (e) => toast.error(friendlyError(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div><div className="eyebrow">Current shift</div><h2 className="mt-1 text-xl font-semibold">Open since {fmtDateTime(shift.opened_at)}</h2></div>
        <Badge className="bg-success/15 text-success">Open</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Opening cash" value={ksh(shift.opening_cash)} />
        <StatCard label="Cash sales" value={ksh(cash)} />
        <StatCard label="All sales" value={ksh(all)} hint={`${sales.data?.length ?? 0} transactions`} />
        <StatCard label="Expected cash" value={ksh(expected)} />
      </div>
      <div className="surface-card grid gap-4 p-6 md:grid-cols-[1fr_1fr]">
        <div>
          <div className="font-medium">Close shift</div>
          <p className="text-sm text-muted-foreground">Count the drawer and enter the total cash.</p>
          <Input inputMode="numeric" className="mt-4 h-12 text-lg tabular" placeholder="Declared cash" value={declared} onChange={(e) => setDeclared(e.target.value.replace(/[^\d.]/g, ""))} />
          {diff !== null && (
            <div className={cn("mt-3 text-sm tabular", diff === 0 ? "text-success" : "text-destructive")}>
              Difference: {diff > 0 ? "+" : ""}{ksh(diff)}
            </div>
          )}
        </div>
        <div>
          {diff !== null && diff !== 0 && (
            <>
              <label className="text-sm">Reason for difference (required)</label>
              <Textarea className="mt-1.5" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. change given incorrectly" />
            </>
          )}
          <Button variant="gold" size="lg" className="mt-4 w-full" disabled={declared === "" || (diff !== 0 && !reason.trim()) || m.isPending} onClick={() => m.mutate()}>
            {m.isPending && <Loader2 className="animate-spin" />}Close shift
          </Button>
        </div>
      </div>
    </div>
  );
}

function History({ isAdmin, uid }: { isAdmin: boolean; uid?: string | undefined }) {
  const shifts = useQuery({
    queryKey: ["shifts", isAdmin, uid],
    enabled: !!uid,
    queryFn: async () => {
      let q = supabase.from("cashier_shifts").select("*").order("opened_at", { ascending: false }).limit(50);
      if (!isAdmin) q = q.eq("cashier_id", uid!);
      const { data } = await q;
      const ids = [...new Set((data ?? []).map((s) => s.cashier_id))];
      const { data: people } = isAdmin && ids.length ? await supabase.from("profiles").select("id,full_name").in("id", ids) : { data: [] };
      return (data ?? []).map((s) => ({ ...s, name: people?.find((p) => p.id === s.cashier_id)?.full_name ?? "You" }));
    },
  });
  return (
    <div>
      <h3 className="mb-3 font-semibold">{isAdmin ? "All shifts" : "Your shift history"}</h3>
      <div className="surface-card overflow-x-auto">
        {shifts.data?.length ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">{isAdmin && <th className="p-3 font-medium">Cashier</th>}<th className="p-3 font-medium">Opened</th><th className="p-3 font-medium">Closed</th><th className="p-3 text-right font-medium">Expected</th><th className="p-3 text-right font-medium">Declared</th><th className="p-3 text-right font-medium">Difference</th></tr>
            </thead>
            <tbody>
              {shifts.data.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  {isAdmin && <td className="p-3">{s.name}</td>}
                  <td className="p-3 whitespace-nowrap">{fmtDateTime(s.opened_at)}</td>
                  <td className="p-3 whitespace-nowrap">{s.closed_at ? fmtDateTime(s.closed_at) : <Badge className="bg-success/15 text-success">Open</Badge>}</td>
                  <td className="p-3 text-right tabular">{s.expected_cash != null ? ksh(s.expected_cash) : "—"}</td>
                  <td className="p-3 text-right tabular">{s.declared_cash != null ? ksh(s.declared_cash) : "—"}</td>
                  <td className={cn("p-3 text-right tabular", Number(s.difference) < 0 && "text-destructive", Number(s.difference) > 0 && "text-warning")} title={s.discrepancy_reason ?? ""}>
                    {s.difference != null ? ksh(s.difference) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={Clock} title="No shifts yet" body="Shifts will appear here once a cashier starts one." />}
      </div>
    </div>
  );
}
