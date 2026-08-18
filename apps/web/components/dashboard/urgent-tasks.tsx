import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getUrgentTasks } from "@/lib/data/dashboard";
import { taskStatusLabel } from "@ar/ai/crm";
import type { TaskPriority, TaskStatus } from "@ar/ai/crm";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";

function priorityVariant(p: TaskPriority): "danger" | "warning" | "outline" {
  const map = { alta: "danger" as const, media: "warning" as const, baixa: "outline" as const };
  return map[p];
}

async function UrgentTasksContent() {
  const tasks = await getUrgentTasks();

  if (!tasks.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarefas urgentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-fg-muted text-center py-8">
            Nenhuma tarefa pendente
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Tarefas urgentes</CardTitle>
        <Link href="/tarefas" className="text-xs text-brand hover:text-brand-hover">
          Ver todas
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tasks.map((task: any) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-surface-2/50 transition-colors"
            >
              {task.priority === "alta" && (
                <AlertTriangle className="h-4 w-4 text-danger shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-fg truncate">{task.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={priorityVariant(task.priority)} className="text-[10px]">
                    {task.priority}
                  </Badge>
                  <span className="text-xs text-fg-muted">
                    {taskStatusLabel(task.status as TaskStatus)}
                  </span>
                  {task.due_at && (
                    <span
                      className={`text-xs ${isPast(new Date(task.due_at)) ? "text-danger" : "text-fg-muted"}`}
                    >
                      {format(new Date(task.due_at), "dd/MM", { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
              {task.profiles?.full_name && (
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-surface-2">
                    {task.profiles.full_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export async function UrgentTasks() {
  return UrgentTasksContent();
}
