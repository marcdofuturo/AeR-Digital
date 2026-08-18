import type { TaskPriority } from "@ar/ai/crm";

export function priorityVariant(priority: TaskPriority): "danger" | "warning" | "info" {
  return priority === "alta" ? "danger" : priority === "media" ? "warning" : "info";
}

export function priorityFilterClass(priority: TaskPriority, active: boolean) {
  if (!active) return "border-border bg-surface text-fg-muted hover:text-fg hover:border-border/80";
  if (priority === "alta") return "border-danger bg-danger/10 text-danger";
  if (priority === "media") return "border-warning bg-warning/10 text-warning";
  return "border-info bg-info/10 text-info";
}
