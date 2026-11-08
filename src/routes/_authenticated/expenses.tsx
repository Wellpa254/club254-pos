import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Wallet, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState, StatCard } from "@/components/app-shell";
import { PeriodPicker, usePeriod } from "@/components/period-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMe } from "@/hooks/use-me";
import { ksh, friendlyError } from "@/lib/format";
import { todayNairobi } from "@/lib/periods";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses — Blooms Members Club" }, { name: "description", content: "Record and review operating expenses." }] }),
  component: ExpensesPage,
});

const PAY = [["cash", "Cash"], ["mpesa", "M-Pesa"], ["card", "Card"], ["bank", "Bank transfer"], ["other", "Other"]] as const;

function ExpensesPage() {
  const { data: me } = useMe();
  const period = usePeriod("month");
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState<string | null>(null);
  const cats = useQuery({ queryKey: ["expense-cats"], queryFn: async () => (await supabase.from("expense_categories").select("*").order("sort_order")).data ?? [] });
  const list = useQuery({
    queryKey: ["expenses", period.range.start, period.range.end],
    queryFn: async () => (await supabase.from("expenses").select("*").gte("expense_date", period.range.start).lte("expense_date", period.range.end).order("expense_date", { ascending: false }).order("created_at", { ascending: false })).data ?? [],
  });
  const live = (list.data ?? []).filter((e) => !e.voided_at);
  const total = live.reduce((a, e) => a + Number(e.amount), 0);
  const byCat = new Map<string, number>();
  live.forEach((e) => byCat.set(e.category_id, (byCat.get(e.category_id) ?? 0) + Number(e.amount)));
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
  const catName = (id: string) => cats.data?.find((c) => c.id === id)?.name ?? "";

  return (
    <AppShell area="expenses" title="Expenses" actions={<Button size="sm" variant="gold" onClick={() => setAdding(true)}><Plus />Add expense</Button>}>
      <div className="space-y-6">
        <PeriodPicker period={period} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard label="Total expenses" value={ksh(total)} hint={`${live.length} entries`} />
          <StatCard label="Largest category" value={top ? catName(top[0]) : "—"} hint={top ? ksh(top[1]) : undefined} />
          <StatCard label="Average entry" value={ksh(live.length ? total / live.length : 0)} />
        </div>
        <div className="surface-card overflow-x-auto">
          {list.data?.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="p-3 font-medium">Date</th><th className="p-3 font-medium">Category</th><th className="p-3 font-medium">Description</th><th className="p-3 font-medium">Paid by</th><th className="p-3 text-right font-medium">Amount</th><th className="p-3" /></tr></thead>
              <tbody>
                {list.data.map((e) => (
                  <tr key={e.id} className={cn("border-b last:border-0", e.voided_at && "opacity-50")}>
                    <td className="p-3 whitespace-nowrap">{e.expense_date}</td>
                    <td className="p-3">{catName(e.category_id)}</td>
                    <td className="p-3">{e.description}{e.reference && <span className="ml-1 text-xs text-muted-foreground">· {e.reference}</span>}{e.voided_at && <Badge variant="secondary" className="ml-2" title={e.void_reason ?? ""}>Voided</Badge>}</td>
                    <td className="p-3 text-muted-foreground">{PAY.find((p) => p[0] === e.payment_method)?.[1]}</td>
                    <td className={cn("p-3 text-right tabular", e.voided_at && "line-through")}>{ksh(e.amount)}</td>
                    <td className="p-3 text-right">{me?.roles.includes("owner") && !e.voided_at && <Button size="sm" variant="ghost" onClick={() => setVoiding(e.id)} aria-label="Void"><Ban /></Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState icon={Wallet} title="No expenses in this period" body="Record rent, power, security and other running costs to see true net profit." />}
        </div>
      </div>
      {adding && <AddExpense cats={cats.data ?? []} onClose={() => setAdding(false)} />}
      {voiding && <VoidExpense id={voiding} onClose={() => setVoiding(null)} />}
    </AppShell>
  );
}

function AddExpense({ cats, onClose }: { cats: { id: string; name: string }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ category_id: cats[0]?.id ?? "", amount: "", expense_date: todayNairobi(), description: "", payment_method: "cash", reference: "" });
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expenses").insert({ ...f, amount: Number(f.amount), reference: f.reference || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Expense recorded"); qc.invalidateQueries(); onClose(); },
    onError: (e) => toast.error(friendlyError(e, "Couldn't save the expense.")),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add expense</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Category</Label>
            <Select value={f.category_id} onValueChange={(v) => setF({ ...f, category_id: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>Amount (KSh)</Label><Input inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} /></div>
          <div className="space-y-1.5"><Label>Date</Label><Input type="date" max={todayNairobi()} value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Paid by</Label>
            <Select value={f.payment_method} onValueChange={(v) => setF({ ...f, payment_method: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAY.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="col-span-2 space-y-1.5"><Label>Description</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. October rent" /></div>
          <div className="col-span-2 space-y-1.5"><Label>Reference (optional)</Label><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="Receipt or M-Pesa code" /></div>
        </div>
        <p className="text-xs text-muted-foreground">Expenses can't be edited once saved. The owner can void an entry with a reason.</p>
        <DialogFooter><Button variant="gold" disabled={!(Number(f.amount) > 0) || !f.category_id || m.isPending} onClick={() => m.mutate()}>Save expense</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VoidExpense({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc("void_expense", { _id: id, _reason: reason }); if (error) throw error; },
    onSuccess: () => { toast.success("Expense voided"); qc.invalidateQueries(); onClose(); },
    onError: (e) => toast.error(friendlyError(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Void this expense?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">It stays in the history but no longer counts toward profit.</p>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" />
        <DialogFooter><Button variant="destructive" disabled={!reason.trim() || m.isPending} onClick={() => m.mutate()}>Void expense</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
