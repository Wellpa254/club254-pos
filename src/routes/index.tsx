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
      { title: "Blooms Members Club — Run your club on real numbers" },
      {
        name: "description",
        content:
          "Blooms Members Club brings the till, the stock room, the cash drawer and daily profit into one calm system for Kenyan clubs, bars and lounges.",
      },
      { property: "og:title", content: "Blooms Members Club — Run your club on real numbers" },
      {
        property: "og:description",
        content:
          "POS, true stock costing, cashier shifts, purchases and daily profit — in KSh, on Nairobi time.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://club-pos.club254.workers.dev/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://club-pos.club254.workers.dev/og-image.jpg" },
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
    <header className="sticky top-0 z-50 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] w-full max-w-6xl items-center justify-between gap-6 px-6">
        <Link to="/" aria-label="Blooms Members Club home">
          <Brand subtitle={false} />
        </Link>
        <div className="flex items-center gap-1.5">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground hover:bg-transparent hover:text-foreground sm:inline-flex"
          >
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden whitespace-nowrap rounded-full border-[color-mix(in_oklab,var(--gold-2)_45%,transparent)] bg-transparent px-5 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--gold-1)] sm:inline-flex hover:border-[var(--gold-2)] hover:bg-[color-mix(in_oklab,var(--gold-2)_10%,transparent)]"
          >
            <Link to="/auth">Open Blooms Members Club</Link>
          </Button>
        </div>
      </div>
      <span className="rule-gold absolute inset-x-0 bottom-0 opacity-50" aria-hidden />
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
          <span className="text-gold italic">Blooms</span> Members Club
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
          <div className="tabular">© 2026 Blooms Members Club · Africa/Nairobi</div>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------- hero block */

function Hero() {
  // A soft light that follows the mouse on desktop. Touch screens ignore it.
  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <section
      onPointerMove={onMove}
      className="relative isolate flex min-h-[calc(100svh-4.5rem)] flex-col overflow-hidden"
    >
      <img
        src={heroImg}
        alt=""
        aria-hidden
        width={1600}
        height={912}
        className="hero-zoom absolute inset-0 size-full object-cover opacity-80 saturate-[0.82] contrast-[1.06]"
      />
      <div className="hero-veil absolute inset-0 hidden lg:block" aria-hidden />
      <div className="hero-veil-bottom absolute inset-0 lg:hidden" aria-hidden />
      <div className="hero-veil-desktop absolute inset-0 hidden lg:block" aria-hidden />
      <div className="bg-hero absolute inset-0" aria-hidden />
      <div className="hero-bloom pointer-events-none absolute inset-0" aria-hidden />
      <div className="hero-spot pointer-events-none absolute inset-0 hidden sm:block" aria-hidden />
      <div className="grain-layer pointer-events-none absolute inset-0" aria-hidden />

      <div className="hero-frame absolute inset-3 sm:inset-5 lg:inset-7" aria-hidden>
        <span className="hero-corner -top-px -left-px border-t border-l" />
        <span className="hero-corner -top-px -right-px border-t border-r" />
        <span className="hero-corner -bottom-px -left-px border-b border-l" />
        <span className="hero-corner -bottom-px -right-px border-b border-r" />
        <span className="hero-diamond -top-[3px] left-1/2 -translate-x-1/2" />
        <span className="hero-diamond -bottom-[3px] left-1/2 -translate-x-1/2" />
      </div>
      <div className="hero-frame-inner absolute inset-[1.375rem] sm:inset-8 lg:inset-[2.625rem]" aria-hidden />

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-end px-8 pb-14 pt-14 text-center sm:px-10 sm:pb-16 lg:px-16 lg:pb-[4.5rem]">
        <h1 className="sr-only">Blooms Members Club</h1>

        <div className="lux-in flex items-center gap-4 lg:hidden" style={{ animationDelay: "120ms" }} aria-hidden>
          <span className="rule-gold w-16 sm:w-28" />
          <span className="size-1.5 rotate-45 bg-[var(--gold-2)]/80" />
          <span className="rule-gold w-16 sm:w-28" />
        </div>

        <div
          className="lux-in mt-8 flex w-full max-w-sm items-center justify-center lg:mt-0 lg:max-w-4xl lg:gap-8"
          style={{ animationDelay: "360ms" }}
        >
          <span className="rule-gold hidden flex-1 lg:block" aria-hidden />
          <span className="eyebrow-gold max-w-xs text-balance !tracking-[0.38em] !leading-[2] sm:max-w-none sm:!tracking-[0.42em] lg:whitespace-nowrap">
            Club Management &amp; Business Intelligence
          </span>
          <span className="rule-gold hidden flex-1 lg:block" aria-hidden />
        </div>

        <div
          className="hero-cta lux-in mt-9 flex w-full max-w-sm flex-col items-stretch gap-3 lg:mt-9 lg:w-auto lg:max-w-none lg:flex-row lg:items-center lg:justify-center lg:gap-4"
          style={{ animationDelay: "700ms" }}
        >
          <Button
            asChild
            variant="gold"
            size="xl"
            className="sheen h-14 w-full whitespace-nowrap rounded-full px-6 text-[11.5px] font-semibold uppercase tracking-[0.16em] max-[380px]:px-3 max-[380px]:text-[10.5px] max-[380px]:tracking-[0.1em] sm:text-[12px] sm:tracking-[0.2em] lg:w-[22rem] lg:tracking-[0.22em]"
          >
            <Link to="/auth">
              Open Blooms Members Club
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="xl"
            className="h-14 w-full rounded-full border-[color-mix(in_oklab,var(--gold-2)_40%,transparent)] bg-background/25 px-6 text-[12px] font-medium uppercase tracking-[0.22em] text-foreground backdrop-blur-md hover:border-[var(--gold-2)] hover:bg-background/45 lg:w-[22rem]"
          >
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
