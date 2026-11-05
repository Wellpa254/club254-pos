import { supabase } from "@/integrations/supabase/client";
import { addDays, type Range } from "@/lib/periods";

export type Row = Record<string, string | number | null>;
export type ReportKey = "pnl" | "sales" | "products" | "expenses" | "stock" | "purchases";

export const REPORTS: { key: ReportKey; label: string; desc: string }[] = [
  { key: "pnl", label: "Daily profit & loss", desc: "Revenue, cost of goods, expenses and profit per day" },
  { key: "sales", label: "Sales", desc: "Every completed sale with cashier and payment" },
  { key: "products", label: "Top products", desc: "Quantity and revenue per product" },
  { key: "expenses", label: "Expenses", desc: "All expenses, including voided ones" },
  { key: "stock", label: "Stock levels", desc: "Current stock, value and low-stock items" },
  { key: "purchases", label: "Purchases", desc: "Supplier deliveries and payment status" },
];

const from = (r: Range) => `${r.start}T00:00:00+03:00`;
const to = (r: Range) => `${addDays(r.end, 1)}T00:00:00+03:00`;
const local = (d: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", dateStyle: "short", timeStyle: "short", hourCycle: "h23" }).format(new Date(d));

/** Group sale lines into per-product totals, highest revenue first. */
export function topProducts(items: { product_name: string; quantity: number; subtotal: number }[]): Row[] {
  const m = new Map<string, { qty: number; rev: number }>();
  for (const i of items) {
    const e = m.get(i.product_name) ?? { qty: 0, rev: 0 };
    e.qty += Number(i.quantity); e.rev += Number(i.subtotal);
    m.set(i.product_name, e);
  }
  return [...m.entries()].sort((a, b) => b[1].rev - a[1].rev).map(([name, e]) => ({ Product: name, "Qty sold": e.qty, "Revenue (KSh)": e.rev }));
}

async function names() {
  const { data } = await supabase.from("profiles").select("id, full_name, email");
  return new Map((data ?? []).map((p) => [p.id, p.full_name || p.email]));
}

export async function loadReport(key: ReportKey, r: Range): Promise<Row[]> {
  if (key === "pnl") {
    const { data, error } = await supabase.rpc("pnl_daily", { _start: r.start, _end: r.end });
    if (error) throw error;
    return (data ?? []).map((d) => {
      const rev = Number(d.revenue), cogs = Number(d.cogs), exp = Number(d.expenses);
      return { Date: d.day, Sales: Number(d.transactions), "Revenue (KSh)": rev, "COGS (KSh)": cogs, "Gross profit (KSh)": rev - cogs, "Expenses (KSh)": exp, "Net profit (KSh)": rev - cogs - exp };
    });
  }
  if (key === "sales") {
    const [{ data, error }, who] = await Promise.all([
      supabase.from("sales").select("receipt_no, created_at, cashier_id, subtotal, discount, total, payment_method, cash_received, status").gte("created_at", from(r)).lt("created_at", to(r)).order("created_at"),
      names(),
    ]);
    if (error) throw error;
    return (data ?? []).map((s) => ({ Receipt: s.receipt_no, Time: local(s.created_at), Cashier: who.get(s.cashier_id) ?? "", Payment: s.payment_method, "Subtotal (KSh)": Number(s.subtotal), "Discount (KSh)": Number(s.discount), "Total (KSh)": Number(s.total), "Cash received (KSh)": s.cash_received == null ? "" : Number(s.cash_received), "Change (KSh)": s.cash_received == null ? "" : Number(s.cash_received) - Number(s.total), Status: s.status }));
  }
  if (key === "products") {
    const { data, error } = await supabase.from("sale_items").select("product_name, quantity, subtotal, sales!inner(created_at, status)").gte("sales.created_at", from(r)).lt("sales.created_at", to(r)).eq("sales.status", "completed");
    if (error) throw error;
    return topProducts((data ?? []) as never);
  }
  if (key === "expenses") {
    const { data, error } = await supabase.from("expenses").select("expense_date, amount, description, payment_method, reference, voided_at, void_reason, expense_categories(name)").gte("expense_date", r.start).lte("expense_date", r.end).order("expense_date");
    if (error) throw error;
    return (data ?? []).map((e) => ({ Date: e.expense_date, Category: e.expense_categories?.name ?? "", Description: e.description, Payment: e.payment_method, Reference: e.reference, "Amount (KSh)": Number(e.amount), Status: e.voided_at ? `Voided: ${e.void_reason ?? ""}` : "Active" }));
  }
  if (key === "stock") {
    const [{ data, error }, costs] = await Promise.all([
      supabase.from("products").select("id, name, sku, unit, stock_qty, low_stock_threshold, selling_price, active, product_categories(name)").order("name"),
      supabase.from("product_costs").select("product_id, avg_cost"),
    ]);
    if (error) throw error;
    const c = new Map((costs.data ?? []).map((x) => [x.product_id, Number(x.avg_cost)]));
    return (data ?? []).filter((p) => p.active).map((p) => {
      const qty = Number(p.stock_qty), avg = c.get(p.id) ?? 0;
      return { Product: p.name, SKU: p.sku, Category: p.product_categories?.name ?? "", Unit: p.unit, "In stock": qty, "Avg cost (KSh)": avg, "Stock value (KSh)": qty * avg, "Selling price (KSh)": Number(p.selling_price), Low: qty <= Number(p.low_stock_threshold) ? "Yes" : "" };
    });
  }
  const { data, error } = await supabase.from("purchases").select("purchase_date, invoice_no, total, paid, suppliers(name)").gte("purchase_date", r.start).lte("purchase_date", r.end).order("purchase_date");
  if (error) throw error;
  return (data ?? []).map((p) => ({ Date: p.purchase_date, Supplier: p.suppliers?.name ?? "", Invoice: p.invoice_no, "Total (KSh)": Number(p.total), Paid: p.paid ? "Yes" : "No" }));
}

export async function exportExcel(sheets: { name: string; rows: Row[]; key?: string }[], filename: string, opts?: { title?: string; period?: string }) {
  const { buildWorkbook } = await import("@/lib/excel-export");
  const generated = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", dateStyle: "medium", timeStyle: "short" }).format(new Date());
  const bytes = await buildWorkbook(sheets, { title: opts?.title ?? (sheets.length === 1 ? sheets[0]!.name : "Business Report"), period: opts?.period ?? "", generated });
  const blob = new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
