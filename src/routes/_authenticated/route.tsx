import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: rows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (rows ?? []).map((r) => r.role as string);
    const isAdmin = roles.includes("admin");
    const isReviewer = isAdmin || roles.includes("reviewer");
    const isApprover = isAdmin || roles.includes("approver");
    return {
      user: data.user,
      roles,
      isAdmin,
      isReviewer,
      isApprover,
      isStaff: isAdmin || isReviewer || isApprover,
    };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
