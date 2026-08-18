"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationFeedback() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, [pathname]);

  useEffect(() => {
    const handleNavigation = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.target === "_blank" || target.hasAttribute("download")) return;

      const destination = new URL(target.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname.startsWith("/api/")) return;
      if (destination.pathname === window.location.pathname) return;
      setLoading(true);
    };

    document.addEventListener("click", handleNavigation, true);
    return () => document.removeEventListener("click", handleNavigation, true);
  }, []);

  return loading ? (
    <div
      role="progressbar"
      aria-label="Carregando pagina"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-brand/20"
    >
      <div className="h-full w-1/3 animate-[navigation-progress_900ms_ease-in-out_infinite] bg-brand shadow-[0_0_10px_var(--color-brand)] motion-reduce:w-full motion-reduce:animate-none" />
    </div>
  ) : null;
}
