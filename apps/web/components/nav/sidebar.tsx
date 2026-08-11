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
} from "lucide-react";
import { cn } from "@ar/ui";
import { UserMenu } from "./user-menu";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

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

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="p-6 border-b border-border">
        <Link href="/" className="text-lg font-bold tracking-tight" onClick={() => setOpen(false)}>
          AeR Digital
        </Link>
        <p className="text-xs text-fg-muted mt-1">Audiolink Brasil</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "text-fg bg-surface-2 font-medium"
                  : "text-fg-muted hover:text-fg hover:bg-surface-2/50",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-border">
        <UserMenu />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="w-64 border-r border-border bg-surface flex-shrink-0 hidden md:flex flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile hamburger */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild className="md:hidden fixed top-4 left-4 z-40">
          <Button variant="ghost" size="icon" className="bg-surface border border-border">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-surface border-r border-border">
          {sidebarContent}
        </SheetContent>
      </Sheet>
    </>
  );
}
