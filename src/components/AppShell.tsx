import type { ReactNode } from "react";
import { Link, useNavigate, useRouteContext, useRouterState } from "@tanstack/react-router";
import { FileSpreadsheet, Hammer, History, Shield, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useRouteContext({ from: "/_authenticated" });
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const items = [
    { title: "Convert", url: "/convert", icon: FileSpreadsheet },
    { title: "Build", url: "/build", icon: Hammer },
    { title: "History", url: "/history", icon: History },
    ...(isAdmin ? [{ title: "Admin", url: "/admin", icon: Shield }] : []),
  ] as const;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={path.startsWith(item.url)} tooltip={item.title}>
                        <Link to={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut} tooltip="Sign out">
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 items-center justify-between border-b px-2">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm font-medium">NMK Pricelist to ERP</span>
            </div>
            <span className="max-w-48 truncate text-sm text-muted-foreground">
              {user.email} {isAdmin ? "(admin)" : ""}
            </span>
          </header>
          <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

