"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PresentationJobRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(() => router.refresh(), 5_000);
    return () => window.clearInterval(timer);
  }, [active, router]);

  return null;
}
