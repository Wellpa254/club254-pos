import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, PackagePlus, SlidersHorizontal, Search, Boxes, Trash2, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState, StatCard } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ksh, fmtDateTime, friendlyError } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Club254" }, { name: "description", content: "Stock levels, valuation and movements." }] }),
  component: InventoryPage,
});

type Row = { id: string; name: string; sku: string; brand: string | null; category_id: string | null; selling_price: number; stock_qty: number; low_stock_threshold: number; unit: string; active: boolean; avg_cost: number };

function useInventory() {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const [{ data: p }, { data: c }, { data: cats }] = await Promise.all([
        supabase.from("products").select("*").order("name"),
        supabase.from("product_costs").select("product_id,avg_cost"),
        supabase.from("product_categories").select("*").order("sort_order"),
      ]);
      const rows: Row[] = (p ?? []).map((x) => ({ ...x, avg_cost: Number(c?.find((k) => k.product_id === x.id)?.avg_cost ?? 0) }));
      return { rows, cats: cats ?? [] };
    },
  });
}

function status(r: Row) {
  const q = Number(r.stock_qty);
  if (q <= 0) return { l: "Out of stock", c: "bg-destructive/15 text-destructive" };
  if (q <= Number(r.low_stock_threshold)) return { l: "Low stock", c: "bg-warning/15 text-warning" };
  return { l: "In stock", c: "bg-success/15 text-success" };
}

function InventoryPage() {
  const inv = useInventory();
  const [q, setQ] = useState("");
  const [receive, setReceive] = useState<Row | null>(null);
  const [adjust, setAdjust] = useState<Row | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const rows = inv.data?.rows ?? [];
  const stocked = rows.filter((r) => r.unit !== "serving");
  const value = stocked.reduce((s, r) => s + Math.max(0, Number(r.stock_qty)) * r.avg_cost, 0);
  const low = stocked.filter((r) => Number(r.stock_qty) > 0 && Number(r.stock_qty) <= Number(r.low_stock_threshold));
  const out = stocked.filter((r) => Number(r.stock_qty) <= 0);
  const shown = useMemo(() => rows.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.sku.toLowerCase().includes(q.toLowerCase())), [rows, q]);

  return (
    <AppShell area="inventory" title="Inventory" actions={<Button size="sm" variant="gold" onClick={() => setAdding(true)}><Plus />Add product</Button>}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Products" value={rows.length} hint={`${stocked.reduce((s, r) => s + Math.max(0, Number(r.stock_qty)), 0)} units on hand`} />
          <StatCard label="Inventory value" value={ksh(value)} hint="Weighted-average cost" />
          <StatCard label="Low stock" value={low.length} tone={low.length ? "warn" : undefined} hint={low.slice(0, 2).map((r) => r.name).join(", ") || "All good"} />
          <StatCard label="Out of stock" value={out.length} tone={out.length ? "bad" : undefined} />
        </div>

        <Tabs defaultValue="stock">
          <TabsList><TabsTrigger value="stock">Stock</TabsTrigger><TabsTrigger value="moves">Movements</TabsTrigger></TabsList>
          <TabsContent value="stock" className="mt-4 space-y-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="pl-9" />
            </div>
            <div className="surface-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b"><th className="p-3 font-medium">Product</th><th className="p-3 font-medium">Status</th><th className="p-3 text-right font-medium">On hand</th><th className="p-3 text-right font-medium">Avg cost</th><th className="p-3 text-right font-medium">Price</th><th className="p-3 text-right font-medium">Margin</th><th className="p-3" /></tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const s = status(r);
                    const margin = Number(r.selling_price) > 0 ? ((Number(r.selling_price) - r.avg_cost) / Number(r.selling_price)) * 100 : 0;
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="p-3"><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.sku} · {inv.data?.cats.find((c) => c.id === r.category_id)?.name}</div></td>
                        <td className="p-3"><Badge className={s.c}>{s.l}</Badge></td>
                        <td className="p-3 text-right tabular">{Number(r.stock_qty)} <span className="text-xs text-muted-foreground">/ min {Number(r.low_stock_threshold)}</span></td>
                        <td className="p-3 text-right tabular">{ksh(r.avg_cost)}</td>
                        <td className="p-3 text-right tabular">{ksh(r.selling_price)}</td>
                        <td className={cn("p-3 text-right tabular", margin < 25 && "text-warning")}>{margin.toFixed(0)}%</td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <PhotoButton row={r} />
                          <Button size="sm" variant="ghost" onClick={() => setReceive(r)}><PackagePlus />Receive</Button>
                          <Button size="sm" variant="ghost" onClick={() => setAdjust(r)} aria-label="Adjust"><SlidersHorizontal /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setDel(r)} aria-label="Delete" className="text-destructive hover:text-destructive"><Trash2 /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!inv.isLoading && shown.length === 0 && <EmptyState icon={Boxes} title="No products" body="Add your first product to start tracking stock." />}
            </div>
          </TabsContent>
          <TabsContent value="moves" className="mt-4"><Movements rows={rows} /></TabsContent>
        </Tabs>
      </div>
      {receive && <ReceiveDialog row={receive} onClose={() => setReceive(null)} />}
      {adjust && <AdjustDialog row={adjust} onClose={() => setAdjust(null)} />}
      {del && <DeleteDialog row={del} onClose={() => setDel(null)} />}
      {adding && <AddProductDialog cats={inv.data?.cats ?? []} onClose={() => setAdding(false)} />}
    </AppShell>
  );
}

function Movements({ rows }: { rows: Row[] }) {
  const m = useQuery({
    queryKey: ["movements"],
    queryFn: async () => (await supabase.from("inventory_movements").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  return (
    <div className="surface-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="p-3 font-medium">When</th><th className="p-3 font-medium">Product</th><th className="p-3 font-medium">Type</th><th className="p-3 text-right font-medium">Qty</th><th className="p-3 text-right font-medium">Unit cost</th><th className="p-3 font-medium">Ref / note</th></tr></thead>
        <tbody>
          {m.data?.map((x) => (
            <tr key={x.id} className="border-b last:border-0">
              <td className="p-3 whitespace-nowrap">{fmtDateTime(x.created_at)}</td>
              <td className="p-3">{rows.find((r) => r.id === x.product_id)?.name}</td>
              <td className="p-3 capitalize">{x.movement_type}</td>
              <td className={cn("p-3 text-right tabular", Number(x.quantity) < 0 ? "text-destructive" : "text-success")}>{Number(x.quantity) > 0 ? "+" : ""}{Number(x.quantity)}</td>
              <td className="p-3 text-right tabular">{x.unit_cost != null ? ksh(x.unit_cost) : "—"}</td>
              <td className="p-3 text-muted-foreground">{x.reference ?? x.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, 500 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("resize"))), "image/jpeg", 0.85));
}

function PhotoButton({ row }: { row: Row & { image_url?: string | null } }) {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const m = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith("image/")) throw new Error("Please choose a photo.");
      const path = `${row.id}/${Date.now()}.jpg`;
      const up = await supabase.storage.from("product-images").upload(path, await shrink(file), { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const sig = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sig.error) throw sig.error;
      const { error } = await supabase.from("products").update({ image_url: sig.data.signedUrl }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Photo updated"); qc.invalidateQueries(); },
    onError: (e) => toast.error(e instanceof Error && e.message.startsWith("Please") ? e.message : friendlyError(e)),
  });
  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) m.mutate(f); }} />
      <Button size="sm" variant="ghost" disabled={m.isPending} onClick={() => ref.current?.click()} aria-label="Upload photo" title="Upload photo">
        {row.image_url ? <img src={row.image_url} alt="" className="size-5 rounded object-cover" /> : <ImagePlus />}
      </Button>
    </>
  );
}

function useDone(onClose: () => void, msg: string) {
  const qc = useQueryClient();
  return () => { toast.success(msg); qc.invalidateQueries(); onClose(); };
}

function ReceiveDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState(String(row.avg_cost || ""));
  const [ref, setRef] = useState("");
  const done = useDone(onClose, "Stock received");
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("receive_stock", { _product: row.id, _qty: Number(qty), _unit_cost: Number(cost), _reference: ref || null as never });
      if (error) throw error;
    },
    onSuccess: done, onError: (e) => toast.error(friendlyError(e)),
  });
  const newAvg = Number(qty) > 0 ? ((Math.max(0, Number(row.stock_qty)) * row.avg_cost + Number(qty) * Number(cost)) / (Math.max(0, Number(row.stock_qty)) + Number(qty))) : row.avg_cost;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Receive stock · {row.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Quantity</Label><Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Unit cost (KSh)</Label><Input inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
          <div className="col-span-2 space-y-1.5"><Label>Invoice / reference</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} /></div>
        </div>
        <div className="rounded-lg bg-secondary p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Total cost</span><span className="tabular">{ksh(Number(qty) * Number(cost))}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">New average cost</span><span className="tabular">{ksh(newAvg)}</span></div>
        </div>
        <DialogFooter><Button variant="gold" disabled={!(Number(qty) > 0) || m.isPending} onClick={() => m.mutate()}>Receive {qty || 0} units</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const [qty, setQty] = useState("");
  const [type, setType] = useState("loss");
  const [note, setNote] = useState("");
  const done = useDone(onClose, "Stock adjusted");
  const signed = type === "loss" ? -Math.abs(Number(qty)) : type === "return" ? Math.abs(Number(qty)) : Number(qty);
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("adjust_stock", { _product: row.id, _qty_change: signed, _type: type, _note: note });
      if (error) throw error;
    },
    onSuccess: done, onError: (e) => toast.error(friendlyError(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adjust stock · {row.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Type</Label>
            <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="loss">Loss / breakage</SelectItem><SelectItem value="return">Return to stock</SelectItem><SelectItem value="adjustment">Count correction (±)</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Quantity</Label><Input value={qty} onChange={(e) => setQty(e.target.value)} placeholder={type === "adjustment" ? "e.g. -2" : "e.g. 2"} /></div>
          <div className="col-span-2 space-y-1.5"><Label>Note (required)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <p className="text-sm text-muted-foreground">On hand will go from {Number(row.stock_qty)} to {Number(row.stock_qty) + (signed || 0)}.</p>
        <DialogFooter><Button variant="gold" disabled={!signed || !note.trim() || m.isPending} onClick={() => m.mutate()}>Save adjustment</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const [blocked, setBlocked] = useState(false);
  const done = useDone(onClose, "Product deleted");
  const doneOff = useDone(onClose, "Product deactivated");
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_product", { _product: row.id });
      if (error) throw error;
    },
    onSuccess: done,
    onError: (e) => {
      const raw = (e as { message?: string })?.message ?? "";
      if (raw.toLowerCase().includes("history")) setBlocked(true);
      else toast.error(friendlyError(e));
    },
  });
  const off = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").update({ active: false }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: doneOff, onError: (e) => toast.error(friendlyError(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete {row.name}?</DialogTitle></DialogHeader>
        {blocked ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{row.name}</span> has sales, purchases or stock history, so it can't be deleted — old records would lose their item. You can deactivate it instead: it disappears from the till and stock lists, but its history stays intact.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Keep it</Button>
              <Button variant="gold" disabled={off.isPending} onClick={() => off.mutate()}>Deactivate instead</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This permanently removes <span className="font-medium text-foreground">{row.name}</span> ({row.sku}) from inventory. Only items that have never been sold, purchased or moved can be deleted.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="destructive" disabled={m.isPending} onClick={() => m.mutate()}>Delete permanently</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddProductDialog({ cats, onClose }: { cats: { id: string; name: string }[]; onClose: () => void }) {
  const [f, setF] = useState({ name: "", sku: "", barcode: "", brand: "", category_id: cats[0]?.id ?? "", selling_price: "", low_stock_threshold: "10", unit: "bottle" });
  const done = useDone(onClose, "Product added");
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").insert({
        name: f.name.trim(), sku: f.sku.trim().toUpperCase(), barcode: f.barcode.trim() || null, brand: f.brand.trim() || null,
        category_id: f.category_id || null, selling_price: Number(f.selling_price), low_stock_threshold: Number(f.low_stock_threshold), unit: f.unit,
      });
      if (error) throw error;
    },
    onSuccess: done,
    onError: (e) => toast.error((e as { message?: string }).message?.includes("duplicate") ? "That SKU or barcode is already used." : friendlyError(e)),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add product</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label>Name</Label><Input value={f.name} onChange={set("name")} /></div>
          <div className="space-y-1.5"><Label>SKU</Label><Input value={f.sku} onChange={set("sku")} /></div>
          <div className="space-y-1.5"><Label>Barcode</Label><Input value={f.barcode} onChange={set("barcode")} /></div>
          <div className="space-y-1.5"><Label>Category</Label>
            <Select value={f.category_id} onValueChange={(v) => setF({ ...f, category_id: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>Brand</Label><Input value={f.brand} onChange={set("brand")} /></div>
          <div className="space-y-1.5"><Label>Selling price (KSh)</Label><Input inputMode="numeric" value={f.selling_price} onChange={set("selling_price")} /></div>
          <div className="space-y-1.5"><Label>Low-stock alert at</Label><Input inputMode="numeric" value={f.low_stock_threshold} onChange={set("low_stock_threshold")} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Starts at 0 units. Use “Receive” to add stock with its buying cost.</p>
        <DialogFooter><Button variant="gold" disabled={!f.name || !f.sku || !(Number(f.selling_price) > 0) || m.isPending} onClick={() => m.mutate()}>Add product</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
