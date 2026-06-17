"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  Building2,
  FileText,
  LayersIcon,
  LayoutDashboard,
  LogOut,
  Network,
  ScrollText,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth/actions";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  disabled?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Analysis", href: "/analysis", icon: Network },
  { label: "Firms", href: "/firms", icon: Building2 },
  { label: "Groups", href: "/groups", icon: LayersIcon },
  { label: "Topics", href: "/topics", icon: BookOpen },
  { label: "Jobs", href: "/jobs", icon: Activity },
  { label: "Logs", href: "/request-logs", icon: ScrollText },
  { label: "Recommend", href: "/recommend", icon: Users },
  { label: "Report", href: "/report", icon: FileText },
];

const PLACEHOLDER_ITEMS: NavItem[] = [];

export function AppNavbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 h-14 bg-[#1c1c1e] border-b border-white/8 flex items-center px-6 gap-6">
      {/* Wordmark */}
      <Link
        href="/"
        className="flex items-center gap-2 text-white font-semibold text-sm tracking-tight shrink-0 mr-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons8-network-64.png"
          alt=""
          width={20}
          height={20}
          className="shrink-0"
        />
        Partnerships
      </Link>

      {/* Primary nav */}
      <div className="flex items-center gap-0.5 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/55 hover:text-white hover:bg-white/8"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {PLACEHOLDER_ITEMS.map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-white/30 cursor-not-allowed select-none"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </span>
        ))}
      </div>

      {/* Logout */}
      <form action={logout}>
        <button
          type="submit"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-white/55 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Log out
        </button>
      </form>
    </nav>
  );
}
