import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Sales rung up while offline. Each keeps its client_ref so complete_sale never records it twice. */
export type QueuedSale = {
  client_ref: string;
  items: { product_id: string; quantity: number }[];
  discount: number;
  payment: string;
  total: number;
  queued_at: string;
  error?: string;
};

const KEY = "clubos-offline-sales";
const listeners = new Set<() => void>();
let cache: QueuedSale[] | null = null;

function read(): QueuedSale[] {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { cache = []; }
  return cache!;
}
function write(v: QueuedSale[]) {
  cache = v;
  localStorage.setItem(KEY, JSON.stringify(v));
  listeners.forEach((l) => l());
}

export function queueSale(s: Omit<QueuedSale, "queued_at">) {
  write([...read(), { ...s, queued_at: new Date().toISOString() }]);
}

const EMPTY: QueuedSale[] = [];
export function useQueuedSales() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    read,
    () => EMPTY,
  );
}

/** A network failure (not a rule like "out of stock") means we should keep the sale for later. */
export function isNetworkError(e: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const m = String((e as { message?: string })?.message ?? e);
  return /Failed to fetch|NetworkError|Load failed|network/i.test(m);
}

let syncing = false;
export async function syncQueuedSales(): Promise<{ synced: number; failed: number }> {
  if (syncing || !navigator.onLine) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0, failed = 0;
  try {
    for (const s of read()) {
      const { error } = await supabase.rpc("complete_sale", { _client_ref: s.client_ref, _items: s.items, _discount: s.discount, _payment: s.payment });
      if (!error) { synced++; write(read().filter((x) => x.client_ref !== s.client_ref)); continue; }
      if (isNetworkError(error)) break;
      failed++;
      write(read().map((x) => (x.client_ref === s.client_ref ? { ...x, error: error.message } : x)));
    }
  } finally { syncing = false; }
  return { synced, failed };
}

export function discardQueuedSale(ref: string) {
  write(read().filter((x) => x.client_ref !== ref));
}

export function useOnline() {
  return useSyncExternalStore(
    (l) => { window.addEventListener("online", l); window.addEventListener("offline", l); return () => { window.removeEventListener("online", l); window.removeEventListener("offline", l); }; },
    () => navigator.onLine,
    () => true,
  );
}

/** Keep the last good copy of a read so screens still work with no internet. */
export async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  try {
    const v = await load();
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full */ }
    return v;
  } catch (e) {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as T;
    throw e;
  }
}
