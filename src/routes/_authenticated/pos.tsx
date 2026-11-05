import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Minus, Plus, Trash2, Banknote, Smartphone, CreditCard, CircleEllipsis, CheckCircle2, Printer, Loader2, ShoppingCart, ScanBarcode, Beer, Wine, GlassWater, Zap, Martini, Droplets, Package, Clock, Utensils } from "lucide-react";
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
import { cashChange, quickCashAmounts } from "@/lib/cash";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({ meta: [{ title: "POS — Club254" }, { name: "description", content: "Ring up sales at the bar." }] }),
  component: PosPage,
});

type Product = { id: string; name: string; sku: string; barcode: string | null; selling_price: number; stock_qty: number; low_stock_threshold: number; category_id: string | null; image_url: string | null };
type Line = { product: Product; qty: number };
type Pay = "cash" | "mpesa" | "card" | "other";

const CAT_ICON: Record<string, typeof Beer> = { Beer, Spirits: Martini, Wine, "Soft Drinks": GlassWater, "Energy Drinks": Zap, Water: Droplets, Cocktails: Martini, "Food items": Utensils };
const CAT_TINT: Record<string, { chip: string; icon: string }> = {
  Beer: { chip: "from-amber-400/25 to-amber-600/10", icon: "text-amber-500" },
  Spirits: { chip: "from-violet-400/25 to-violet-600/10", icon: "text-violet-400" },
  Wine: { chip: "from-rose-400/25 to-rose-600/10", icon: "text-rose-400" },
  "Soft Drinks": { chip: "from-sky-400/25 to-sky-600/10", icon: "text-sky-400" },
  "Energy Drinks": { chip: "from-lime-400/25 to-lime-600/10", icon: "text-lime-500" },
  Water: { chip: "from-cyan-400/25 to-cyan-600/10", icon: "text-cyan-400" },
  Cocktails: { chip: "from-fuchsia-400/25 to-fuchsia-600/10", icon: "text-fuchsia-400" },
  "Food items": { chip: "from-orange-400/25 to-orange-600/10", icon: "text-orange-400" },
};
const NEUTRAL_TINT = { chip: "from-zinc-400/20 to-zinc-600/10", icon: "text-muted-foreground" };
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
      {shift.isLoading ? null : shift.data ? <Register shiftId={shift.data.id} openedAt={shift.data.opened_at} cashierName={me?.fullName ?? ""} /> : <StartShift />}
    </AppShell>
  );
}

function Register({ shiftId, openedAt, cashierName }: { shiftId: string; openedAt: string; cashierName: string }) {
  const qc = useQueryClient();
  const [cat, setCat] = useState<string | "all">("all");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("");
  const [pay, setPay] = useState<Pay>("cash");
  const [mobileCart, setMobileCart] = useState(false);
  const [cashIn, setCashIn] = useState("");
  const [receipt, setReceipt] = useState<null | { receipt_no: string; total: number; created_at: string; lines: Line[]; discount: number; subtotal: number; pay: Pay; received?: number | undefined; change?: number | undefined }>(null);
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
  // Cash tendered is optional. When entered, it must cover the total, and the change is shown for the customer.
  const cashing = pay === "cash" && cashIn !== "";
  const received = Number(cashIn || 0);
  const { change, short } = cashChange(total, received);
  const cashShort = cashing && short > 0;

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
      setReceipt({ ...r, lines: cart, discount: disc, subtotal, pay, ...(cashing ? { received, change } : {}) });
      setCart([]); setDiscount(""); setCashIn(""); setMobileCart(false);
      clientRef.current = crypto.randomUUID();
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["my-sales"] });
    },
    onError: (e) => { toast.error(friendlyError(e, "Unable to complete sale. Please try again.")); qc.invalidateQueries({ queryKey: ["pos-products"] }); },
  });

  const itemCount = cart.reduce((s, l) => s + l.qty, 0);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products.data ?? []) if (p.category_id) m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1);
    return m;
  }, [products.data]);
  const shownCats = (cats.data ?? []).filter((c) => (counts.get(c.id) ?? 0) > 0);
  // Closing the sheet when the order empties keeps the phone view from showing a big blank panel.
  useEffect(() => { if (cart.length === 0) { setMobileCart(false); setCashIn(""); } }, [cart.length]);
  const buzz = () => { try { navigator.vibrate?.(8); } catch { /* not supported */ } };
  const searchBox = (cls: string, placeholder: string) => (
    <div className="relative flex-1">
      <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey} placeholder={placeholder} enterKeyHint="search" className={cn("pl-10 pr-10", cls)} />
      <ScanBarcode className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );

  const cartPanel = (
    <div className="flex h-full max-h-[90dvh] flex-col lg:max-h-none">
      <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30 lg:hidden" />
      <div className="flex items-center justify-between gap-2 px-5 pb-1 pr-14 pt-3 lg:pr-5 lg:pt-5">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Current order</span>
          {itemCount > 0 && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary tabular">{itemCount}</span>}
        </div>
        {cart.length > 0 && <Button variant="ghost" size="sm" onClick={() => { setCart([]); setCashIn(""); }}>Clear</Button>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {cart.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="No items yet" body="Tap a product to add it to the order." />
        ) : cart.map((l) => (
          <div key={l.product.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-sm font-medium leading-tight">{l.product.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground tabular">{ksh(l.product.selling_price)} each</div>
            </div>
            <div className="flex items-center rounded-xl border bg-secondary/40">
              <button className={cn("grid size-9 place-items-center rounded-l-xl transition active:scale-90", l.qty === 1 ? "text-destructive" : "")} onClick={() => setQty(l.product.id, l.qty - 1)} aria-label={l.qty === 1 ? "Remove" : "Decrease"}>
                {l.qty === 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
              </button>
              <span className="w-7 text-center text-sm font-semibold tabular">{l.qty}</span>
              <button className="grid size-9 place-items-center rounded-r-xl transition active:scale-90" onClick={() => setQty(l.product.id, l.qty + 1)} aria-label="Increase"><Plus className="size-4" /></button>
            </div>
            <div className="min-w-[4.75rem] shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular">{ksh(l.qty * Number(l.product.selling_price))}</div>
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t bg-surface/60 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] [@media(max-height:700px)]:space-y-2 [@media(max-height:700px)]:p-4 [@media(max-height:700px)]:pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="tabular">{ksh(subtotal)}</span></div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Discount</span>
          <Input inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d]/g, ""))} placeholder="0" className="h-9 w-28 rounded-lg text-right tabular" />
        </div>
        <div className="flex items-baseline justify-between pt-1"><span className="font-medium">Total</span><span className="text-3xl font-semibold tracking-tight tabular">{ksh(total)}</span></div>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Payment method">
          {PAY.map((p) => (
            <button key={p.k} role="radio" aria-checked={pay === p.k} onClick={() => { setPay(p.k); if (p.k !== "cash") setCashIn(""); }}
              className={cn("flex h-16 flex-col items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition active:scale-95 [@media(max-height:700px)]:h-14",
                pay === p.k ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30" : "bg-card/60 text-muted-foreground hover:bg-accent")}>
              <p.i className="size-[18px]" />{p.l}
            </button>
          ))}
        </div>
        {pay === "cash" && total > 0 && (
          <div className="space-y-2">
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[total, ...quickCashAmounts(total)].map((a, i) => (
                <button key={a} type="button" onClick={() => setCashIn(String(a))}
                  className={cn("h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium tabular transition active:scale-95",
                    cashIn === String(a) ? "border-primary/50 bg-primary/15 text-primary" : "border-transparent bg-secondary/70 text-muted-foreground hover:text-foreground")}>
                  {i === 0 ? "Exact" : ksh(a)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">KSh</span>
                <Input inputMode="numeric" value={cashIn} onChange={(e) => setCashIn(e.target.value.replace(/[^\d]/g, "").slice(0, 8))} placeholder="Cash received" aria-label="Cash received" className="h-11 rounded-xl pl-12 text-right tabular" />
              </div>
              {cashing && (
                <div className={cn("flex h-11 min-w-[7.5rem] items-center justify-center rounded-xl px-3 text-sm font-semibold tabular", cashShort ? "bg-warning/15 text-warning" : "bg-success/15 text-success")} aria-live="polite">
                  {cashShort ? `Short ${ksh(short)}` : `Change ${ksh(change)}`}
                </div>
              )}
            </div>
          </div>
        )}
        <Button variant="gold" size="xl" className="h-14 w-full rounded-2xl text-base" disabled={!cart.length || checkout.isPending || cashShort} onClick={() => checkout.mutate()}>
          {checkout.isPending ? <Loader2 className="animate-spin" /> : null}Charge {ksh(total)}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:h-[calc(100vh-3.5rem)] lg:grid-cols-[180px_1fr_380px]">
      {/* categories: side rail on desktop */}
      <div className="hidden gap-1.5 overflow-y-auto border-r px-3 py-5 lg:flex lg:flex-col">
        <CatBtn active={cat === "all"} onClick={() => setCat("all")} icon={Package} label="All" />
        {shownCats.map((c) => <CatBtn key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} icon={CAT_ICON[c.name] ?? Package} label={c.name} />)}
      </div>

      {/* search, shift and categories: pinned under the header on phones */}
      <div className="sticky top-14 z-20 border-b bg-background/90 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-2 px-3 pt-3">
          {searchBox("h-11 rounded-xl", "Search or scan")}
          <Link to="/shifts" className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border bg-card px-3 text-xs font-medium tabular active:scale-95 sm:hidden" aria-label={`Shift open since ${fmtTime(openedAt)}. Tap to manage the shift.`}>
            <Clock className="size-3.5 text-primary" /><span className="text-muted-foreground">Shift</span>{fmtTime(openedAt)}
          </Link>
        </div>
        <div className="flex gap-2 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CatChip active={cat === "all"} onClick={() => setCat("all")} icon={Package} label="All" count={products.data?.length} />
          {shownCats.map((c) => <CatChip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} icon={CAT_ICON[c.name] ?? Package} label={c.name} count={counts.get(c.id)} />)}
        </div>
      </div>

      {/* grid */}
      <div className={cn("min-w-0 px-3 pt-3 lg:overflow-y-auto lg:px-6 lg:py-5", cart.length > 0 ? "pb-28" : "pb-6", "lg:pb-5")}>
        <div className="hidden lg:flex">{searchBox("h-11 rounded-xl", "Search, or scan a barcode and press Enter")}</div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:mt-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((p) => (
            <ProductTile key={p.id} p={p} catName={catName(p.category_id)} inCart={cart.find((l) => l.product.id === p.id)?.qty} onAdd={() => { buzz(); add(p); }} />
          ))}
        </div>
        {products.isLoading && <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-secondary/50" />)}</div>}
        {!products.isLoading && visible.length === 0 && <EmptyState icon={Search} title="No matching products" body="Try another search or category." />}
      </div>
      {/* cart desktop */}
      <div className="hidden border-l bg-surface lg:block">{cartPanel}</div>

      {/* mobile checkout bar: only when there is something to charge */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 px-3 pb-3 animate-in fade-in slide-in-from-bottom-3 duration-200 lg:hidden">
          <Button variant="gold" size="xl" className="h-14 w-full justify-between rounded-2xl" onClick={() => setMobileCart(true)}>
            <span className="flex items-center gap-3">
              <span className="relative grid size-9 place-items-center rounded-full bg-black/15"><ShoppingCart className="size-[18px]" />
                <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-black px-1 text-[11px] font-bold leading-5 text-white tabular">{itemCount}</span>
              </span>
              <span className="text-[15px]">View order</span>
            </span>
            <span className="text-base tabular">{ksh(total)}</span>
          </Button>
        </div>
      )}
      <Sheet open={mobileCart} onOpenChange={setMobileCart}>
        <SheetContent side="bottom" className="max-h-[92dvh] gap-0 rounded-t-3xl p-0">
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
                <div className="mx-auto grid size-16 place-items-center rounded-full bg-success/15 animate-in zoom-in-50 duration-300"><CheckCircle2 className="size-9 text-success" /></div>
                <div className="mt-3 text-lg font-semibold">Sale completed</div>
                <div className="mt-1 text-4xl font-semibold tracking-tight tabular">{ksh(receipt.total)}</div>
                {receipt.pay === "cash" && receipt.received != null && ((receipt.change ?? 0) > 0 ? (
                  <div className="mt-3 rounded-xl bg-success/10 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-success">Change due</div>
                    <div className="text-3xl font-semibold tracking-tight text-success tabular">{ksh(receipt.change ?? 0)}</div>
                    <div className="text-xs text-muted-foreground tabular">from {ksh(receipt.received)} received</div>
                  </div>
                ) : <div className="mt-2 text-sm text-muted-foreground">Exact cash received</div>)}
              </div>
              <Receipt r={receipt} cashier={cashierName} shiftId={shiftId} />
              <div className="no-print mt-4 grid grid-cols-2 gap-2">
                <Button variant="outline" size="lg" onClick={() => window.print()}><Printer />Print</Button>
                <Button variant="gold" size="lg" onClick={() => setReceipt(null)}>New sale</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductTile({ p, catName, inCart, onAdd }: { p: Product; catName: string; inCart?: number | undefined; onAdd: () => void }) {
  const stock = Number(p.stock_qty);
  const out = stock <= 0;
  const low = !out && stock <= Number(p.low_stock_threshold);
  const Icon = CAT_ICON[catName] ?? Package;
  const tint = CAT_TINT[catName] ?? NEUTRAL_TINT;
  return (
    <button type="button" disabled={out} onClick={onAdd} aria-label={`${p.name}, ${ksh(p.selling_price)}${out ? ", out of stock" : low ? `, ${stock} left` : ""}`}
      className={cn("relative flex flex-col overflow-hidden rounded-2xl border bg-card p-2 text-left shadow-sm transition duration-150 active:scale-[0.97] enabled:hover:border-primary/40 disabled:opacity-45",
        inCart && "border-primary/70 bg-primary/[0.07] ring-1 ring-primary/30")}>
      <div className={cn("relative grid place-items-center overflow-hidden rounded-xl bg-linear-to-br", p.image_url ? "h-24" : "h-14", tint.chip)}>
        {p.image_url ? <img src={p.image_url} alt="" className="size-full object-cover" loading="lazy" /> : <Icon className={cn("size-6", tint.icon)} strokeWidth={1.75} />}
        {low && <span className="absolute left-1.5 top-1.5 rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-semibold leading-none text-black">{stock} left</span>}
        {out && <span className="absolute left-1.5 top-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">Out</span>}
      </div>
      <div className="mt-2 line-clamp-2 min-h-[2.25rem] px-0.5 text-[13px] font-medium leading-tight">{p.name}</div>
      <div className="mt-1 whitespace-nowrap px-0.5 text-[15px] font-semibold tabular">{ksh(p.selling_price)}</div>
      {inCart ? <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-gold animate-in zoom-in-50 duration-150">{inCart}</span> : null}
    </button>
  );
}

function Receipt({ r, cashier }: { r: { receipt_no: string; created_at: string; lines: Line[]; discount: number; subtotal: number; total: number; pay: Pay; received?: number | undefined; change?: number | undefined }; cashier: string; shiftId: string }) {
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
      {r.pay === "cash" && r.received != null && (
        <>
          <div className="flex justify-between"><span>Cash received</span><span>{ksh(r.received)}</span></div>
          <div className="flex justify-between"><span>Change</span><span>{ksh(r.change ?? 0)}</span></div>
        </>
      )}
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

function CatChip({ active, onClick, icon: Icon, label, count }: { active: boolean; onClick: () => void; icon: typeof Beer; label: string; count?: number | undefined }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition active:scale-95",
        active ? "border-primary/50 bg-primary/15 text-primary" : "border-transparent bg-secondary/70 text-muted-foreground hover:text-foreground")}>
      <Icon className="size-3.5" />{label}
      {count != null && <span className={cn("text-[11px] tabular", active ? "text-primary/80" : "text-muted-foreground/70")}>{count}</span>}
    </button>
  );
}
