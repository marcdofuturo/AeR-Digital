import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getTasks } from "@/lib/data/tasks";
import { getCurrentTenantId } from "@/lib/tenant";
import { taskStatusLabel } from "@ar/ai/crm";
import type { TaskStatus, TaskPriority } from "@ar/ai/crm";
import { fmtDate } from "@ar/shared";
import { ListChecks } from "lucide-react";
import { priorityFilterClass, priorityVariant } from "@/lib/tasks/priority-style";

interface TarefasPageProps {
  searchParams: Promise<{ status?: string; prioridade?: string }>;
}

const FILTER_TABS = [
  { label: "Todas", status: "" },
  { label: "Abertas", status: "aberta" },
  { label: "Em Andamento", status: "em_andamento" },
  { label: "Bloqueadas", status: "bloqueada" },
];

const PRIORITIES: TaskPriority[] = ["alta", "media", "baixa"];

async function TasksTable({ status, priority }: { status?: string; priority?: string }) {
  const tenantId = await getCurrentTenantId();
  const tasks = await getTasks(tenantId ?? undefined, { status, priority });

  if (!tasks.length) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="flex justify-center mb-3">
            <ListChecks className="h-10 w-10 text-fg-muted" />
          </div>
          <p className="text-fg-muted mb-1">Nenhuma tarefa encontrada</p>
          <p className="text-sm text-fg-muted">
            Tarefas são geradas automaticamente conforme os lançamentos avançam no pipeline.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          <TableHead>Lançamento</TableHead>
          <TableHead>Prioridade</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Responsável</TableHead>
          <TableHead className="text-right">Prazo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((t: any) => (
          <TableRow key={t.id}>
            <TableCell className="font-medium text-fg text-sm max-w-[300px] truncate">
              {t.title}
            </TableCell>
            <TableCell>
              {t.releases && (
                <Link href={`/releases/${t.release_id}`} className="text-xs text-brand hover:underline">
                  {t.releases.title}
                </Link>
              )}
            </TableCell>
            <TableCell>
              <Badge variant={priorityVariant(t.priority)} className="text-[10px]">
                {t.priority}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  t.status === "concluida" ? "success" :
                  t.status === "bloqueada" ? "danger" :
                  t.status === "em_andamento" ? "warning" : "secondary"
                }
                className="text-[10px]"
              >
                {taskStatusLabel(t.status as TaskStatus)}
              </Badge>
            </TableCell>
            <TableCell>
              {t.profiles?.full_name ? (
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px] bg-surface-2">
                      {t.profiles.full_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-fg-muted">{t.profiles.full_name}</span>
                </div>
              ) : (
                <span className="text-xs text-fg-muted">—</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              {t.due_at ? (
                <span className={`text-xs ${new Date(t.due_at) < new Date() ? "text-danger" : "text-fg-muted"}`}>
                  {fmtDate(t.due_at, "dd/MM")}
                </span>
              ) : (
                <span className="text-xs text-fg-muted">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function TarefasPage({ searchParams }: TarefasPageProps) {
  const { status, prioridade } = await searchParams;

  return (
    <div className="p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-fg">Tarefas</h1>
          <p className="text-sm text-fg-muted mt-1">
            Gerencie as tarefas do pipeline de lançamentos
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.status}
            href={tab.status ? `/tarefas?status=${tab.status}` : "/tarefas"}
            className={`px-4 py-2 rounded-md text-sm border transition-colors ${
              (status ?? "") === tab.status
                ? "border-brand bg-brand/10 text-brand"
                : "border-border bg-surface text-fg-muted hover:text-fg hover:border-border/80"
            }`}
          >
            {tab.label}
          </Link>
        ))}

        <div className="ml-auto flex gap-2">
          {PRIORITIES.map((p) => {
            const isActive = prioridade === p;
            const href = isActive
              ? `/tarefas${status ? `?status=${status}` : ""}`
              : `/tarefas?prioridade=${p}${status ? `&status=${status}` : ""}`;
            return (
              <Link
                key={p}
                href={href}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${priorityFilterClass(p, isActive)}`}
              >
                {p}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <Card>
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
          <TasksTable status={status} priority={prioridade} />
        </Suspense>
      </Card>
    </div>
  );
}
