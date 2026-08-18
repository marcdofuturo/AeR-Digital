-- Task zero: panel hardening, configuration, task synchronization and pitching jobs.

update registrations
set status = 'pendente'
where status = 'na';

alter table registrations drop constraint if exists registrations_status_check;

alter table registrations
  add constraint registrations_status_check
  check (status in ('pendente', 'em_andamento', 'concluido', 'rejeitado'));

alter table tenants add column if not exists responsible_name text;
alter table tenants add column if not exists contact_email text;
alter table tenants add column if not exists contact_phone text;

create index if not exists memberships_user_tenant_role_idx
  on memberships (user_id, tenant_id, role);

delete from tasks current_task
using tasks duplicate_task
where current_task.tenant_id = duplicate_task.tenant_id
  and current_task.release_id = duplicate_task.release_id
  and current_task.kind = duplicate_task.kind
  and current_task.id > duplicate_task.id;

create unique index if not exists tasks_tenant_release_kind_uidx
  on tasks (tenant_id, release_id, kind);

create or replace function sync_release_stage_task() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  task_title text;
  task_priority text;
  task_due_days integer;
  task_kind text;
begin
  update tasks
  set status = 'concluida', completed_at = now()
  where tenant_id = new.tenant_id
    and release_id = new.id
    and kind like 'stage:%'
    and kind <> 'stage:' || new.stage
    and status <> 'concluida';

  select
    case new.stage
      when 'em_analise' then 'Conferir metadados e materiais'
      when 'autorizacao_pendente' then 'Coletar autorizacoes dos participantes'
      when 'registrar_obra' then 'Cadastrar obra no ECAD'
      when 'registrar_fonograma' then 'Cadastrar fonograma'
      when 'pronto_p_distribuir' then 'Subir lancamento na distribuidora'
      when 'distribuido' then 'Confirmar entrega nas plataformas'
      when 'situacao_ecad' then 'Acompanhar situacao no ECAD'
    end,
    case when new.stage in ('em_analise', 'autorizacao_pendente', 'pronto_p_distribuir') then 'alta' else 'media' end,
    case new.stage
      when 'em_analise' then 2
      when 'autorizacao_pendente' then 3
      when 'registrar_obra' then 7
      when 'registrar_fonograma' then 7
      when 'pronto_p_distribuir' then 2
      when 'distribuido' then 5
      when 'situacao_ecad' then 30
    end
  into task_title, task_priority, task_due_days;

  if task_title is null then return new; end if;
  task_kind := 'stage:' || new.stage;

  insert into tasks (
    tenant_id, release_id, title, kind, status, priority,
    due_at, completed_at, auto_generated
  ) values (
    new.tenant_id, new.id, task_title, task_kind, 'aberta', task_priority,
    now() + make_interval(days => task_due_days), null, true
  )
  on conflict (tenant_id, release_id, kind) do update
  set title = excluded.title,
      status = 'aberta',
      priority = excluded.priority,
      due_at = excluded.due_at,
      completed_at = null,
      auto_generated = true;

  return new;
end $$;

drop trigger if exists trg_sync_release_stage_task on releases;
create trigger trg_sync_release_stage_task
  after insert or update of stage on releases
  for each row execute function sync_release_stage_task();

insert into tasks (
  tenant_id, release_id, title, kind, status, priority,
  due_at, auto_generated
)
select
  tenant_id,
  id,
  case stage
    when 'em_analise' then 'Conferir metadados e materiais'
    when 'autorizacao_pendente' then 'Coletar autorizacoes dos participantes'
    when 'registrar_obra' then 'Cadastrar obra no ECAD'
    when 'registrar_fonograma' then 'Cadastrar fonograma'
    when 'pronto_p_distribuir' then 'Subir lancamento na distribuidora'
    when 'distribuido' then 'Confirmar entrega nas plataformas'
    when 'situacao_ecad' then 'Acompanhar situacao no ECAD'
  end,
  'stage:' || stage,
  'aberta',
  case when stage in ('em_analise', 'autorizacao_pendente', 'pronto_p_distribuir') then 'alta' else 'media' end,
  now() + make_interval(days => case stage
    when 'em_analise' then 2
    when 'autorizacao_pendente' then 3
    when 'registrar_obra' then 7
    when 'registrar_fonograma' then 7
    when 'pronto_p_distribuir' then 2
    when 'distribuido' then 5
    when 'situacao_ecad' then 30
  end),
  true
from releases
where deleted_at is null
  and stage in (
    'em_analise', 'autorizacao_pendente', 'registrar_obra',
    'registrar_fonograma', 'pronto_p_distribuir', 'distribuido', 'situacao_ecad'
  )
on conflict (tenant_id, release_id, kind) do update
set title = excluded.title,
    priority = excluded.priority,
    auto_generated = true;
