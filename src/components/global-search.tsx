import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Package, User, Clock, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { canAccess } from "@/lib/roles";
import { fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const REPORTS = ["Daily profit & loss", "Sales", "Top products", "Expenses", "Stock levels", "Supplier deliveries"];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: me } = useMe();
  const roles = me?.roles ?? [];
  const canStaff = canAccess(roles, "staff");
  const canShifts = canAccess(roles, "shifts");
  const canReports = canAccess(roles, "reports");
  const productPage = canAccess(roles, "inventory") ? "/inventory" : canAccess(roles, "pos") ? "/pos" : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const data = useQuery({
    queryKey: ["global-search", roles.join(",")],
    enabled: open && !!me,
    queryFn: async () => {
      const [p, s, sh] = await Promise.all([
        productPage ? supabase.from("products").select("id,name,sku,brand").eq("active", true).order("name") : Promise.resolve({ data: [] }),
        canStaff || canShifts ? supabase.from("profiles").select("id,full_name,email") : Promise.resolve({ data: [] }),
        canShifts ? supabase.from("cashier_shifts").select("id,cashier_id,opened_at,status").order("opened_at", { ascending: false }).limit(60) : Promise.resolve({ data: [] }),
      ]);
      const people = (s.data ?? []) as { id: string; full_name: string; email: string }[];
      return {
        products: (p.data ?? []) as { id: string; name: string; sku: string; brand: string | null }[],
        staff: canStaff ? people : [],
        shifts: ((sh.data ?? []) as { id: string; cashier_id: string; opened_at: string; status: string }[]).map((x) => ({
          ...x, name: people.find((u) => u.id === x.cashier_id)?.full_name || "Cashier",
        })),
      };
    },
  });

  function go(to: string) { setOpen(false); navigate({ to }); }

  return (
    <>
      <Button variant="outline" size="sm" className="hidden w-56 justify-start text-muted-foreground md:flex" onClick={() => setOpen(true)}>
        <Search />Search…<kbd className="ml-auto text-[10px] opacity-70">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Search"><Search /></Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search products, staff, shifts, reports…" />
        <CommandList>
          <CommandEmpty>{data.isLoading ? "Loading…" : "Nothing found."}</CommandEmpty>
          {productPage && !!data.data?.products.length && (
            <CommandGroup heading="Products">
              {data.data.products.map((x) => (
                <CommandItem key={x.id} value={`product ${x.name} ${x.sku} ${x.brand ?? ""}`} onSelect={() => go(productPage)}>
                  <Package />{x.name}<span className="ml-auto text-xs text-muted-foreground">{x.sku}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {!!data.data?.staff.length && (
            <CommandGroup heading="Staff">
              {data.data.staff.map((x) => (
                <CommandItem key={x.id} value={`staff ${x.full_name} ${x.email}`} onSelect={() => go("/staff")}>
                  <User />{x.full_name || x.email}<span className="ml-auto text-xs text-muted-foreground">{x.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {!!data.data?.shifts.length && (
            <CommandGroup heading="Shifts">
              {data.data.shifts.map((x) => (
                <CommandItem key={x.id} value={`shift ${x.name} ${fmtDateTime(x.opened_at)} ${x.status} ${x.id}`} onSelect={() => go("/shifts")}>
                  <Clock />{x.name}<span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(x.opened_at)} · {x.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {canReports && (
            <CommandGroup heading="Reports">
              {REPORTS.map((r) => (
                <CommandItem key={r} value={`report ${r}`} onSelect={() => go("/reports")}>
                  <FileSpreadsheet />{r} report
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
