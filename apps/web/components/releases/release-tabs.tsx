"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { segment: "", label: "Visão Geral" },
  { segment: "creditos", label: "Créditos" },
  { segment: "splits", label: "Splits" },
  { segment: "autorizacao", label: "Autorização" },
  { segment: "registros", label: "Registros" },
  { segment: "pitch", label: "Pitch" },
  { segment: "atividade", label: "Atividade" },
];

export function ReleaseTabs({ releaseId }: { releaseId: string }) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-0 border-b border-border mb-6 overflow-x-auto">
      {TABS.map((tab) => {
        const href = `/releases/${releaseId}${tab.segment ? `/${tab.segment}` : ""}`;
        // Active if pathname ends with this releaseId/optionalSegment
        const isActive = tab.segment
          ? pathname.endsWith(`/${tab.segment}`)
          : pathname === `/releases/${releaseId}` || pathname.endsWith(`/releases/${releaseId}`);

        return (
          <Link
            key={tab.segment}
            href={href}
            className={`px-4 py-2.5 text-sm border-b-2 -mb-[1px] transition-colors shrink-0 ${
              isActive
                ? "font-medium text-fg border-brand"
                : "text-fg-muted border-transparent hover:text-fg hover:border-border"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
