begin;

alter table releases
  alter column distributor drop default;

update releases
set distributor = null
where lower(btrim(distributor)) = lower('Audiolink Brasil');

update registrations
set entity = null
where kind = 'distribuicao'
  and lower(btrim(entity)) = lower('Audiolink Brasil');

alter table track_participants
  drop constraint if exists track_participants_billing_role_check;

with ranked as (
  select
    id,
    row_number() over (partition by track_id order by position, id)::int as next_position
  from track_participants
)
update track_participants participant
set position = ranked.next_position
from ranked
where ranked.id = participant.id;

update track_participants
set billing_role = case
  when position = 1 then 'principal'
  when position <= 4 then 'primary'
  else 'featuring'
end;

alter table track_participants
  add constraint track_participants_billing_role_check
  check (billing_role in ('principal', 'primary', 'featuring'));

create unique index if not exists track_participants_track_position_uidx
  on track_participants (track_id, position);

create table if not exists split_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  track_id uuid not null references tracks(id) on delete cascade,
  scope text not null check (scope in ('obra', 'fonograma', 'digital')),
  parent_artist_id uuid not null references artists(id) on delete cascade,
  beneficiary_artist_id uuid not null references artists(id) on delete cascade,
  bps100 int not null check (bps100 between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (track_id, scope, parent_artist_id, beneficiary_artist_id)
);

create index if not exists split_allocations_parent_idx
  on split_allocations (tenant_id, track_id, scope, parent_artist_id);

alter table split_allocations enable row level security;

drop policy if exists split_allocations_tenant_rw on split_allocations;
create policy split_allocations_tenant_rw on split_allocations
  for all to authenticated
  using (
    tenant_id in (select auth_tenant_ids())
    and exists (
      select 1 from tracks track
      where track.id = split_allocations.track_id
        and track.tenant_id = split_allocations.tenant_id
    )
    and exists (
      select 1 from artists parent
      where parent.id = split_allocations.parent_artist_id
        and parent.tenant_id = split_allocations.tenant_id
    )
    and exists (
      select 1 from artists beneficiary
      where beneficiary.id = split_allocations.beneficiary_artist_id
        and beneficiary.tenant_id = split_allocations.tenant_id
    )
  )
  with check (
    tenant_id in (select auth_tenant_ids())
    and exists (
      select 1 from tracks track
      where track.id = split_allocations.track_id
        and track.tenant_id = split_allocations.tenant_id
    )
    and exists (
      select 1 from artists parent
      where parent.id = split_allocations.parent_artist_id
        and parent.tenant_id = split_allocations.tenant_id
    )
    and exists (
      select 1 from artists beneficiary
      where beneficiary.id = split_allocations.beneficiary_artist_id
        and beneficiary.tenant_id = split_allocations.tenant_id
    )
  );

drop policy if exists split_allocations_service_role_bypass on split_allocations;
create policy split_allocations_service_role_bypass on split_allocations
  for all to service_role using (true) with check (true);

create or replace function assert_split_allocation_total() returns trigger
language plpgsql set search_path = public as $$
declare
  target_tenant uuid;
  target_track uuid;
  target_scope text;
  target_parent uuid;
  total int;
begin
  if tg_op in ('DELETE', 'UPDATE') then
    target_tenant := old.tenant_id;
    target_track := old.track_id;
    target_scope := old.scope;
    target_parent := old.parent_artist_id;
    select coalesce(sum(allocation.bps100), 0)::int into total
    from split_allocations allocation
    where allocation.tenant_id = target_tenant
      and allocation.track_id = target_track
      and allocation.scope = target_scope
      and allocation.parent_artist_id = target_parent;
    if total not in (0, 10000) then
      raise exception 'split allocation total must be 0 or 10000, got %', total;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    target_tenant := new.tenant_id;
    target_track := new.track_id;
    target_scope := new.scope;
    target_parent := new.parent_artist_id;
    select coalesce(sum(allocation.bps100), 0)::int into total
    from split_allocations allocation
    where allocation.tenant_id = target_tenant
      and allocation.track_id = target_track
      and allocation.scope = target_scope
      and allocation.parent_artist_id = target_parent;
    if total not in (0, 10000) then
      raise exception 'split allocation total must be 0 or 10000, got %', total;
    end if;
  end if;
  return null;
end $$;

drop trigger if exists split_allocations_total_check on split_allocations;
create constraint trigger split_allocations_total_check
  after insert or update or delete on split_allocations
  deferrable initially deferred
  for each row execute function assert_split_allocation_total();

create or replace function replace_track_participant_credits(
  p_tenant_id uuid,
  p_track_id uuid,
  p_participants jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  participant_count int;
  existing_count int;
begin
  if jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) = 0 then
    raise exception 'participants must be a non-empty array';
  end if;

  if not exists (
    select 1 from tracks track
    where track.id = p_track_id and track.tenant_id = p_tenant_id
  ) then
    raise exception 'track not found';
  end if;

  select count(*) into existing_count
  from track_participants participant
  where participant.tenant_id = p_tenant_id and participant.track_id = p_track_id;

  select count(*) into participant_count from jsonb_array_elements(p_participants);
  if participant_count <> existing_count then raise exception 'participant set mismatch'; end if;

  if exists (
    select 1
    from jsonb_array_elements(p_participants) item
    left join track_participants participant
      on participant.tenant_id = p_tenant_id
      and participant.track_id = p_track_id
      and participant.artist_id = (item->>'artist_id')::uuid
    where participant.id is null
  ) then
    raise exception 'participant set mismatch';
  end if;

  if (
    select count(distinct (item->>'artist_id')) <> participant_count
      or count(distinct (item->>'position')::int) <> participant_count
      or min((item->>'position')::int) <> 1
      or max((item->>'position')::int) <> participant_count
      or count(*) filter (where item->>'billing_role' = 'principal') <> 1
      or count(*) filter (
        where item->>'billing_role' not in ('principal', 'primary', 'featuring')
      ) > 0
      or count(*) filter (
        where (item->>'position')::int = 1 and item->>'billing_role' = 'principal'
      ) <> 1
    from jsonb_array_elements(p_participants) item
  ) then
    raise exception 'invalid participant order or billing roles';
  end if;

  update track_participants participant
  set position = participant.position + 100000
  where participant.tenant_id = p_tenant_id and participant.track_id = p_track_id;

  update track_participants participant
  set position = (payload.item->>'position')::int,
      billing_role = payload.item->>'billing_role'
  from jsonb_array_elements(p_participants) payload(item)
  where participant.tenant_id = p_tenant_id
    and participant.track_id = p_track_id
    and participant.artist_id = (payload.item->>'artist_id')::uuid;
end $$;

revoke all on function replace_track_participant_credits(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function replace_track_participant_credits(uuid, uuid, jsonb) to service_role;

create or replace function replace_split_allocations(
  p_tenant_id uuid,
  p_track_id uuid,
  p_scope text,
  p_parent_artist_id uuid,
  p_allocations jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  allocation_count int;
  allocation_total int;
begin
  if p_scope not in ('obra', 'fonograma', 'digital') then raise exception 'invalid scope'; end if;
  if jsonb_typeof(p_allocations) <> 'array' then raise exception 'allocations must be an array'; end if;

  if not exists (
    select 1 from tracks track
    where track.id = p_track_id and track.tenant_id = p_tenant_id
  ) then raise exception 'track not found'; end if;

  if not exists (
    select 1 from artists parent
    where parent.id = p_parent_artist_id and parent.tenant_id = p_tenant_id
  ) then raise exception 'parent artist not found'; end if;

  if not exists (
    select 1 from splits split
    where split.tenant_id = p_tenant_id
      and split.track_id = p_track_id
      and split.scope = p_scope
      and split.holder_type = 'artist'
      and split.artist_id = p_parent_artist_id
      and split.version = (
        select max(latest.version) from splits latest
        where latest.tenant_id = p_tenant_id
          and latest.track_id = p_track_id
          and latest.scope = p_scope
      )
  ) then raise exception 'parent artist has no current split'; end if;

  select count(*), coalesce(sum((item->>'bps100')::int), 0)::int
    into allocation_count, allocation_total
  from jsonb_array_elements(p_allocations) item
  where item->>'bps100' ~ '^[0-9]+$';

  if allocation_count <> jsonb_array_length(p_allocations) then
    raise exception 'invalid allocation percentage';
  end if;
  if allocation_count > 0 and allocation_total <> 10000 then
    raise exception 'allocation total must be 10000';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_allocations) item
    where (item->>'bps100')::int not between 0 and 10000
  ) then raise exception 'allocation percentage out of range'; end if;
  if (
    select count(distinct item->>'beneficiary_artist_id') <> allocation_count
    from jsonb_array_elements(p_allocations) item
  ) then raise exception 'duplicate beneficiary'; end if;
  if exists (
    select 1
    from jsonb_array_elements(p_allocations) item
    left join artists beneficiary
      on beneficiary.id = (item->>'beneficiary_artist_id')::uuid
      and beneficiary.tenant_id = p_tenant_id
    where beneficiary.id is null
  ) then raise exception 'beneficiary artist not found'; end if;

  delete from split_allocations allocation
  where allocation.tenant_id = p_tenant_id
    and allocation.track_id = p_track_id
    and allocation.scope = p_scope
    and allocation.parent_artist_id = p_parent_artist_id;

  insert into split_allocations (
    tenant_id, track_id, scope, parent_artist_id, beneficiary_artist_id, bps100
  )
  select
    p_tenant_id,
    p_track_id,
    p_scope,
    p_parent_artist_id,
    (item->>'beneficiary_artist_id')::uuid,
    (item->>'bps100')::int
  from jsonb_array_elements(p_allocations) item;
end $$;

revoke all on function replace_split_allocations(uuid, uuid, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function replace_split_allocations(uuid, uuid, text, uuid, jsonb) to service_role;

create or replace function save_artist_profile(
  p_tenant_id uuid,
  p_artist_id uuid,
  p_stage_name text,
  p_legal_name text,
  p_ecad_code text,
  p_release_email text,
  p_phone text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if nullif(btrim(p_stage_name), '') is null then raise exception 'stage name is required'; end if;
  if not exists (
    select 1 from artists artist
    where artist.id = p_artist_id and artist.tenant_id = p_tenant_id
  ) then raise exception 'artist not found'; end if;

  update artists artist
  set stage_name = btrim(p_stage_name),
      legal_name = nullif(btrim(p_legal_name), ''),
      ecad_code = nullif(btrim(p_ecad_code), ''),
      needs_review = nullif(btrim(p_legal_name), '') is null
  where artist.id = p_artist_id and artist.tenant_id = p_tenant_id;

  delete from artist_contacts contact
  where contact.artist_id = p_artist_id
    and contact.kind in ('email', 'whatsapp')
    and contact.is_primary;

  if nullif(btrim(p_release_email), '') is not null then
    update artist_contacts contact
    set label = 'Liberacao', is_primary = true
    where contact.artist_id = p_artist_id
      and contact.kind = 'email'
      and lower(contact.value) = lower(btrim(p_release_email));
    if not found then
      insert into artist_contacts (artist_id, kind, value, label, is_primary)
      values (p_artist_id, 'email', btrim(p_release_email), 'Liberacao', true);
    end if;
  end if;
  if nullif(btrim(p_phone), '') is not null then
    update artist_contacts contact
    set label = 'Contato', is_primary = true
    where contact.artist_id = p_artist_id
      and contact.kind = 'whatsapp'
      and lower(contact.value) = lower(btrim(p_phone));
    if not found then
      insert into artist_contacts (artist_id, kind, value, label, is_primary)
      values (p_artist_id, 'whatsapp', btrim(p_phone), 'Contato', true);
    end if;
  end if;
end $$;

revoke all on function save_artist_profile(uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function save_artist_profile(uuid, uuid, text, text, text, text, text)
  to service_role;

commit;
