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

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={barImg} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/10" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Brand />
          <div className="max-w-md fade-up">
            <p className="eyebrow">Club Management & Business Intelligence</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-tight">
              Every pour, every shilling, <span className="text-gold">accounted for.</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Fast POS for the bar, real stock control in the back, and honest numbers for the owner.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-hero px-6 py-12">
        <div className="w-full max-w-sm fade-up">
          <div className="-ml-3 mb-6 flex justify-start">
            <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <Link to="/" aria-label="Go to the home page">
                <House className="size-4" />Home
              </Link>
            </Button>
          </div>
          <div className="mb-10 lg:hidden"><Brand /></div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{sub}</p>

          {sent ? (
            <div className="mt-8 surface-card p-5 text-sm">
              <p>{sent}</p>
              <Button variant="link" className="mt-2 px-0" onClick={() => { setSent(null); setMode("signin"); }}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4">
              {mode === "setup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button type="button" onClick={() => setMode("forgot")} className="text-xs text-muted-foreground hover:text-foreground">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input id="password" type="password" required minLength={8} autoComplete={mode === "setup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
                </div>
              )}
              <Button type="submit" variant="gold" size="lg" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}
                {mode === "signin" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Create owner account"}
              </Button>
              {mode !== "signin" && (
                <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("signin")}>Back to sign in</Button>
              )}
            </form>
          )}

          {hasOwner === false && mode === "signin" && !sent && (
            <div className="mt-8 rounded-lg border border-dashed p-4 text-sm">
              <p className="text-muted-foreground">New to Blooms Members Club? No owner has been set up yet.</p>
              <Button variant="link" className="px-0" onClick={() => setMode("setup")}>Set up your club →</Button>
            </div>
          )}
          {hasOwner && mode === "signin" && (
            <p className="mt-8 text-xs text-muted-foreground">Staff accounts are created by your club owner.</p>
          )}
        </div>
      </div>
    </div>
  );
}
