begin;

alter table releases
  add column if not exists cover_updated_at timestamptz;

alter table tracks
  add column if not exists audio_updated_at timestamptz,
  add column if not exists audio_analysis jsonb,
  add column if not exists audio_analysis_source_url text;

update releases
set cover_updated_at = coalesce(cover_updated_at, created_at)
where cover_url is not null;

update tracks
set audio_updated_at = coalesce(audio_updated_at, created_at)
where audio_url is not null;

with latest_analysis as (
  select distinct on (track_id)
    track_id,
    audio_analysis
  from presentation_jobs
  where status = 'completed'
    and audio_analysis is not null
  order by track_id, completed_at desc nulls last, created_at desc
)
update tracks track
set audio_analysis = latest.audio_analysis,
    audio_analysis_source_url = track.audio_url
from latest_analysis latest
where latest.track_id = track.id
  and track.audio_url is not null
  and track.audio_analysis is null;

alter table pitches
  add column if not exists credit_cost smallint not null default 2
    check (credit_cost in (0, 2));

alter table presentation_jobs
  add column if not exists credit_cost smallint not null default 2
    check (credit_cost in (0, 2));

alter table registrations
  add column if not exists ecad_code text;

alter table pitches
  drop constraint if exists pitches_option_a_max_500;
alter table pitches
  add constraint pitches_option_a_max_500
  check (char_length(option_a) <= 500) not valid;

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
  if char_length(trim(p_presentation)) = 0 or char_length(p_presentation) > 500 then
    raise exception 'presentation must contain between 1 and 500 characters';
  end if;

  insert into pitches (
    tenant_id,
    track_id,
    option_a,
    option_b,
    analysis,
    audience,
    credit_cost
  ) values (
    claimed_job.tenant_id,
    claimed_job.track_id,
    p_presentation,
    '',
    p_analysis,
    coalesce(p_audience, '{}'::jsonb),
    claimed_job.credit_cost
  )
  returning id into created_pitch_id;

  update presentation_jobs
  set status = 'completed',
      result_pitch_id = created_pitch_id,
      completed_at = now(),
      locked_at = null,
      updated_at = now()
  where id = p_job_id;

  insert into activity_log (
    tenant_id,
    actor_type,
    actor_id,
    entity_type,
    entity_id,
    action,
    before,
    after
  ) values (
    claimed_job.tenant_id,
    'ai',
    claimed_job.created_by::text,
    'track',
    claimed_job.track_id,
    'Apresentacao com IA gerada',
    null,
    jsonb_build_object(
      'pitch_id', created_pitch_id,
      'credit_cost', claimed_job.credit_cost
    )
  );

  return created_pitch_id;
end $$;

revoke all on function complete_presentation_job(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function complete_presentation_job(uuid, text, jsonb, jsonb)
  to service_role;

commit;
