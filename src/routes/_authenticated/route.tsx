import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Splash } from "@/components/splash";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingComponent: Splash,
  pendingMs: 150,
  pendingMinMs: 300,
  beforeLoad: async () => {
    // Offline: trust the saved session so the till keeps working; the server re-checks on sync.
    if (!navigator.onLine) {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw redirect({ to: "/auth" });
      return;
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
