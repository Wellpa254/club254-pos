import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createStaff, updateStaff } from "@/lib/staff.functions";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { useMe } from "@/hooks/use-me";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff — Club254" }, { name: "description", content: "Create staff logins and assign roles." }] }),
  component: StaffPage,
});

const ROLES: Role[] = ["manager", "cashier", "stock_manager", "owner"];

function StaffPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const update = useServerFn(updateStaff);
  const staff = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      return (p ?? []).map((x) => ({ ...x, role: r?.find((y) => y.user_id === x.id)?.role as Role | undefined }));
    },
  });
  const m = useMutation({
    mutationFn: (v: { userId: string; role?: Role; active?: boolean }) => update({ data: v }),
    onSuccess: () => { toast.success("Access updated"); qc.invalidateQueries({ queryKey: ["staff"] }); },
    onError: (e) => toast.error((e as Error).message || "Couldn't update access."),
  });

  return (
    <AppShell area="staff" title="Staff" actions={<Button size="sm" variant="gold" onClick={() => setOpen(true)}><UserPlus />Add staff</Button>}>
      <div className="surface-card mx-auto max-w-4xl overflow-x-auto">
        {staff.data?.length ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="p-4 font-medium">Name</th><th className="p-4 font-medium">Role</th><th className="p-4 font-medium">Added</th><th className="p-4 font-medium">Active</th></tr></thead>
            <tbody>
              {staff.data.map((s) => {
                const self = s.id === me?.id;
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="p-4"><div className="font-medium">{s.full_name}{self && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</div><div className="text-xs text-muted-foreground">{s.email}</div></td>
                    <td className="p-4">
                      <Select disabled={self} value={s.role ?? ""} onValueChange={(v) => m.mutate({ userId: s.id, role: v as Role })}>
                        <SelectTrigger className="w-40"><SelectValue placeholder="No role" /></SelectTrigger>
                        <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="p-4 text-muted-foreground whitespace-nowrap">{fmtDateTime(s.created_at)}</td>
                    <td className="p-4"><Switch disabled={self} checked={s.active} onCheckedChange={(v) => m.mutate({ userId: s.id, active: v })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState icon={Users} title="No staff yet" body="Add your managers, cashiers and stock team." />}
      </div>
      {open && <AddStaff onClose={() => setOpen(false)} />}
    </AppShell>
  );
}

function AddStaff({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const create = useServerFn(createStaff);
  const [f, setF] = useState({ fullName: "", email: "", password: "", role: "cashier" as Role });
  const m = useMutation({
    mutationFn: () => create({ data: f }),
    onSuccess: () => { toast.success(`${f.fullName} can now sign in`); qc.invalidateQueries({ queryKey: ["staff"] }); onClose(); },
    onError: (e) => toast.error((e as Error).message || "Couldn't create the user."),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add staff member</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Full name</Label><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Temporary password</Label><Input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="8+ characters" /></div>
          <div className="space-y-1.5"><Label>Role</Label>
            <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as Role })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent></Select>
          </div>
          <p className="text-xs text-muted-foreground">Share the password with them privately; they can change it from their profile.</p>
        </div>
        <DialogFooter><Button variant="gold" disabled={m.isPending || f.password.length < 8 || !f.email || !f.fullName} onClick={() => m.mutate()}>Create login</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
