import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Minus, Plus, Trash2, Banknote, Smartphone, CreditCard, CircleEllipsis, CheckCircle2, Printer, Loader2, ShoppingCart, ScanBarcode, Beer, Wine, GlassWater, Zap, Martini, Droplets, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { queueSale, isNetworkError, cached } from "@/lib/offline-sales";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMe } from "@/hooks/use-me";
import { openShiftQuery, StartShift } from "@/components/start-shift";
import { ksh, fmtTime, fmtDateTime, friendlyError } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({ meta: [{ title: "POS — Club254" }, { name: "description", content: "Ring up sales at the bar." }] }),
  component: PosPage,
});

type Product = { id: string; name: string; sku: string; barcode: string | null; selling_price: number; stock_qty: number; low_stock_threshold: number; category_id: string | null; image_url: string | null };
type Line = { product: Product; qty: number };
type Pay = "cash" | "mpesa" | "card" | "other";

const CAT_ICON: Record<string, typeof Beer> = { Beer, Spirits: Martini, Wine, "Soft Drinks": GlassWater, "Energy Drinks": Zap, Water: Droplets, Cocktails: Martini };
const PAY: { k: Pay; l: string; i: typeof Banknote }[] = [
  { k: "cash", l: "Cash", i: Banknote }, { k: "mpesa", l: "M-Pesa", i: Smartphone },
  { k: "card", l: "Card", i: CreditCard }, { k: "other", l: "Other", i: CircleEllipsis },
];

function PosPage() {
  const { data: me } = useMe();
  const shift = useQuery(openShiftQuery(me?.id));
  return (
    <AppShell area="pos" title="Point of Sale" bare
      actions={shift.data && <Link to="/shifts" className="hidden text-xs text-muted-foreground sm:block">Shift open since {fmtTime(shift.data.opened_at)}</Link>}>
      {shift.isLoading ? null : shift.data ? <Register shiftId={shift.data.id} cashierName={me?.fullName ?? ""} /> : <StartShift />}
    </AppShell>
  );
}

function Register({ shiftId, cashierName }: { shiftId: string; cashierName: string }) {
  const qc = useQueryClient();
  const [cat, setCat] = useState<string | "all">("all");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("");
  const [pay, setPay] = useState<Pay>("cash");
  const [mobileCart, setMobileCart] = useState(false);
  const [receipt, setReceipt] = useState<null | { receipt_no: string; total: number; created_at: string; lines: Line[]; discount: number; subtotal: number; pay: Pay }>(null);
  const clientRef = useRef<string>(crypto.randomUUID());

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: () => cached("clubos-pos-cats", async () => {
      const { data, error } = await supabase.from("product_categories").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    }),
  });
  const products = useQuery({
    queryKey: ["pos-products"],
    queryFn: () => cached("clubos-pos-products", async () => {
      const { data, error } = await supabase.from("products").select("id,name,sku,barcode,selling_price,stock_qty,low_stock_threshold,category_id,image_url").eq("active", true).order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    }),
  });
  const catName = (id: string | null) => cats.data?.find((c) => c.id === id)?.name ?? "";

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (products.data ?? []).filter((p) => (cat === "all" || p.category_id === cat) &&
      (!s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.barcode === s));
  }, [products.data, cat, q]);

  function add(p: Product) {
    setCart((c) => {
      const ex = c.find((l) => l.product.id === p.id);
      const next = (ex?.qty ?? 0) + 1;
      if (next > Number(p.stock_qty)) { toast.warning(`Only ${p.stock_qty} ${p.name} left`); return c; }
      return ex ? c.map((l) => (l.product.id === p.id ? { ...l, qty: next } : l)) : [...c, { product: p, qty: 1 }];
    });
  }
  function setQty(id: string, qty: number) {
    setCart((c) => c.flatMap((l) => (l.product.id !== id ? [l] : qty <= 0 ? [] : [{ ...l, qty: Math.min(qty, Number(l.product.stock_qty)) }])));
  }
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const hit = (products.data ?? []).find((p) => p.barcode === q.trim() || p.sku.toLowerCase() === q.trim().toLowerCase());
    if (hit) { add(hit); setQ(""); }
  }

  const subtotal = cart.reduce((s, l) => s + l.qty * Number(l.product.selling_price), 0);
  const disc = Math.min(Number(discount || 0), subtotal);
  const total = subtotal - disc;

  const checkout = useMutation({
    mutationFn: async () => {
      const args = { _client_ref: clientRef.current, _items: cart.map((l) => ({ product_id: l.product.id, quantity: l.qty })), _discount: disc, _payment: pay };
      const offline = () => {
        queueSale({ client_ref: args._client_ref, items: args._items, discount: disc, payment: pay, total });
        toast.info("Saved offline — it will upload when you're back online.");
        return { receipt_no: "OFFLINE (pending)", total, created_at: new Date().toISOString() };
      };
      if (!navigator.onLine) return offline();
      try {
        const { data, error } = await supabase.rpc("complete_sale", args);
        if (error) { if (isNetworkError(error)) return offline(); throw error; }
        return data as { receipt_no: string; total: number; created_at: string };
      } catch (e) { if (isNetworkError(e)) return offline(); throw e; }
    },
    onSuccess: (r) => {
      setReceipt({ ...r, lines: cart, discount: disc, subtotal, pay });
      setCart([]); setDiscount(""); setMobileCart(false);
      clientRef.current = crypto.randomUUID();
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["my-sales"] });
    },
    onError: (e) => { toast.error(friendlyError(e, "Unable to complete sale. Please try again.")); qc.invalidateQueries({ queryKey: ["pos-products"] }); },
  });

  const cartPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="font-semibold">Current order</div>
        {cart.length > 0 && <Button variant="ghost" size="sm" onClick={() => setCart([])}>Clear</Button>}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {cart.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="No items yet" body="Tap a product to add it to the order." />
        ) : cart.map((l) => (
          <div key={l.product.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-accent/50">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{l.product.name}</div>
              <div className="text-xs text-muted-foreground tabular">{ksh(l.product.selling_price)} each</div>
            </div>
            <div className="flex items-center rounded-lg border">
              <button className="grid size-8 place-items-center" onClick={() => setQty(l.product.id, l.qty - 1)} aria-label="Decrease"><Minus className="size-3.5" /></button>
              <span className="w-7 text-center text-sm tabular">{l.qty}</span>
              <button className="grid size-8 place-items-center" onClick={() => setQty(l.product.id, l.qty + 1)} aria-label="Increase"><Plus className="size-3.5" /></button>
            </div>
            <div className="w-20 text-right text-sm font-medium tabular">{ksh(l.qty * Number(l.product.selling_price))}</div>
            <button onClick={() => setQty(l.product.id, 0)} className="text-muted-foreground hover:text-destructive" aria-label="Remove"><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t p-5">
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="tabular">{ksh(subtotal)}</span></div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Discount</span>
          <Input inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d]/g, ""))} placeholder="0" className="h-8 w-28 text-right tabular" />
        </div>
        <div className="flex items-baseline justify-between pt-1"><span className="font-medium">Total</span><span className="text-2xl font-semibold tabular">{ksh(total)}</span></div>
        <div className="grid grid-cols-4 gap-1.5">
          {PAY.map((p) => (
            <button key={p.k} onClick={() => setPay(p.k)}
              className={cn("flex flex-col items-center gap-1 rounded-lg border py-2 text-[11px] transition-colors",
                pay === p.k ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent")}>
              <p.i className="size-4" />{p.l}
            </button>
          ))}
        </div>
        <Button variant="gold" size="xl" className="w-full" disabled={!cart.length || checkout.isPending} onClick={() => checkout.mutate()}>
          {checkout.isPending ? <Loader2 className="animate-spin" /> : null}Charge {ksh(total)}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:h-[calc(100vh-3.5rem)] lg:grid-cols-[180px_1fr_380px]">
      {/* categories */}
      <div className="flex gap-1.5 overflow-x-auto border-b px-4 py-3 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-3 lg:py-5">
        <CatBtn active={cat === "all"} onClick={() => setCat("all")} icon={Package} label="All" />
        {cats.data?.map((c) => <CatBtn key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} icon={CAT_ICON[c.name] ?? Package} label={c.name} />)}
      </div>
      {/* grid */}
      <div className="min-w-0 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey} placeholder="Search, or scan a barcode and press Enter" className="h-11 pl-9 pr-10" />
          <ScanBarcode className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => {
            const out = Number(p.stock_qty) <= 0;
            const low = !out && Number(p.stock_qty) <= Number(p.low_stock_threshold);
            const Icon = CAT_ICON[catName(p.category_id)] ?? Package;
            const inCart = cart.find((l) => l.product.id === p.id)?.qty;
            return (
              <button key={p.id} disabled={out} onClick={() => add(p)}
                className={cn("surface-card group relative flex flex-col p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 active:scale-[0.98] disabled:opacity-40 disabled:hover:translate-y-0",
                  inCart && "border-primary/60")}>
                <div className="grid aspect-[4/3] place-items-center rounded-lg bg-secondary">
                  {p.image_url ? <img src={p.image_url} alt="" className="size-full rounded-lg object-cover" loading="lazy" /> : <Icon className="size-8 text-muted-foreground/60" />}
                </div>
                <div className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight">{p.name}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-semibold tabular">{ksh(p.selling_price)}</span>
                  <span className={cn("text-[11px]", out ? "text-destructive" : low ? "text-warning" : "text-muted-foreground")}>
                    {out ? "Out" : low ? `${Number(p.stock_qty)} left` : "In stock"}
                  </span>
                </div>
                {inCart && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{inCart}</span>}
              </button>
            );
          })}
        </div>
        {!products.isLoading && visible.length === 0 && <EmptyState icon={Search} title="No matching products" body="Try another search or category." />}
      </div>
      {/* cart desktop */}
      <div className="hidden border-l bg-surface lg:block">{cartPanel}</div>

      {/* mobile sticky checkout */}
      <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 px-4 pb-3 lg:hidden">
        <Button variant="gold" size="xl" className="w-full justify-between" onClick={() => setMobileCart(true)}>
          <span className="flex items-center gap-2"><ShoppingCart />{cart.reduce((s, l) => s + l.qty, 0)} items</span>
          <span className="tabular">{ksh(total)}</span>
        </Button>
      </div>
      <Sheet open={mobileCart} onOpenChange={setMobileCart}>
        <SheetContent side="bottom" className="h-[88vh] rounded-t-2xl p-0">
          <SheetTitle className="sr-only">Current order</SheetTitle>
          {cartPanel}
        </SheetContent>
      </Sheet>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="sr-only">Sale completed</DialogTitle>
          {receipt && (
            <div>
              <div className="no-print text-center">
                <CheckCircle2 className="mx-auto size-12 text-success" />
                <div className="mt-3 text-lg font-semibold">Sale completed</div>
                <div className="mt-1 text-3xl font-semibold tabular">{ksh(receipt.total)}</div>
              </div>
              <Receipt r={receipt} cashier={cashierName} shiftId={shiftId} />
              <div className="no-print mt-4 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => window.print()}><Printer />Print</Button>
                <Button variant="gold" onClick={() => setReceipt(null)}>New sale</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Receipt({ r, cashier }: { r: { receipt_no: string; created_at: string; lines: Line[]; discount: number; subtotal: number; total: number; pay: Pay }; cashier: string; shiftId: string }) {
  return (
    <div className="mt-5 rounded-lg border border-dashed p-4 font-mono text-xs">
      <div className="text-center"><div className="font-semibold">Club254</div><div className="text-muted-foreground">Thank you for your visit</div></div>
      <div className="mt-3 flex justify-between"><span>Receipt</span><span>#{r.receipt_no}</span></div>
      <div className="flex justify-between"><span>Date</span><span>{fmtDateTime(r.created_at)}</span></div>
      <div className="flex justify-between"><span>Cashier</span><span>{cashier}</span></div>
      <div className="my-2 border-t border-dashed" />
      {r.lines.map((l) => (
        <div key={l.product.id} className="flex justify-between gap-2"><span className="truncate">{l.qty} × {l.product.name}</span><span>{ksh(l.qty * Number(l.product.selling_price))}</span></div>
      ))}
      <div className="my-2 border-t border-dashed" />
      <div className="flex justify-between"><span>Subtotal</span><span>{ksh(r.subtotal)}</span></div>
      {r.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{ksh(r.discount)}</span></div>}
      <div className="flex justify-between font-semibold"><span>Total</span><span>{ksh(r.total)}</span></div>
      <div className="flex justify-between"><span>Paid by</span><span>{PAY.find((p) => p.k === r.pay)?.l}</span></div>
    </div>
  );
}

function CatBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Beer; label: string }) {
  return (
    <button onClick={onClick}
      className={cn("flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
        active ? "bg-primary/12 text-primary bg-accent font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
      <Icon className="size-4" />{label}
    </button>
  );
}
