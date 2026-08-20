"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Disc,
  Mic,
  CheckSquare,
  Settings,
  Menu,
  SkipBack,
} from "lucide-react";
import { cn } from "@ar/ui";
import { UserMenu } from "./user-menu";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/releases", label: "Lançamentos", icon: Disc },
  { href: "/artists", label: "Artistas", icon: Mic },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { href: "/config", label: "Config", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("ar-sidebar-collapsed") === "1");
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--app-sidebar-width", collapsed ? "5rem" : "16rem");
    return () => {
      document.documentElement.style.removeProperty("--app-sidebar-width");
    };
  }, [collapsed]);

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem("ar-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  const sidebarContent = (isCollapsed = false) => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={cn("border-border border-b", isCollapsed ? "p-3" : "p-6")}>
        <div
          className={cn(
            "flex items-start gap-2",
            isCollapsed ? "justify-center" : "justify-between",
          )}
        >
          {!isCollapsed && (
            <div className="min-w-0">
              <Link
                href="/"
                className="text-lg font-bold tracking-tight"
                onClick={() => setOpen(false)}
              >
                AeR Digital
              </Link>
              <p className="text-fg-muted mt-1 text-xs">Audiolink Brasil</p>
            </div>
          )}
          {isCollapsed && (
            <Link
              href="/"
              aria-label="AeR Digital"
              className="bg-surface-2 text-fg grid h-9 w-9 place-items-center rounded-md text-sm font-bold"
              onClick={() => setOpen(false)}
            >
              AeR
            </Link>
          )}
          {!open && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
              title={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
              onClick={toggleCollapsed}
              className="hidden h-8 w-8 md:inline-flex"
            >
              <SkipBack className={cn("h-4 w-4", isCollapsed && "rotate-180")} />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-1 overflow-y-auto", isCollapsed ? "p-3" : "p-4")}>
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const link = (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center rounded-md text-sm transition-colors",
                isCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
                active
                  ? "text-fg bg-surface-2 font-medium"
                  : "text-fg-muted hover:text-fg hover:bg-surface-2/50",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
          if (!isCollapsed) return link;
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* User */}
      <div className={cn("border-border border-t", isCollapsed ? "p-3" : "p-4")}>
        <UserMenu collapsed={isCollapsed} />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "border-border bg-surface sticky top-0 hidden h-screen flex-shrink-0 flex-col self-start border-r transition-[width] duration-200 md:flex",
          collapsed ? "w-20" : "w-64",
        )}
      >
        {sidebarContent(collapsed)}
      </aside>

      {/* Mobile hamburger */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild className="fixed top-4 left-4 z-40 md:hidden">
          <Button variant="ghost" size="icon" className="bg-surface border-border border">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="bg-surface border-border w-64 border-r p-0">
          {sidebarContent(false)}
        </SheetContent>
      </Sheet>
    </>
  );
}
