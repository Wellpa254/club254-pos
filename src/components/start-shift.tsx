import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cached } from "@/lib/offline-sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/format";

export const openShiftQuery = (uid?: string) => ({
  queryKey: ["open-shift", uid],
  enabled: !!uid,
  queryFn: () => cached(`clubos-open-shift-${uid}`, async () => {
    const { data, error } = await supabase.from("cashier_shifts").select("*").eq("cashier_id", uid!).eq("status", "open").maybeSingle();
    if (error) throw error;
    return data;
  }),
});

export function StartShift() {
  const qc = useQueryClient();
  const [amt, setAmt] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("open_shift", { _opening_cash: Number(amt || 0) });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Shift started"); qc.invalidateQueries({ queryKey: ["open-shift"] }); },
    onError: (e) => toast.error(friendlyError(e)),
  });
  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <div className="surface-card p-6">
        <div className="eyebrow">New shift</div>
        <h2 className="mt-2 text-xl font-semibold">Start your shift</h2>
        <p className="mt-1 text-sm text-muted-foreground">Count the float in your drawer and enter it below.</p>
        <label className="mt-6 block text-sm">Opening cash (KSh)</label>
        <Input inputMode="numeric" className="mt-1.5 h-12 text-lg tabular" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))} placeholder="10,000" />
        <Button variant="gold" size="xl" className="mt-4 w-full" disabled={m.isPending} onClick={() => m.mutate()}>
          {m.isPending && <Loader2 className="animate-spin" />}Start shift
        </Button>
      </div>
    </div>
  );
}

