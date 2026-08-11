"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";

export function UserMenu() {
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
    <button
      onClick={handleSignOut}
      className="flex items-center gap-3 w-full text-left group"
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-surface-2 text-xs text-fg-muted">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-fg truncate">{email ?? "Carregando..."}</div>
        <div className="text-xs text-fg-muted">Sair</div>
      </div>
      <LogOut className="h-4 w-4 text-fg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}
