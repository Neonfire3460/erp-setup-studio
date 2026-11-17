import type { ReactNode } from "react";
import { Link, useNavigate, useRouteContext, useRouterState } from "@tanstack/react-router";
import { FileSpreadsheet, Boxes, Inbox, Settings, LogOut, LayoutGrid } from "lucide-react";
import { BrandLockup } from "@/components/BrandLockup";
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
    { title: "Catalogue", url: "/catalogue", icon: LayoutGrid },
    { title: "Convert", url: "/convert", icon: FileSpreadsheet },
    { title: "Build", url: "/build", icon: Boxes },
    { title: "My submissions", url: "/my-submissions", icon: Inbox },
    ...(isAdmin ? [{ title: "Admin", url: "/admin", icon: Settings }] : []),
  ] as const;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="fixed inset-x-0 top-0 z-[60] h-[3px] bg-nmk-gradient" />
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon">
          <div className="flex h-24 items-center justify-center px-6 group-data-[collapsible=icon]:px-1"><span className="group-data-[collapsible=icon]:hidden"><BrandLockup compact /></span><span className="hidden group-data-[collapsible=icon]:block"><BrandLockup collapsed /></span></div>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      {item.url === "/admin" && <p className="mb-3 mt-6 border-t pt-5 text-[11px] font-semibold text-muted-foreground group-data-[collapsible=icon]:hidden">ADMIN</p>}
                      <SidebarMenuButton className="h-11 px-4 data-[active=true]:border-l-[3px] data-[active=true]:border-primary data-[active=true]:text-primary data-[active=true]:font-semibold" asChild isActive={path.startsWith(item.url)} tooltip={item.title}>
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
          <SidebarFooter className="border-t p-4">
            <div className="flex items-center gap-3 group-data-[collapsible=icon]:hidden"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">{user.email?.[0]?.toUpperCase()}</span><div className="min-w-0"><p className="truncate text-xs font-semibold">{user.email}</p><p className="text-xs text-muted-foreground">{isAdmin ? "Admin" : "Brand Manager"}</p></div></div>
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
          <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:h-12 lg:border-0 lg:bg-transparent">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="lg:hidden"><BrandLockup compact /></span>
            </div>
            <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:block">
              {user.email} {isAdmin ? "(admin)" : ""}
            </span>
          </header>
          <main className="mx-auto w-full max-w-[1280px] min-w-0 flex-1 p-4 sm:p-8 lg:pt-2">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

