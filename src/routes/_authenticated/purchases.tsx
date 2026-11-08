import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Truck, ScanText, Loader2 } from "lucide-react";
import { useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { extractInvoice, type InvoiceDraft } from "@/lib/invoice.functions";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState, StatCard } from "@/components/app-shell";
import { PeriodPicker, usePeriod } from "@/components/period-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ksh, friendlyError } from "@/lib/format";
import { todayNairobi } from "@/lib/periods";

export const Route = createFileRoute("/_authenticated/purchases")({
  head: () => ({ meta: [{ title: "Purchases & Suppliers — Blooms Members Club" }, { name: "description", content: "Record supplier deliveries and track what you owe." }] }),
  component: PurchasesPage,
});

function PurchasesPage() {
  const period = usePeriod("month");
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const extract = useServerFn(extractInvoice);
  const onFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("File is too large (max 8 MB)."); return; }
    setScanning(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const res = await extract({ data: { fileBase64: btoa(bin), mimeType: file.type, fileName: file.name } });
      if (res.error || !res.draft) toast.error(res.error ?? "Couldn't read this invoice.");
      else { setDraft(res.draft); setAdding(true); toast.success("Invoice read — please review before saving"); }
    } catch (e) { toast.error(friendlyError(e)); }
    finally { setScanning(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data ?? [] });
  const list = useQuery({
    queryKey: ["purchases", period.range.start, period.range.end],
    queryFn: async () => (await supabase.from("purchases").select("*, purchase_items(quantity, product_id)").gte("purchase_date", period.range.start).lte("purchase_date", period.range.end).order("purchase_date", { ascending: false }).order("created_at", { ascending: false })).data ?? [],
  });
  const togglePaid = useMutation({
    mutationFn: async (v: { id: string; paid: boolean }) => { const { error } = await supabase.rpc("set_purchase_paid", { _id: v.id, _paid: v.paid }); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchases"] }),
    onError: (e) => toast.error(friendlyError(e)),
  });
  const rows = list.data ?? [];
  const total = rows.reduce((a, p) => a + Number(p.total), 0);
  const unpaid = rows.filter((p) => !p.paid).reduce((a, p) => a + Number(p.total), 0);
  const supName = (id: string) => suppliers.data?.find((s) => s.id === id)?.name ?? "";

  return (
    <AppShell area="purchases" title="Purchases" actions={<>
      <Button size="sm" variant="outline" onClick={() => setAddingSupplier(true)}><Truck />Supplier</Button>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={scanning || !suppliers.data?.length}>{scanning ? <Loader2 className="animate-spin" /> : <ScanText />}{scanning ? "Reading…" : "Scan invoice"}</Button>
      <Button size="sm" variant="gold" onClick={() => { setDraft(null); setAdding(true); }} disabled={!suppliers.data?.length}><Plus />Record delivery</Button>
    </>}>
      <div className="space-y-6">
        <PeriodPicker period={period} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard label="Purchases" value={ksh(total)} hint={`${rows.length} deliveries`} />
          <StatCard label="Unpaid to suppliers" value={ksh(unpaid)} />
          <StatCard label="Suppliers" value={String(suppliers.data?.length ?? 0)} />
        </div>
        <div className="surface-card overflow-x-auto">
          {rows.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="p-3 font-medium">Date</th><th className="p-3 font-medium">Supplier</th><th className="p-3 font-medium">Invoice</th><th className="p-3 font-medium">Items</th><th className="p-3 text-right font-medium">Total</th><th className="p-3 font-medium">Status</th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="p-3 whitespace-nowrap">{p.purchase_date}</td>
                    <td className="p-3">{supName(p.supplier_id)}</td>
                    <td className="p-3 text-muted-foreground">{p.invoice_no ?? "—"}</td>
                    <td className="p-3">{p.purchase_items?.length ?? 0}</td>
                    <td className="p-3 text-right tabular-nums">{ksh(Number(p.total))}</td>
                    <td className="p-3">
                      <button onClick={() => togglePaid.mutate({ id: p.id, paid: !p.paid })} title="Click to change">
                        <Badge variant={p.paid ? "secondary" : "destructive"}>{p.paid ? "Paid" : "Unpaid"}</Badge>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState icon={Truck} title="No deliveries in this period" body={suppliers.data?.length ? "Record a delivery to add stock and update buying prices." : "Add your first supplier to get started."} />}
        </div>
        {!!suppliers.data?.length && (
          <div className="surface-card p-4">
            <div className="eyebrow mb-3">Suppliers</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {suppliers.data.map((s) => {
                const owed = rows.filter((p) => p.supplier_id === s.id && !p.paid).reduce((a, p) => a + Number(p.total), 0);
                return (
                  <div key={s.id} className="rounded-lg border p-3 text-sm">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{[s.contact, s.phone].filter(Boolean).join(" · ") || "No contact details"}</div>
                    {owed > 0 && <div className="mt-1 text-xs text-destructive">Unpaid this period: {ksh(owed)}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <SupplierDialog open={addingSupplier} onClose={() => setAddingSupplier(false)} />
      {adding && <PurchaseDialog suppliers={suppliers.data ?? []} draft={draft} onClose={() => { setAdding(false); setDraft(null); }} />}
    </AppShell>
  );
}

function SupplierDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", contact: "", phone: "" });
  const save = useMutation({
    mutationFn: async () => {
      if (!f.name.trim()) throw new Error("Enter a supplier name");
      const { error } = await supabase.from("suppliers").insert({ name: f.name.trim(), contact: f.contact || null, phone: f.phone || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supplier added"); qc.invalidateQueries({ queryKey: ["suppliers"] }); setF({ name: "", contact: "", phone: "" }); onClose(); },
    onError: (e) => toast.error(friendlyError(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New supplier</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. EABL Distributor" /></div>
          <div><Label>Contact person</Label><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="gold" onClick={() => save.mutate()} disabled={save.isPending}>Save supplier</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Line = { product_id: string; quantity: string; unit_cost: string; note?: string };

function matchSupplier(suppliers: { id: string; name: string }[], name: string | null) {
  if (!name) return undefined;
  const n = name.toLowerCase();
  return suppliers.find((s) => n.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(n))?.id;
}

function PurchaseDialog({ suppliers, draft, onClose }: { suppliers: { id: string; name: string }[]; draft: InvoiceDraft | null; onClose: () => void }) {
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ["products-lite"], queryFn: async () => (await supabase.from("products").select("id,name").eq("active", true).order("name")).data ?? [] });
  const [supplier, setSupplier] = useState(matchSupplier(suppliers, draft?.supplier_name ?? null) ?? suppliers[0]?.id ?? "");
  const [invoice, setInvoice] = useState(draft?.invoice_number ?? "");
  const [date, setDate] = useState(draft?.invoice_date && /^\d{4}-\d{2}-\d{2}$/.test(draft.invoice_date) ? draft.invoice_date : todayNairobi());
  const [paid, setPaid] = useState(false);
  const [lines, setLines] = useState<Line[]>(() =>
    draft?.lines.length
      ? draft.lines.map((l) => ({ product_id: l.product_id ?? "", quantity: String(l.quantity || ""), unit_cost: String(l.unit_cost || ""), note: l.description }))
      : [{ product_id: "", quantity: "", unit_cost: "" }],
  );
  const total = lines.reduce((a, l) => a + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0);
  const upd = (i: number, p: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const save = useMutation({
    mutationFn: async () => {
      const items = lines.filter((l) => l.product_id).map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity), unit_cost: Number(l.unit_cost) }));
      if (!items.length) throw new Error("Add at least one product");
      if (items.some((i) => !(i.quantity > 0) || !(i.unit_cost >= 0))) throw new Error("Each line needs a quantity and a buying price");
      const { error } = await supabase.rpc("record_purchase", { _supplier: supplier, _invoice: invoice, _date: date, _paid: paid, _items: items });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Delivery recorded and stock updated"); qc.invalidateQueries(); onClose(); },
    onError: (e) => toast.error(friendlyError(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{draft ? "Review scanned invoice" : "Record delivery"}</DialogTitle></DialogHeader>
        {draft && (
          <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-xs text-muted-foreground">
            Filled in from the invoice{draft.supplier_name ? ` (${draft.supplier_name})` : ""}. Check every line — unmatched products are left blank and nothing is saved until you press Save.
            {draft.total != null && <> Invoice total: <span className="font-semibold text-foreground">{ksh(draft.total)}</span>.</>}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label>Supplier</Label>
            <Select value={supplier} onValueChange={setSupplier}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label>Invoice no.</Label><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} /></div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_110px_auto] items-end gap-2">
              <div>{i === 0 && <Label>Product</Label>}
                <Select value={l.product_id} onValueChange={(v) => upd(i, { product_id: v })}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{products.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div>{i === 0 && <Label>Qty</Label>}<Input inputMode="decimal" value={l.quantity} onChange={(e) => upd(i, { quantity: e.target.value })} /></div>
              <div>{i === 0 && <Label>Cost each</Label>}<Input inputMode="decimal" value={l.unit_cost} onChange={(e) => upd(i, { unit_cost: e.target.value })} /></div>
              <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1}><Trash2 /></Button>
              {l.note && <p className={`col-span-4 -mt-1 text-xs ${l.product_id ? "text-muted-foreground" : "text-destructive"}`}>Invoice: {l.note}{!l.product_id && " — choose a product or remove"}</p>}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setLines([...lines, { product_id: "", quantity: "", unit_cost: "" }])}><Plus />Add line</Button>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />Already paid</label>
        <DialogFooter className="items-center">
          <div className="mr-auto text-sm">Total <span className="font-semibold tabular-nums">{ksh(total)}</span></div>
          <Button variant="gold" onClick={() => save.mutate()} disabled={save.isPending || !supplier}>Save delivery</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
