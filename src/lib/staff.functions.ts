import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Role } from "./roles";

const ROLES: Role[] = ["owner", "manager", "cashier", "stock_manager"];

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (!data) throw new Error("Only the owner can manage staff.");
}

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { email: string; fullName: string; password: string; role: Role }) => {
    if (!/^\S+@\S+\.\S+$/.test(i.email)) throw new Error("Enter a valid email.");
    if (!i.fullName.trim() || i.fullName.length > 100) throw new Error("Enter a name.");
    if (i.password.length < 8) throw new Error("Password must be at least 8 characters.");
    if (!ROLES.includes(i.role)) throw new Error("Invalid role.");
    return i;
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName.trim() },
    });
    if (error || !created.user) {
      throw new Error(/already/i.test(error?.message ?? "") ? "A user with that email already exists." : "Could not create the user.");
    }
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId, action: "user_create", object_type: "user", object_id: created.user.id,
      new_value: { email: data.email, role: data.role },
    });
    return { ok: true };
  });

export const updateStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; role?: Role; active?: boolean }) => {
    if (i.role && !ROLES.includes(i.role)) throw new Error("Invalid role.");
    return i;
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You can't change your own access.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
      await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    }
    if (typeof data.active === "boolean") {
      await supabaseAdmin.from("profiles").update({ active: data.active }).eq("id", data.userId);
      await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: data.active ? "none" : "876000h" });
    }
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId, action: "permission_change", object_type: "user", object_id: data.userId,
      new_value: { role: data.role ?? null, active: data.active ?? null },
    });
    return { ok: true };
  });
