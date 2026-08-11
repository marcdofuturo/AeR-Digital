"use client";

import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDaysInStage, deadlineColor, KANBAN_STAGES } from "@ar/ai/crm";
import type { KanbanCardData } from "./kanban-card";

interface Props {
  releases: KanbanCardData[];
}

const STAGE_LABEL: Record<string, string> = {};
for (const s of KANBAN_STAGES) STAGE_LABEL[s.id] = s.label;

export function ReleasesTable({ releases }: Props) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
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
              <TableCell colSpan={5} className="text-center text-fg-muted py-12">
                Nenhum lançamento encontrado
              </TableCell>
            </TableRow>
          ) : (
            releases.map((r) => {
              const urgency = deadlineColor(r.releaseDate);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/releases/${r.id}`}
                      className="font-medium text-fg hover:text-brand transition-colors"
                    >
                      {r.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-fg-muted text-xs">
                    {r.artists.join(", ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[11px]">
                      {STAGE_LABEL[r.stage] ?? r.stage}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-fg-muted text-xs">
                    {formatDaysInStage(r.daysInStage)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`text-xs ${
                        urgency === "red" ? "text-danger" : urgency === "amber" ? "text-warning" : "text-fg-muted"
                      }`}
                    >
                      {new Date(r.releaseDate).toLocaleDateString("pt-BR")}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
