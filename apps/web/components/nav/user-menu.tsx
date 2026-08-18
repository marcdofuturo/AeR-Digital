"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const [email, setEmail] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? null);
      }
    });
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = email
    ? email.slice(0, 2).toUpperCase()
    : "??";

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={handleSignOut}
      aria-label={collapsed ? "Sair" : undefined}
      title={collapsed ? email ?? "Sair" : undefined}
      className={`group h-auto w-full items-center gap-3 px-1 py-1 text-left ${collapsed ? "justify-center" : "justify-start"}`}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-surface-2 text-xs text-fg-muted">
          {initials}
        </AvatarFallback>
      </Avatar>
      {!collapsed && (
        <>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-fg truncate">{email ?? "Carregando..."}</div>
            <div className="text-xs text-fg-muted">Sair</div>
          </div>
          <LogOut className="h-4 w-4 text-fg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </>
      )}
    </Button>
  );
}
