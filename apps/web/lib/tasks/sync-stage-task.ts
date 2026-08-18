import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReleaseStage } from "@ar/shared";

type TaskPriority = "alta" | "media" | "baixa";

type StageTaskDefinition = {
  kind: string;
  title: string;
  priority: TaskPriority;
  dueInDays: number;
};

const STAGE_TASKS: Partial<Record<ReleaseStage, Omit<StageTaskDefinition, "kind">>> = {
  em_analise: { title: "Conferir metadados e materiais", priority: "alta", dueInDays: 2 },
  autorizacao_pendente: { title: "Coletar autorizacoes dos participantes", priority: "alta", dueInDays: 3 },
  registrar_obra: { title: "Cadastrar obra no ECAD", priority: "media", dueInDays: 7 },
  registrar_fonograma: { title: "Cadastrar fonograma", priority: "media", dueInDays: 7 },
  pronto_p_distribuir: { title: "Subir lancamento na distribuidora", priority: "alta", dueInDays: 2 },
  distribuido: { title: "Confirmar entrega nas plataformas", priority: "media", dueInDays: 5 },
  situacao_ecad: { title: "Acompanhar situacao no ECAD", priority: "media", dueInDays: 30 },
};

const STAGE_TASK_KINDS = Object.keys(STAGE_TASKS).map((stage) => `stage:${stage}`);

export function stageTaskDefinition(stage: ReleaseStage): StageTaskDefinition | null {
  const task = STAGE_TASKS[stage];
  return task ? { kind: `stage:${stage}`, ...task } : null;
}

export async function syncReleaseStageTask(
  client: SupabaseClient,
  input: { tenantId: string; releaseId: string; stage: ReleaseStage },
) {
  const definition = stageTaskDefinition(input.stage);
  const previousKinds = STAGE_TASK_KINDS.filter((kind) => kind !== definition?.kind);
  const { error: completionError } = await client
    .from("tasks")
    .update({ status: "concluida", completed_at: new Date().toISOString() })
    .eq("tenant_id", input.tenantId)
    .eq("release_id", input.releaseId)
    .in("kind", previousKinds);
  if (completionError) throw new Error("Falha ao concluir tarefas da etapa anterior");

  if (!definition) return;
  const dueAt = new Date(Date.now() + definition.dueInDays * 86_400_000).toISOString();
  const { error } = await client.from("tasks").upsert(
    {
      tenant_id: input.tenantId,
      release_id: input.releaseId,
      title: definition.title,
      kind: definition.kind,
      status: "aberta",
      priority: definition.priority,
      due_at: dueAt,
      completed_at: null,
      auto_generated: true,
    },
    { onConflict: "tenant_id,release_id,kind" },
  );
  if (error) throw new Error("Falha ao criar tarefa da etapa atual");
}
