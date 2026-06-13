"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  BarChart3,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  disabled?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Firms", href: "/firms", icon: Building2 },
  { label: "Topics", href: "/topics", icon: BookOpen },
];

const PLACEHOLDER_ITEMS: NavItem[] = [
  { label: "Analysis", href: "#", icon: BarChart3, disabled: true },
  { label: "Consortium", href: "#", icon: Users, disabled: true },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      {/* Header: logo/title + collapse toggle */}
      <SidebarHeader className="flex flex-row items-center justify-between gap-2 px-3 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 min-w-0 group-data-[collapsible=icon]:hidden"
        >
          <span className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">
            Firm Intelligence
          </span>
        </Link>
        <SidebarTrigger className="shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground" />
      </SidebarHeader>

      <Separator />

      {/* Primary nav */}
      <SidebarContent className="px-2 pt-2">
        <SidebarMenu>
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={isActive}
                  tooltip={item.label}
                  render={
                    <Link
                      href={item.href}
                      className={cn(
                        isActive
                          ? "text-blue-600 font-medium"
                          : "text-sidebar-foreground/70"
                      )}
                    />
                  }
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-blue-600" : "text-sidebar-foreground/60"
                    )}
                  />
                  <span className="text-sm">{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        <Separator className="my-2" />

        {/* Placeholder items — disabled, visible for orientation */}
        <SidebarMenu>
          {PLACEHOLDER_ITEMS.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                disabled
                tooltip={`${item.label} — coming soon`}
                className="opacity-40 cursor-not-allowed"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="text-sm">{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
