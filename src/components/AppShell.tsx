import type { ReactNode } from "react";
import { Link, useNavigate, useRouteContext, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Boxes,
  Inbox,
  LogOut,
  ClipboardCheck,
  BadgeCheck,
  Upload,
  Database,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { staffBadges } from "@/lib/v3/tickets.functions";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type Item = {
  title: string;
  url: string;
  icon: typeof Home;
  badge?: "review" | "approval" | "upload";
  admin?: boolean;
};

const REGISTER_CHILDREN: { title: string; url?: string }[] = [
  { title: "NMK brands", url: "/item-registration/standard" },
  { title: "PDF pricelist", url: "/pdf-pricelist" },
  { title: "Third party brands" },
  { title: "Bundles (BOM)" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, isStaff, isReviewer, isApprover } = useRouteContext({
    from: "/_authenticated",
  });
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { data: badges } = useQuery({
    queryKey: ["staff-badges"],
    queryFn: () => staffBadges(),
    enabled: isStaff,
    refetchInterval: 60000,
  });

  const items: Item[] = [
    { title: "Home", url: "/home", icon: Home },
    { title: "Register items", url: "/item-registration", icon: Boxes },
    { title: "View ERP data", url: "/erp-items", icon: Database },
    { title: "My requests", url: "/my-submissions", icon: Inbox },
    ...(isReviewer
      ? [
          {
            title: "Review",
            url: "/review",
            icon: ClipboardCheck,
            badge: "review",
            admin: true,
          } as Item,
        ]
      : []),
    ...(isApprover
      ? [
          {
            title: "Approval",
            url: "/approval",
            icon: BadgeCheck,
            badge: "approval",
            admin: true,
          } as Item,
        ]
      : []),
    ...(isReviewer
      ? [
          { title: "Upload", url: "/upload", icon: Upload, badge: "upload", admin: true } as Item,
          { title: "ERP data import", url: "/erp-import", icon: Database, admin: true } as Item,
        ]
      : []),
    ...(isStaff
      ? [{ title: "Admin settings", url: "/admin", icon: Settings, admin: true } as Item]
      : []),
  ];
  const firstAdmin = items.findIndex((i) => i.admin);
  const roleText =
    roles
      .filter((r) => r !== "user")
      .map((r) => r[0]!.toUpperCase() + r.slice(1))
      .join(", ") || "Brand Manager";

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="fixed inset-x-0 top-0 z-[60] h-[3px] bg-nmk-gradient" />
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon">
          <div className="flex h-24 items-center justify-center px-6 group-data-[collapsible=icon]:px-1">
            <span className="group-data-[collapsible=icon]:hidden">
              <BrandLockup compact />
            </span>
            <span className="hidden group-data-[collapsible=icon]:block">
              <BrandLockup collapsed />
            </span>
          </div>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item, i) => (
                    <SidebarMenuItem key={item.url}>
                      {i === firstAdmin && (
                        <p className="mb-3 mt-6 border-t pt-5 text-[11px] font-semibold text-muted-foreground group-data-[collapsible=icon]:hidden">
                          ADMIN
                        </p>
                      )}
                      <SidebarMenuButton
                        className="h-11 px-4 data-[active=true]:border-l-[3px] data-[active=true]:border-primary data-[active=true]:font-semibold data-[active=true]:text-primary"
                        asChild
                        isActive={
                          item.url === "/item-registration"
                            ? path === item.url
                            : path.startsWith(item.url)
                        }
                        tooltip={item.title}
                      >
                        <Link to={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                          {item.badge && (badges?.[item.badge] ?? 0) > 0 && (
                            <span className="ml-auto rounded-full bg-accent px-2 text-xs text-primary group-data-[collapsible=icon]:hidden">
                              {badges?.[item.badge]}
                            </span>
                          )}
                          {item.url === "/item-registration" && (
                            <ChevronDown className="ml-auto h-4 w-4 opacity-60" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                      {item.url === "/item-registration" && (
                        <SidebarMenuSub className="border-l-2 border-primary/25">
                          {REGISTER_CHILDREN.map((c) => (
                            <SidebarMenuSubItem key={c.title}>
                              {c.url ? (
                                <SidebarMenuSubButton asChild isActive={path.startsWith(c.url)}>
                                  <Link to={c.url}>
                                    <span>{c.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              ) : (
                                <span className="flex h-7 items-center px-2 text-sm text-muted-foreground/70">
                                  {c.title} · soon
                                </span>
                              )}
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t p-4">
            <div className="flex items-center gap-3 group-data-[collapsible=icon]:hidden">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                {user.email?.[0]?.toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{user.email}</p>
                <p className="truncate text-xs text-muted-foreground">{roleText}</p>
              </div>
            </div>
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
        <div className="nmk-app-bg flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:h-12 lg:border-0 lg:bg-transparent">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="lg:hidden">
                <BrandLockup compact />
              </span>
            </div>
            <Link
              to="/my-submissions"
              className="text-sm font-semibold text-primary hover:underline"
            >
              My requests
            </Link>
          </header>
          <main className="mx-auto w-full min-w-0 max-w-[1440px] flex-1 p-4 sm:px-8 sm:pb-10 lg:pt-2">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
