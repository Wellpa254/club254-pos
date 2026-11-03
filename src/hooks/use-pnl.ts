import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Range } from "@/lib/periods";

export type DayRow = { day: string; revenue: number; cogs: number; expenses: number; transactions: number };

export function usePnlDaily(r: Range) {
  return useQuery({
    queryKey: ["pnl", r.start, r.end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pnl_daily", { _start: r.start, _end: r.end });
      if (error) throw error;
      return (data ?? []).map((x) => ({ day: x.day, revenue: Number(x.revenue), cogs: Number(x.cogs), expenses: Number(x.expenses), transactions: Number(x.transactions) })) as DayRow[];
    },
  });
}

export function useExpenseBreakdown(r: Range) {
  return useQuery({
    queryKey: ["exp-breakdown", r.start, r.end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("expense_breakdown", { _start: r.start, _end: r.end });
      if (error) throw error;
      return (data ?? []).map((x) => ({ category: x.category, total: Number(x.total) }));
    },
  });
}
