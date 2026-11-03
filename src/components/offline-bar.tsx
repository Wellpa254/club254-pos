import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CloudOff, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ksh } from "@/lib/format";
import { discardQueuedSale, syncQueuedSales, useOnline, useQueuedSales } from "@/lib/offline-sales";

export function OfflineBar() {
  const online = useOnline();
  const queued = useQueuedSales();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const failed = queued.filter((s) => s.error);

  async function sync() {
    setBusy(true);
    const r = await syncQueuedSales();
    setBusy(false);
    if (r.synced) { toast.success(`${r.synced} offline sale${r.synced > 1 ? "s" : ""} uploaded`); qc.invalidateQueries(); }
    if (r.failed) toast.error(`${r.failed} sale${r.failed > 1 ? "s" : ""} couldn't be uploaded — tap to review`);
  }

  useEffect(() => {
    if (online && queued.some((s) => !s.error)) void sync();
    const t = setInterval(() => { if (navigator.onLine) void syncQueuedSales().then((r) => { if (r.synced) void qc.invalidateQueries(); }); }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  if (online && queued.length === 0) return null;
  return (
    <div className="border-b bg-warning/10 px-4 py-2 text-sm lg:px-8 no-print">
      <div className="flex flex-wrap items-center gap-2">
        {!online && <span className="flex items-center gap-2 font-medium text-warning"><CloudOff className="size-4" />You're offline</span>}
        {queued.length > 0 && (
          <button className="text-muted-foreground underline-offset-2 hover:underline" onClick={() => setOpen(!open)}>
            {queued.length} sale{queued.length > 1 ? "s" : ""} waiting to upload{failed.length ? ` · ${failed.length} need attention` : ""}
          </button>
        )}
        {!online && queued.length === 0 && <span className="text-muted-foreground">Sales you ring up will be saved and uploaded when you're back online.</span>}
        {online && queued.length > 0 && <Button size="sm" variant="outline" className="ml-auto" disabled={busy} onClick={sync}><RefreshCw className={busy ? "animate-spin" : ""} />Upload now</Button>}
      </div>
      {open && queued.length > 0 && (
        <ul className="mt-2 space-y-1">
          {queued.map((s) => (
            <li key={s.client_ref} className="flex items-center gap-3 text-xs">
              <span className="tabular">{new Date(s.queued_at).toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit" })}</span>
              <span className="tabular">{ksh(s.total)}</span>
              <span className="capitalize text-muted-foreground">{s.payment}</span>
              {s.error && <span className="text-destructive">{s.error.startsWith("STOCK_CHANGED:") ? `Not enough stock: ${s.error.slice(14)}` : s.error}</span>}
              {s.error && <Button size="sm" variant="ghost" className="ml-auto h-6" onClick={() => discardQueuedSale(s.client_ref)}><Trash2 />Discard</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
