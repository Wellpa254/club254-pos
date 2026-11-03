import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cached } from "@/lib/offline-sales";
import type { Role } from "@/lib/roles";

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) return null;
    return cached(`clubos-me-${user.id}`, () => loadMe(user.id, user.email));
  },
  staleTime: 60_000,
});

async function loadMe(uid: string, email?: string) {
    const u = { user: { id: uid, email } };
    const [{ data: profile, error }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    ]);
    if (error) throw error;
    return {
      id: u.user.id,
      email: u.user.email ?? "",
      fullName: profile?.full_name || u.user.email?.split("@")[0] || "",
      active: profile?.active ?? true,
      roles: (roles ?? []).map((r) => r.role as Role),
    };
}

export function useMe() {
  return useQuery(meQuery);
}
