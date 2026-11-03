import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL } from "@/lib/roles";
import { friendlyError } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Your profile — Club254" }, { name: "description", content: "Manage your Club254 profile and password." }] }),
  component: Profile,
});

function Profile() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  useEffect(() => { if (me) setName(me.fullName); }, [me]);

  async function saveName() {
    if (!me) return;
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", me.id);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["me"] });
  }
  async function changePw() {
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: cur } as never);
    if (error) { toast.error(friendlyError(error, "Couldn't change password. Check your current password.")); return; }
    setPw(""); setCur("");
    toast.success("Password changed");
  }

  return (
    <AppShell title="Profile">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="surface-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">{me?.fullName}</div>
              <div className="text-sm text-muted-foreground">{me?.email}</div>
            </div>
            <div className="flex gap-1">{me?.roles.map((r) => <Badge key={r} variant="secondary">{ROLE_LABEL[r]}</Badge>)}</div>
          </div>
          {me && me.roles.length === 0 && (
            <p className="mt-4 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">Your account has no role yet. Ask the club owner to assign one.</p>
          )}
          <div className="mt-6 space-y-1.5">
            <Label>Display name</Label>
            <div className="flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} /><Button onClick={saveName}>Save</Button></div>
          </div>
        </div>
        <div className="surface-card space-y-3 p-6">
          <div className="font-medium">Change password</div>
          <Input type="password" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} />
          <Input type="password" placeholder="New password (8+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button disabled={pw.length < 8 || !cur} onClick={changePw}>Update password</Button>
        </div>
      </div>
    </AppShell>
  );
}
