-- Follow-up repairs for migration 003 after production review.

drop index if exists tasks_tenant_release_kind_uidx;

with ranked_stage_tasks as (
  select
    id,
    row_number() over (
      partition by tenant_id, release_id, kind
      order by created_at, id
    ) as duplicate_number
  from tasks
  where kind like 'stage:%'
)
delete from tasks task
using ranked_stage_tasks duplicate
where task.id = duplicate.id
  and duplicate.duplicate_number > 1;

create unique index if not exists tasks_tenant_release_stage_kind_uidx
  on tasks (tenant_id, release_id, kind)
  where kind like 'stage:%';

create or replace function sync_release_stage_task() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  task_title text;
  task_priority text;
  task_due_days integer;
  task_kind text;
begin
  update tasks
  set status = 'concluida', completed_at = coalesce(completed_at, now())
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
  on conflict (tenant_id, release_id, kind) where kind like 'stage:%' do update
  set title = excluded.title,
      status = 'aberta',
      priority = excluded.priority,
      due_at = excluded.due_at,
      completed_at = null,
      auto_generated = true;

  return new;
end $$;

update tasks task
set status = 'concluida',
    completed_at = coalesce(task.completed_at, now())
from releases release
where task.tenant_id = release.tenant_id
  and task.release_id = release.id
  and task.kind like 'stage:%'
  and task.kind <> 'stage:' || release.stage
  and task.status <> 'concluida';

insert into tasks (
  tenant_id, release_id, title, kind, status, priority,
  due_at, completed_at, auto_generated
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
  null,
  true
from releases
where deleted_at is null
  and stage in (
    'em_analise', 'autorizacao_pendente', 'registrar_obra',
    'registrar_fonograma', 'pronto_p_distribuir', 'distribuido', 'situacao_ecad'
  )
on conflict (tenant_id, release_id, kind) where kind like 'stage:%' do update
set title = excluded.title,
    status = 'aberta',
    priority = excluded.priority,
    due_at = excluded.due_at,
    completed_at = null,
    auto_generated = true;

drop policy if exists tenant_owner_manage on memberships;
create policy tenant_owner_manage on memberships
  for all to authenticated
  using (
    role in ('ar', 'financeiro', 'viewer')
    and auth_has_tenant_role(tenant_id, array['owner'])
  )
  with check (
    role in ('ar', 'financeiro', 'viewer')
    and auth_has_tenant_role(tenant_id, array['owner'])
  );

create or replace function save_authorization_recipient_email(
  p_tenant_id uuid,
  p_release_id uuid,
  p_recipient_id uuid,
  p_email text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  recipient_artist_id uuid;
  existing_contact_id uuid;
begin
  if p_email is null or p_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid authorization email';
  end if;

  select recipient.artist_id
  into recipient_artist_id
  from authorization_recipients recipient
  join authorizations authz
    on authz.id = recipient.authorization_id
   and authz.tenant_id = p_tenant_id
  left join artists artist
    on artist.id = recipient.artist_id
  where recipient.id = p_recipient_id
    and recipient.tenant_id = p_tenant_id
    and authz.release_id = p_release_id
    and (recipient.artist_id is null or artist.tenant_id = p_tenant_id)
  for update of recipient;

  if not found then raise exception 'authorization recipient not found'; end if;

  update authorization_recipients
  set email = lower(trim(p_email))
  where id = p_recipient_id
    and tenant_id = p_tenant_id;

  if recipient_artist_id is null then return; end if;

  update artist_contacts contact
  set is_primary = false
  where contact.artist_id = recipient_artist_id
    and contact.kind = 'email'
    and exists (
      select 1 from artists artist
      where artist.id = contact.artist_id
        and artist.tenant_id = p_tenant_id
    );

  select contact.id
  into existing_contact_id
  from artist_contacts contact
  join artists artist on artist.id = contact.artist_id
  where contact.artist_id = recipient_artist_id
    and artist.tenant_id = p_tenant_id
    and contact.kind = 'email'
    and lower(contact.value) = lower(trim(p_email))
  limit 1;

  if existing_contact_id is not null then
    update artist_contacts
    set is_primary = true
    where id = existing_contact_id;
  else
    insert into artist_contacts (artist_id, kind, value, label, is_primary)
    values (recipient_artist_id, 'email', lower(trim(p_email)), 'Liberacao', true);
  end if;
end $$;

revoke all on function save_authorization_recipient_email(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function save_authorization_recipient_email(uuid, uuid, uuid, text) to service_role;
