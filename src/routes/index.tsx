import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import heroImg from "@/assets/hero-bar.jpg";
import { supabase } from "@/integrations/supabase/client";
import { Brand, BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { homeFor, type Role } from "@/lib/roles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Club254 — Run your club on real numbers" },
      {
        name: "description",
        content:
          "Club254 brings the till, the stock room, the cash drawer and daily profit into one calm system for Kenyan clubs, bars and lounges.",
      },
      { property: "og:title", content: "Club254 — Run your club on real numbers" },
      {
        property: "og:description",
        content:
          "POS, true stock costing, cashier shifts, purchases and daily profit — in KSh, on Nairobi time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

/* ------------------------------------------------------------- component */

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .then(({ data: rows }) => {
          if (!active || !rows?.length) return;
          navigate({ to: homeFor(rows.map((r) => r.role as Role)) });
        });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ---------------------------------------------------------- chrome pieces */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-6">
        <Link to="/" aria-label="Club254 home">
          <Brand subtitle={false} />
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild variant="gold" size="sm">
            <Link to="/auth">Open Club254</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="relative border-t border-border/70">
      <span className="rule-gold shimmer-rule absolute inset-x-0 top-0 opacity-70" aria-hidden />
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-6 py-14 text-center">
        <BrandMark className="size-10" />
        <div className="display text-[1.9rem] leading-none tracking-tight">
          Club<span className="text-gold italic">254</span>
        </div>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Built for clubs, bars and lounges. Currency in KSh, every timestamp on Nairobi time.
        </p>
        <span className="rule-gold mt-2 w-24" aria-hidden />
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground sm:flex-row sm:gap-3">
          <Link to="/auth" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
          <span className="hidden size-1 rotate-45 bg-primary/50 sm:block" aria-hidden />
          <div className="tabular">© 2026 Club254 · Africa/Nairobi</div>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------- hero block */

function Hero() {
  return (
    <section className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden">
      <img
        src={heroImg}
        alt=""
        aria-hidden
        width={1600}
        height={912}
        className="absolute inset-0 size-full object-cover opacity-85"
      />
      <div className="hero-veil absolute inset-0" aria-hidden />
      <div className="hero-veil-m absolute inset-0 sm:hidden" aria-hidden />
      <div className="veil-center absolute inset-0" aria-hidden />
      <div className="bg-hero absolute inset-0" aria-hidden />
      <div className="grain-layer pointer-events-none absolute inset-0" aria-hidden />
      <div className="hero-frame absolute inset-3 sm:inset-5 lg:inset-7" aria-hidden>
        <span className="hero-corner -top-px -left-px border-t border-l" />
        <span className="hero-corner -top-px -right-px border-t border-r" />
        <span className="hero-corner -bottom-px -left-px border-b border-l" />
        <span className="hero-corner -bottom-px -right-px border-b border-r" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-10 pb-14 pt-12 text-center">
        <h1 className="sr-only">Club254</h1>
        <div
          className="fade-up flex flex-col items-center gap-5"
          style={{ animationDelay: "80ms" }}
        >
          <span className="rule-gold shimmer-rule w-16" aria-hidden />
          <span className="eyebrow-gold max-w-lg">
            Club Management &amp; Business Intelligence
          </span>
        </div>

        <div
          className="fade-up mt-10 flex w-full max-w-sm flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:justify-center"
          style={{ animationDelay: "200ms" }}
        >
          <Button asChild variant="gold" size="xl" className="sheen w-full sm:w-auto">
            <Link to="/auth">
              Open Club254
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="xl"
            className="w-full border-border/80 bg-background/70 text-foreground backdrop-blur-md hover:bg-background/90 sm:w-auto"
          >
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </div>

    </section>
  );
}
