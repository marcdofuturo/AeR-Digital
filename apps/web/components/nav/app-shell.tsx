"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";

const SHELL_FREE_PATH_PREFIXES = ["/login", "/auth", "/onboarding", "/envio"];

function isAuthPath(pathname: string | null) {
  if (!pathname) return false;

  return SHELL_FREE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isAuthPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex bg-bg text-fg">
      <Sidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
