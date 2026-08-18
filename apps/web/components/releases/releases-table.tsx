"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDaysInStage, deadlineColor, KANBAN_STAGES } from "@ar/ai/crm";
import type { KanbanCardData } from "./kanban-card";
import { ReleaseDetailsDialog } from "./release-details-dialog";
import { Button } from "@/components/ui/button";

interface Props {
  releases: KanbanCardData[];
}

const STAGE_LABEL: Record<string, string> = {};
for (const s of KANBAN_STAGES) STAGE_LABEL[s.id] = s.label;

function formatDateOnly(value: string) {
  const [year, month, day] = value.split("T")[0]?.split("-") ?? [];
  if (year && month && day) return `${day}/${month}/${year}`;
  return new Date(value).toLocaleDateString("pt-BR");
}

export function ReleasesTable({ releases }: Props) {
  const [selectedRelease, setSelectedRelease] = useState<KanbanCardData | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Título</TableHead>
              <TableHead>Artistas</TableHead>
              <TableHead>Estágio</TableHead>
              <TableHead>No estágio</TableHead>
              <TableHead className="text-right">Lançamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {releases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-fg-muted">
                  Nenhum lançamento encontrado
                </TableCell>
              </TableRow>
            ) : (
              releases.map((r) => {
                const urgency = deadlineColor(r.releaseDate);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Button
                        type="button"
                        variant="link"
                        aria-label={`Abrir detalhes de ${r.title}`}
                        onClick={() => setSelectedRelease(r)}
                        className="h-auto justify-start p-0 text-left font-medium text-fg hover:text-brand"
                      >
                        {r.title}
                      </Button>
                    </TableCell>
                    <TableCell className="text-xs text-fg-muted">
                      {r.artists.join(", ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px]">
                        {STAGE_LABEL[r.stage] ?? r.stage}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-fg-muted">
                      {formatDaysInStage(r.daysInStage)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`text-xs ${
                          urgency === "red" ? "text-danger" : urgency === "amber" ? "text-warning" : "text-fg-muted"
                        }`}
                      >
                        {formatDateOnly(r.releaseDate)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ReleaseDetailsDialog
        release={selectedRelease}
        onOpenChange={(open) => {
          if (!open) setSelectedRelease(null);
        }}
      />
    </>
  );
}
