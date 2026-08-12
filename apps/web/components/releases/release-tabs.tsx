"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { segment: "", label: "Visão Geral" },
  { segment: "splits", label: "Splits" },
  { segment: "autorizacao", label: "Autorização" },
  { segment: "registros", label: "Registros" },
  { segment: "pitch", label: "Apresentação" },
  { segment: "atividade", label: "Atividade" },
];

export function ReleaseTabs({ releaseId }: { releaseId: string }) {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex items-center gap-0 overflow-x-auto border-b border-border">
      {TABS.map((tab) => {
        const href = `/releases/${releaseId}${tab.segment ? `/${tab.segment}` : ""}`;
        const isActive = tab.segment
          ? pathname.endsWith(`/${tab.segment}`)
          : pathname === `/releases/${releaseId}` || pathname.endsWith(`/releases/${releaseId}`);

        return (
          <Link
            key={tab.segment}
            href={href}
            prefetch={false}
            className={`-mb-[1px] shrink-0 border-b-2 px-4 py-2.5 text-sm transition-colors ${
              isActive
                ? "border-brand font-medium text-fg"
                : "border-transparent text-fg-muted hover:border-border hover:text-fg"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
