import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { House } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/brand";
import { friendlyError } from "@/lib/format";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — Blooms Members Club" },
      { name: "description", content: "Set a new password for your Blooms Members Club account." },
      { property: "og:title", content: "Choose a new password — Blooms Members Club" },
      { property: "og:description", content: "Set a new password for your Blooms Members Club account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(friendlyError(error, "This reset link is invalid or has expired.")); return; }
    toast.success("Password updated");
    navigate({ to: "/auth" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 fade-up">
        <Brand />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">At least 8 characters.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw">New password</Label>
          <Input id="pw" type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} className="h-11" />
        </div>
        <Button type="submit" variant="gold" size="lg" className="w-full" disabled={busy}>Update password</Button>
        <div className="flex justify-center pt-2">
          <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Link to="/" aria-label="Go to the home page">
              <House className="size-4" />Home
            </Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
