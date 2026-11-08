import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { House, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/brand";
import { friendlyError } from "@/lib/format";
import { homeFor, type Role } from "@/lib/roles";
import barImg from "@/assets/auth-bar.jpg";
import heroImg from "@/assets/hero-bar.jpg";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Blooms Members Club" },
      { name: "description", content: "Sign in to Blooms Members Club to run sales, stock and shifts for your club." },
      { property: "og:title", content: "Sign in — Blooms Members Club" },
      { property: "og:description", content: "Sign in to Blooms Members Club to run sales, stock and shifts for your club." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "forgot" | "setup";

async function routeHome(navigate: ReturnType<typeof useNavigate>) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
  navigate({ to: homeFor((data ?? []).map((r) => r.role as Role)), replace: true });
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [hasOwner, setHasOwner] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && routeHome(navigate));
    supabase.rpc("club_has_owner").then(({ data }) => setHasOwner(!!data));
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await routeHome(navigate);
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("If that email has an account, a reset link is on its way.");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/auth", data: { full_name: name } },
        });
        if (error) throw error;
        if (data.session) await routeHome(navigate);
        else setSent("Check your email to confirm your owner account, then sign in.");
      }
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't complete that. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signin" ? "Welcome back" : mode === "forgot" ? "Reset your password" : "Set up your club";
  const sub =
    mode === "signin" ? "Sign in to your Blooms Members Club workspace."
    : mode === "forgot" ? "We'll email you a secure link."
    : "Create the owner account. Staff are invited from inside the app.";

  const label = "text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground";
  const field =
    "h-12 rounded-xl border-[color-mix(in_oklab,var(--gold-2)_24%,transparent)] bg-background/40 px-4 text-base backdrop-blur-md transition-colors focus-visible:border-[var(--gold-2)] focus-visible:ring-1 focus-visible:ring-[color-mix(in_oklab,var(--gold-2)_55%,transparent)]";
  const homeLink = (
    <Link
      to="/"
      aria-label="Go to the home page"
      className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
    >
      <House className="size-4" />
      Home
    </Link>
  );

  return (
    <div className="relative isolate min-h-svh overflow-hidden lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* phones and tablets: the photo sits behind the form, framed like the home page */}
      <div className="absolute inset-0 -z-10 lg:hidden" aria-hidden>
        <div
          className="hero-zoom absolute inset-0 bg-cover bg-center opacity-80 saturate-[0.82] contrast-[1.06]"
          style={{ backgroundImage: `url(${heroImg})` }}
        />
        <div className="hero-veil-bottom absolute inset-0" />
        <div className="grain-layer absolute inset-0" />
      </div>
      <div className="hero-frame pointer-events-none absolute inset-3 sm:inset-5 lg:hidden" aria-hidden>
        <span className="hero-corner -top-px -left-px border-t border-l" />
        <span className="hero-corner -top-px -right-px border-t border-r" />
        <span className="hero-corner -bottom-px -left-px border-b border-l" />
        <span className="hero-corner -bottom-px -right-px border-b border-r" />
        <span className="hero-diamond -top-[3px] left-1/2 -translate-x-1/2" />
        <span className="hero-diamond -bottom-[3px] left-1/2 -translate-x-1/2" />
      </div>
      <div className="hero-frame-inner pointer-events-none absolute inset-[1.375rem] sm:inset-8 lg:hidden" aria-hidden />

      {/* desktop: photo panel */}
      <div className="relative hidden overflow-hidden lg:block">
        <div
          className="hero-zoom absolute inset-0 bg-cover bg-center opacity-90 saturate-[0.85] contrast-[1.05]"
          style={{ backgroundImage: `url(${barImg})` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/45 to-background/10" aria-hidden />
        <div className="hero-bloom pointer-events-none absolute inset-0" aria-hidden />
        <div className="grain-layer pointer-events-none absolute inset-0" aria-hidden />
        <div className="hero-frame absolute inset-7" aria-hidden>
          <span className="hero-corner -top-px -left-px border-t border-l" />
          <span className="hero-corner -top-px -right-px border-t border-r" />
          <span className="hero-corner -bottom-px -left-px border-b border-l" />
          <span className="hero-corner -bottom-px -right-px border-b border-r" />
          <span className="hero-diamond -top-[3px] left-1/2 -translate-x-1/2" />
          <span className="hero-diamond -bottom-[3px] left-1/2 -translate-x-1/2" />
        </div>
        <div className="hero-frame-inner absolute inset-[2.625rem]" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-16">
          <Brand />
          <div className="lux-in max-w-md" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center gap-3" aria-hidden>
              <span className="size-1.5 rotate-45 bg-[var(--gold-2)]/80" />
              <span className="rule-gold w-20" />
            </div>
            <p className="eyebrow-gold mt-5 !tracking-[0.34em]">Club Management &amp; Business Intelligence</p>
            <h2 className="display mt-5 text-[3.4rem] font-light leading-[1.04] tracking-tight">
              Every pour, every shilling, <span className="text-gold italic">accounted for.</span>
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-foreground/70">
              Fast POS for the bar, real stock control in the back, and honest numbers for the owner.
            </p>
          </div>
        </div>
      </div>

      {/* the form: bottom of the photo on phones, centred beside the photo on desktop */}
      <div className="relative flex min-h-svh flex-col items-center px-8 pb-12 pt-8 sm:px-12 lg:justify-center lg:bg-hero lg:px-6 lg:py-12">
        <div className="hero-bloom pointer-events-none absolute inset-0 hidden lg:block" aria-hidden />
        <div className="relative flex w-full max-w-sm flex-1 flex-col lg:flex-none">
          <div className="flex items-center justify-between pb-6 lg:hidden">
            <Brand subtitle={false} />
            {homeLink}
          </div>
          <div className="mb-7 hidden lg:block">{homeLink}</div>

          <div className="lux-in mt-auto text-center lg:mt-0 lg:text-left" style={{ animationDelay: "120ms" }}>
            <div className="flex items-center justify-center gap-3 lg:justify-start" aria-hidden>
              <span className="rule-gold w-14 lg:hidden" />
              <span className="size-1.5 rotate-45 bg-[var(--gold-2)]/80" />
              <span className="rule-gold w-14 lg:w-16" />
            </div>
            <h1 className="display mt-5 text-[2.75rem] font-light leading-none tracking-tight lg:text-5xl">{title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-foreground/70">{sub}</p>
          </div>

          {sent ? (
            <div
              className="lux-in mt-8 rounded-2xl border border-[color-mix(in_oklab,var(--gold-2)_28%,transparent)] bg-background/50 p-5 text-sm backdrop-blur-md"
              style={{ animationDelay: "260ms" }}
            >
              <p>{sent}</p>
              <Button variant="link" className="mt-2 px-0 text-[var(--gold-1)]" onClick={() => { setSent(null); setMode("signin"); }}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="lux-in mt-8 space-y-4" style={{ animationDelay: "260ms" }}>
              {mode === "setup" && (
                <div className="space-y-2">
                  <Label htmlFor="name" className={label}>Your name</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className={field} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className={label}>Email</Label>
                <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className={label}>Password</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-[11px] uppercase tracking-[0.16em] text-[var(--gold-1)]/80 transition-colors hover:text-[var(--gold-1)]"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input id="password" type="password" required minLength={8} autoComplete={mode === "setup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
                </div>
              )}
              <Button
                type="submit"
                variant="gold"
                size="xl"
                className="sheen mt-2 h-14 w-full rounded-full text-[12px] font-semibold uppercase tracking-[0.22em]"
                disabled={busy}
              >
                {busy && <Loader2 className="animate-spin" />}
                {mode === "signin" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Create owner account"}
              </Button>
              {mode !== "signin" && (
                <Button type="button" variant="ghost" className="w-full text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={() => setMode("signin")}>Back to sign in</Button>
              )}
            </form>
          )}

          {hasOwner === false && mode === "signin" && !sent && (
            <div className="lux-in mt-8 rounded-2xl border border-dashed border-[color-mix(in_oklab,var(--gold-2)_35%,transparent)] bg-background/40 p-4 text-sm backdrop-blur-md" style={{ animationDelay: "380ms" }}>
              <p className="text-muted-foreground">New to Blooms Members Club? No owner has been set up yet.</p>
              <Button variant="link" className="px-0 text-[var(--gold-1)]" onClick={() => setMode("setup")}>Set up your club →</Button>
            </div>
          )}
          {hasOwner && mode === "signin" && (
            <p className="lux-in mt-8 text-center text-xs text-muted-foreground lg:text-left" style={{ animationDelay: "380ms" }}>Staff accounts are created by your club owner.</p>
          )}
        </div>
      </div>
    </div>
  );
}
