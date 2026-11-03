import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LayoutDashboard, TrendingUp, Wallet, ShoppingCart, Boxes, Clock, Users, LogOut, UserCircle, Sun, Moon, Lock, Truck, Scale, FileSpreadsheet, History, House } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { canAccess, homeFor, ROLE_LABEL, type NavKey } from "@/lib/roles";
import { Brand, BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { OfflineBar } from "@/components/offline-bar";
import { GlobalSearch } from "@/components/global-search";
import { useEffect, useState } from "react";

const NAV: { key: NavKey; to: "/dashboard" | "/pos" | "/inventory" | "/shifts" | "/shift-balance" | "/pnl" | "/expenses" | "/purchases" | "/staff" | "/reports" | "/audit"; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "pos", to: "/pos", label: "Sales", icon: ShoppingCart },
  { key: "inventory", to: "/inventory", label: "Inventory", icon: Boxes },
  { key: "shifts", to: "/shifts", label: "Shifts", icon: Clock },
  { key: "shift_balance", to: "/shift-balance", label: "Shift balance", icon: Scale },
  { key: "pnl", to: "/pnl", label: "Profit & Loss", icon: TrendingUp },
  { key: "expenses", to: "/expenses", label: "Expenses", icon: Wallet },
  { key: "purchases", to: "/purchases", label: "Purchases", icon: Truck },
  { key: "reports", to: "/reports", label: "Reports", icon: FileSpreadsheet },
  { key: "audit", to: "/audit", label: "Audit log", icon: History },
  { key: "staff", to: "/staff", label: "Staff", icon: Users },
];

function useTheme() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const v = localStorage.getItem("clubos-theme") === "light";
    setLight(v);
    document.documentElement.classList.toggle("light", v);
  }, []);
  return {
    light,
    toggle: () => {
      const v = !light;
      setLight(v);
      localStorage.setItem("clubos-theme", v ? "light" : "dark");
      document.documentElement.classList.toggle("light", v);
    },
  };
}

export function AppShell({ area, title, actions, children, bare }: {
  area?: NavKey; title?: string; actions?: ReactNode; children: ReactNode; bare?: boolean;
}) {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const theme = useTheme();
  const roles = me?.roles ?? [];
  const items = NAV.filter((n) => canAccess(roles, n.key));

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const allowed = !area || canAccess(roles, area);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-sidebar px-3 py-5 lg:flex no-print">
        <div className="px-2"><Brand /></div>
        <nav className="mt-8 flex flex-1 flex-col gap-0.5">
          {items.map((n) => (
            <Link key={n.key} to={n.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent !text-sidebar-accent-foreground font-medium" }}>
              <n.icon className="size-4" />{n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t pt-4">
          {me ? (
            <Link to="/profile" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent">
              <div className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold">
                {me.fullName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-medium">{me.fullName}</div>
                <div className="text-[11px] text-muted-foreground">{roles.map((r) => ROLE_LABEL[r]).join(", ") || "No role"}</div>
              </div>
            </Link>
          ) : <Skeleton className="h-10" />}
          <div className="mt-2 flex gap-1">
            <Button variant="ghost" size="sm" className="flex-1 justify-start" onClick={signOut}><LogOut />Sign out</Button>
            <Button variant="ghost" size="icon" onClick={theme.toggle} aria-label="Toggle theme">{theme.light ? <Moon /> : <Sun />}</Button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col pb-20 lg:pb-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md lg:px-8 no-print">
          <div className="lg:hidden"><BrandMark className="size-8" /></div>
          <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0">
            <Link to={me ? homeFor(roles) : "/"} aria-label="Go to the home page" title="Home">
              <House className="size-[18px]" />
            </Link>
          </Button>
          <h1 className="truncate text-[15px] font-semibold tracking-tight">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            {me && <GlobalSearch />}
            {allowed && !isLoading && actions}
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={theme.toggle} aria-label="Toggle theme">{theme.light ? <Moon /> : <Sun />}</Button>
            <Link to="/profile" className="lg:hidden" aria-label="Profile"><UserCircle className="size-6 text-muted-foreground" /></Link>
          </div>
        </header>
        <OfflineBar />
        <main className={cn("flex-1", !bare && "px-4 py-6 lg:px-8 lg:py-8")}>
          {isLoading ? (
            <div className="space-y-4 p-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>
          ) : !allowed ? (
            <div className="mx-auto mt-24 max-w-sm text-center fade-up">
              <Lock className="mx-auto size-8 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">This area isn't available to your role</h2>
              <p className="mt-1 text-sm text-muted-foreground">Ask the club owner if you need access.</p>
            </div>
          ) : (
            <div className="fade-up">{children}</div>
          )}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden no-print">
        {items.filter((n) => n.key !== "staff" && n.key !== "shifts" && n.key !== "shift_balance").slice(0, 5).map((n) => (
          <Link key={n.key} to={n.to}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground"
            activeProps={{ className: "!text-primary" }}>
            <n.icon className="size-5" />{n.key === "pnl" ? "P&L" : n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "warn" | "bad" | "good" | undefined }) {
  return (
    <div className="surface-card p-5">
      <div className="eyebrow">{label}</div>
      <div className={cn("mt-2 text-2xl font-semibold tracking-tight tabular",
        tone === "warn" && "text-warning", tone === "bad" && "text-destructive", tone === "good" && "text-success")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, body, icon: Icon }: { title: string; body: string; icon: typeof Lock }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-xl bg-secondary"><Icon className="size-5 text-muted-foreground" /></div>
      <p className="mt-4 font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
