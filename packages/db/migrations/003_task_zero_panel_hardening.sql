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
  and current_task.kind like 'stage:%'
  and current_task.id > duplicate_task.id;

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
  on conflict (tenant_id, release_id, kind) where kind like 'stage:%' do update
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
on conflict (tenant_id, release_id, kind) where kind like 'stage:%' do update
set title = excluded.title,
    priority = excluded.priority,
    auto_generated = true;

create table if not exists presentation_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  release_id uuid not null references releases(id) on delete cascade,
  track_id uuid not null references tracks(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  user_guidance text,
  audio_analysis jsonb,
  result_pitch_id uuid references pitches(id) on delete set null,
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  last_error text,
  locked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists presentation_jobs_queue_idx
  on presentation_jobs (status, created_at)
  where status in ('queued', 'processing');

create index if not exists presentation_jobs_tenant_track_idx
  on presentation_jobs (tenant_id, track_id, created_at desc);

create unique index if not exists presentation_jobs_one_active_per_track_uidx
  on presentation_jobs (tenant_id, track_id)
  where status in ('queued', 'processing');

alter table presentation_jobs enable row level security;

drop policy if exists presentation_jobs_tenant_rw on presentation_jobs;

drop policy if exists presentation_jobs_service_role on presentation_jobs;
create policy presentation_jobs_service_role on presentation_jobs
  for all to service_role using (true) with check (true);

create or replace function claim_presentation_job()
returns setof presentation_jobs
language plpgsql security definer set search_path = public as $$
begin
  return query
  with candidate as (
    select id
    from presentation_jobs
    where attempt_count < 3
      and (
        status = 'queued'
        or (status = 'processing' and locked_at < now() - interval '30 minutes')
      )
    order by created_at
    for update skip locked
    limit 1
  )
  update presentation_jobs job
  set status = 'processing',
      attempt_count = job.attempt_count + 1,
      locked_at = now(),
      started_at = coalesce(job.started_at, now()),
      last_error = null,
      updated_at = now()
  from candidate
  where job.id = candidate.id
  returning job.*;
end $$;

create or replace function complete_presentation_job(
  p_job_id uuid,
  p_presentation text,
  p_analysis jsonb,
  p_audience jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  claimed_job presentation_jobs;
  created_pitch_id uuid;
begin
  select * into claimed_job
  from presentation_jobs
  where id = p_job_id
  for update;

  if not found then raise exception 'presentation job not found'; end if;
  if claimed_job.status = 'completed' then return claimed_job.result_pitch_id; end if;
  if claimed_job.status <> 'processing' then raise exception 'presentation job is not processing'; end if;

  insert into pitches (tenant_id, track_id, option_a, option_b, analysis, audience)
  values (
    claimed_job.tenant_id,
    claimed_job.track_id,
    p_presentation,
    '',
    p_analysis,
    coalesce(p_audience, '{}'::jsonb)
  )
  returning id into created_pitch_id;

  update presentation_jobs
  set status = 'completed',
      result_pitch_id = created_pitch_id,
      completed_at = now(),
      locked_at = null,
      updated_at = now()
  where id = p_job_id;

  return created_pitch_id;
end $$;

revoke all on function claim_presentation_job() from public, anon, authenticated;
grant execute on function claim_presentation_job() to service_role;
revoke all on function complete_presentation_job(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function complete_presentation_job(uuid, text, jsonb, jsonb) to service_role;

-- Resolve tenancy only from current membership rows. JWT metadata may remain
-- stale until token refresh after a membership is revoked.
create or replace function auth_tenant_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from memberships where user_id = auth.uid()
$$;

revoke all on function auth_tenant_ids() from public, anon;
grant execute on function auth_tenant_ids() to authenticated, service_role;
do $legacy_tenant_helper$
begin
  if to_regprocedure('public.auth_tenant_ids(uuid)') is not null then
    execute 'revoke all on function public.auth_tenant_ids(uuid) from public, anon, authenticated';
    execute 'grant execute on function public.auth_tenant_ids(uuid) to service_role';
  end if;
end
$legacy_tenant_helper$;

-- Replace broad authenticated writes with role-aware policies.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'artists', 'releases', 'tracks', 'track_participants', 'splits',
    'authorizations', 'authorization_recipients', 'registrations',
    'pitches', 'tasks', 'presentation_jobs'
  ] loop
    execute format('drop policy if exists tenant_rw on %I', table_name);
    execute format('drop policy if exists tenant_read on %I', table_name);
    execute format('drop policy if exists tenant_operate on %I', table_name);
    execute format($policy$
      create policy tenant_read on %I
        for select to authenticated
        using (exists (
          select 1 from memberships membership
          where membership.tenant_id = %I.tenant_id
            and membership.user_id = auth.uid()
        ))
    $policy$, table_name, table_name);
    execute format($policy$
      create policy tenant_operate on %I
        for all to authenticated
        using (exists (
          select 1 from memberships membership
          where membership.tenant_id = %I.tenant_id
            and membership.user_id = auth.uid()
            and membership.role in ('owner', 'ar')
        ))
        with check (exists (
          select 1 from memberships membership
          where membership.tenant_id = %I.tenant_id
            and membership.user_id = auth.uid()
            and membership.role in ('owner', 'ar')
        ))
    $policy$, table_name, table_name, table_name);
  end loop;

  foreach table_name in array array[
    'whatsapp_identities', 'whatsapp_sessions', 'submissions', 'activity_log'
  ] loop
    execute format('drop policy if exists tenant_rw on %I', table_name);
    execute format('drop policy if exists tenant_read on %I', table_name);
    execute format($policy$
      create policy tenant_read on %I
        for select to authenticated
        using (exists (
          select 1 from memberships membership
          where membership.tenant_id = %I.tenant_id
            and membership.user_id = auth.uid()
        ))
    $policy$, table_name, table_name);
  end loop;

  drop policy if exists tenant_rw on label_split_settings;
  drop policy if exists tenant_read on label_split_settings;
  drop policy if exists tenant_owner on label_split_settings;
  create policy tenant_read on label_split_settings
    for select to authenticated
    using (exists (
      select 1 from memberships membership
      where membership.tenant_id = label_split_settings.tenant_id
        and membership.user_id = auth.uid()
    ));
  create policy tenant_owner on label_split_settings
    for all to authenticated
    using (exists (
      select 1 from memberships membership
      where membership.tenant_id = label_split_settings.tenant_id
        and membership.user_id = auth.uid()
        and membership.role = 'owner'
    ))
    with check (exists (
      select 1 from memberships membership
      where membership.tenant_id = label_split_settings.tenant_id
        and membership.user_id = auth.uid()
        and membership.role = 'owner'
    ));
end $$;

-- Protect the tenancy directory itself. Server-side administration continues
-- through service_role, while direct authenticated access remains least-privilege.
create or replace function auth_has_tenant_role(p_tenant_id uuid, p_roles text[])
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where tenant_id = p_tenant_id
      and user_id = auth.uid()
      and role = any(p_roles)
  )
$$;

revoke all on function auth_has_tenant_role(uuid, text[]) from public, anon;
grant execute on function auth_has_tenant_role(uuid, text[]) to authenticated, service_role;

-- Artist aliases and contacts inherit tenancy from their parent artist.
alter table artist_aliases enable row level security;
drop policy if exists tenant_rw on artist_aliases;
drop policy if exists tenant_read on artist_aliases;
drop policy if exists tenant_operate on artist_aliases;
drop policy if exists service_role_bypass on artist_aliases;
create policy tenant_read on artist_aliases
  for select to authenticated
  using (exists (
    select 1 from artists artist
    where artist.id = artist_aliases.artist_id
      and artist.tenant_id in (select auth_tenant_ids())
  ));
create policy tenant_operate on artist_aliases
  for all to authenticated
  using (exists (
    select 1 from artists artist
    where artist.id = artist_aliases.artist_id
      and auth_has_tenant_role(artist.tenant_id, array['owner', 'ar'])
  ))
  with check (exists (
    select 1 from artists artist
    where artist.id = artist_aliases.artist_id
      and auth_has_tenant_role(artist.tenant_id, array['owner', 'ar'])
  ));
create policy service_role_bypass on artist_aliases
  for all to service_role using (true) with check (true);

alter table artist_contacts enable row level security;
drop policy if exists tenant_rw on artist_contacts;
drop policy if exists tenant_read on artist_contacts;
drop policy if exists tenant_operate on artist_contacts;
drop policy if exists service_role_bypass on artist_contacts;
create policy tenant_read on artist_contacts
  for select to authenticated
  using (exists (
    select 1 from artists artist
    where artist.id = artist_contacts.artist_id
      and artist.tenant_id in (select auth_tenant_ids())
  ));
create policy tenant_operate on artist_contacts
  for all to authenticated
  using (exists (
    select 1 from artists artist
    where artist.id = artist_contacts.artist_id
      and auth_has_tenant_role(artist.tenant_id, array['owner', 'ar'])
  ))
  with check (exists (
    select 1 from artists artist
    where artist.id = artist_contacts.artist_id
      and auth_has_tenant_role(artist.tenant_id, array['owner', 'ar'])
  ));
create policy service_role_bypass on artist_contacts
  for all to service_role using (true) with check (true);

alter table tenants enable row level security;
alter table profiles enable row level security;
alter table memberships enable row level security;

drop policy if exists tenant_member_read on tenants;
create policy tenant_member_read on tenants
  for select to authenticated
  using (id in (select auth_tenant_ids()));
drop policy if exists tenant_owner_update on tenants;
create policy tenant_owner_update on tenants
  for update to authenticated
  using (auth_has_tenant_role(id, array['owner']))
  with check (auth_has_tenant_role(id, array['owner']));
revoke update on tenants from authenticated;
grant update (
  name, legal_name, cnpj, logo_url,
  responsible_name, contact_email, contact_phone
) on tenants to authenticated;
drop policy if exists service_role_bypass on tenants;
create policy service_role_bypass on tenants
  for all to service_role using (true) with check (true);

drop policy if exists own_profile on profiles;
create policy own_profile on profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
drop policy if exists service_role_bypass on profiles;
create policy service_role_bypass on profiles
  for all to service_role using (true) with check (true);

drop policy if exists tenant_member_read on memberships;
create policy tenant_member_read on memberships
  for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));
drop policy if exists tenant_owner_manage on memberships;
create policy tenant_owner_manage on memberships
  for all to authenticated
  using (auth_has_tenant_role(tenant_id, array['owner']))
  with check (auth_has_tenant_role(tenant_id, array['owner']));
drop policy if exists service_role_bypass on memberships;
create policy service_role_bypass on memberships
  for all to service_role using (true) with check (true);

-- Apply an authenticated Resend reply and keep the parent checklist status
-- consistent in the same transaction.
create or replace function apply_authorization_reply(
  p_reply_token text,
  p_response_raw text,
  p_response_class jsonb,
  p_decision text,
  p_high_confidence boolean
) returns table (
  matched boolean,
  recipient_status text,
  authorization_status text
)
language plpgsql security definer set search_path = public as $$
declare
  recipient authorization_recipients;
  next_recipient_status text;
  next_authorization_status text;
begin
  select * into recipient
  from authorization_recipients
  where reply_token = p_reply_token
  for update;

  if not found then
    return query select false, null::text, null::text;
    return;
  end if;

  next_recipient_status := recipient.status;
  if p_high_confidence and p_decision = 'aprovado' then
    next_recipient_status := 'aprovado';
  elsif p_high_confidence and p_decision = 'recusado' then
    next_recipient_status := 'recusado';
  end if;

  update authorization_recipients
  set status = next_recipient_status,
      responded_at = now(),
      response_raw = p_response_raw,
      response_class = p_response_class
  where id = recipient.id;

  select case
    when bool_or(status = 'recusado') then 'recusado'
    when bool_and(status = 'aprovado') then 'aprovado'
    else 'parcial'
  end into next_authorization_status
  from authorization_recipients
  where authorization_id = recipient.authorization_id;

  update authorizations
  set status = next_authorization_status,
      resolved_at = case
        when next_authorization_status in ('aprovado', 'recusado') then now()
        else null
      end
  where id = recipient.authorization_id
    and tenant_id = recipient.tenant_id;

  return query select true, next_recipient_status, next_authorization_status;
end $$;

revoke all on function apply_authorization_reply(text, text, jsonb, text, boolean)
  from public, anon, authenticated;
grant execute on function apply_authorization_reply(text, text, jsonb, text, boolean)
  to service_role;
