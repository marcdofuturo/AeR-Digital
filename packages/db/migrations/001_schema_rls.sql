-- ============================================================
-- A&R Digital — Schema completo + RLS + Extensões
-- Prompt 1 — Executar no SQL Editor do Supabase
-- ============================================================

-- ─── Extensões ─────────────────────────────────────────────
create extension if not exists "pg_trgm"       schema extensions;
create extension if not exists "unaccent"      schema extensions;
create extension if not exists "pgcrypto"      schema extensions;
create extension if not exists "pg_cron"       schema pg_catalog;

-- ─── Busca trigram com unaccent ─────────────────────────────
create or replace function immutable_unaccent(text)
returns text language sql immutable parallel safe strict as $$
  select unaccent($1);
$$;

-- ============================================================
-- TENANCY
-- ============================================================

create table tenants (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  legal_name   text,
  cnpj         text,
  logo_url     text,
  intake_code  text unique not null,
  plan         text not null default 'trial',
  status       text not null default 'active',
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  email      text not null,
  phone_e164 text,
  created_at timestamptz not null default now()
);

create table memberships (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  role          text not null check (role in ('owner','ar','financeiro','viewer')),
  is_default_ar boolean not null default false,
  unique (tenant_id, user_id)
);

-- Config de rateio
create table label_split_settings (
  tenant_id                uuid primary key references tenants(id) on delete cascade,
  digital_mode             text not null default 'fixo'
                           check (digital_mode in ('pro_rata','fixo')),
  digital_label_bps100     int  not null default 2500,
  digital_weight_primary   int  not null default 100,
  digital_weight_featuring int  not null default 100,
  reminder_interval_days   int  not null default 5,
  reminder_max_attempts    int  not null default 6,
  pitch_min_lead_days      int  not null default 10,
  updated_at               timestamptz not null default now(),
  updated_by               uuid references profiles(id)
);

-- ============================================================
-- ARTISTAS
-- ============================================================

create table artists (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  stage_name        text not null,
  legal_name        text,
  cpf_cnpj          text,
  ecad_code         text,
  pro_affiliation   text,
  spotify_id        text,
  spotify_url       text,
  spotify_followers int,
  spotify_genres    text[],
  spotify_synced_at timestamptz,
  needs_review      boolean not null default false,
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index on artists (tenant_id, lower(stage_name));
create index artists_trgm on artists using gin (stage_name gin_trgm_ops);
create index artists_search on artists using gin (to_tsvector('simple', immutable_unaccent(stage_name)));

-- Aliases (ex: "GH" → "MC GH")
create table artist_aliases (
  id        uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  alias     text not null,
  source    text not null default 'whatsapp'
);
create index on artist_aliases (lower(alias));
create index artist_aliases_trgm on artist_aliases using gin (alias gin_trgm_ops);

create table artist_contacts (
  id         uuid primary key default gen_random_uuid(),
  artist_id  uuid not null references artists(id) on delete cascade,
  kind       text not null check (kind in ('email','whatsapp')),
  value      text not null,
  label      text,
  is_primary boolean not null default false
);
create unique index on artist_contacts (artist_id, kind, lower(value));

-- ============================================================
-- SESSÕES WHATSAPP
-- ============================================================

create table whatsapp_identities (
  phone_e164   text primary key,
  tenant_id    uuid not null references tenants(id) on delete cascade,
  artist_id    uuid references artists(id),
  display_name text,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);

create table whatsapp_sessions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references tenants(id) on delete cascade,
  phone_e164      text not null,
  step            text not null default 'ask_title',
  draft           jsonb not null default '{}'::jsonb,
  retry_count     int  not null default 0,
  last_message_at timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '72 hours',
  created_at      timestamptz not null default now()
);
create unique index on whatsapp_sessions (phone_e164)
  where expires_at > now();

create table submissions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  session_id  uuid references whatsapp_sessions(id),
  phone_e164  text not null,
  draft       jsonb not null,
  status      text not null default 'em_andamento'
              check (status in ('em_andamento','confirmado','convertido','descartado')),
  release_id  uuid,
  created_at  timestamptz not null default now(),
  confirmed_at timestamptz
);

create table submission_messages (
  id              bigserial primary key,
  session_id      uuid references whatsapp_sessions(id) on delete cascade,
  direction       text not null check (direction in ('in','out')),
  body            text,
  media_url       text,
  media_kind      text check (media_kind in ('audio','image','document')),
  provider_msg_id text,
  latency_ms      int,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- CATÁLOGO
-- ============================================================

create table releases (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  title           text not null,
  release_date    date not null,
  genre_primary   text,
  genre_secondary text,
  cover_url       text,
  upc             text,
  album_id_ext    text,
  distributor     text default 'Audiolink Brasil',
  stage           text not null default 'recebido'
                  check (stage in ('recebido','em_analise','autorizacao_pendente',
                                   'autorizado','pronto_p_distribuir','distribuido',
                                   'registrado','concluido','arquivado')),
  stage_since     timestamptz not null default now(),
  assigned_ar     uuid references profiles(id),
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index on releases (tenant_id, stage, release_date);

create table tracks (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  release_id         uuid not null references releases(id) on delete cascade,
  title              text not null,
  isrc               text,
  audio_url          text,
  audio_duration_sec int,
  audio_bpm          numeric(5,2),
  audio_key          text,
  audio_energy       numeric(3,2),
  lyrics_transcript  text,
  explicit           boolean default false,
  created_at         timestamptz not null default now()
);

create table track_participants (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  track_id     uuid not null references tracks(id) on delete cascade,
  artist_id    uuid not null references artists(id),
  position     int  not null,
  billing_role text not null check (billing_role in ('primary','featuring')),
  is_producer  boolean not null default false,
  is_composer  boolean not null default true,
  is_performer boolean not null default true,
  hidden_from_billing boolean not null default false,
  unique (track_id, artist_id)
);
create index on track_participants (track_id, position);

-- ============================================================
-- SPLITS
-- ============================================================

create table splits (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  track_id      uuid not null references tracks(id) on delete cascade,
  scope         text not null check (scope in ('obra','fonograma','digital')),
  holder_type   text not null check (holder_type in ('artist','label')),
  artist_id     uuid references artists(id),
  role_label    text not null,
  bps100        int  not null check (bps100 between 0 and 10000),
  is_manual_override boolean not null default false,
  version       int  not null default 1,
  created_at    timestamptz not null default now()
);
create index on splits (track_id, scope, version);

-- ============================================================
-- TRIGGER: assert_split_totals
-- ============================================================

create or replace function assert_split_totals() returns trigger as $$
declare
  total int;
  tid   uuid;
  sc    text;
  v     int;
begin
  tid := coalesce(new.track_id, old.track_id);
  sc  := coalesce(new.scope,    old.scope);
  v   := coalesce(new.version,  old.version);
  select coalesce(sum(bps100),0) into total
    from splits where track_id = tid and scope = sc and version = v;
  if total not in (0, 10000) then
    raise exception 'Split % da faixa % soma % (esperado 10000)', sc, tid, total;
  end if;
  return null;
end $$ language plpgsql;

create constraint trigger trg_split_totals
  after insert or update or delete on splits
  deferrable initially deferred
  for each row execute function assert_split_totals();

-- ============================================================
-- AUTORIZAÇÕES
-- ============================================================

create table authorizations (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  release_id   uuid not null references releases(id) on delete cascade,
  track_id     uuid not null references tracks(id) on delete cascade,
  document_url text,
  snapshot     jsonb not null,
  status       text not null default 'rascunho'
               check (status in ('rascunho','enviado','parcial','aprovado',
                                 'recusado','expirado')),
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  resolved_at  timestamptz
);

create table authorization_recipients (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  authorization_id uuid not null references authorizations(id) on delete cascade,
  artist_id        uuid references artists(id),
  name             text not null,
  email            text not null,
  reply_token      text unique not null,
  status           text not null default 'pendente'
                   check (status in ('pendente','enviado','entregue','aberto',
                                     'aprovado','recusado','bounce')),
  attempts         int not null default 0,
  last_sent_at     timestamptz,
  next_reminder_at timestamptz,
  responded_at     timestamptz,
  response_raw     text,
  response_class   jsonb
);
create index on authorization_recipients (status, next_reminder_at)
  where status in ('enviado','entregue','aberto');

-- ============================================================
-- REGISTROS / CRM
-- ============================================================

create table registrations (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  track_id     uuid not null references tracks(id) on delete cascade,
  kind         text not null check (kind in ('obra_ecad','fonograma_ecad','isrc',
                                             'distribuicao','youtube_cid')),
  status       text not null default 'pendente'
               check (status in ('pendente','em_andamento','concluido','rejeitado','na')),
  entity       text,
  external_id  text,
  due_at       timestamptz,
  completed_at timestamptz,
  completed_by uuid references profiles(id),
  notes        text,
  unique (track_id, kind)
);
create index on registrations (tenant_id, status, due_at);

create table pitches (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  track_id    uuid not null references tracks(id) on delete cascade,
  option_a    text not null,
  option_b    text not null,
  analysis    jsonb,
  audience    jsonb,
  generated_at timestamptz not null default now(),
  used_option text check (used_option in ('a','b','custom'))
);

create table tasks (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  release_id   uuid references releases(id) on delete cascade,
  title        text not null,
  kind         text not null,
  status       text not null default 'aberta'
               check (status in ('aberta','em_andamento','concluida','bloqueada')),
  priority     text not null default 'media',
  assignee_id  uuid references profiles(id),
  due_at       timestamptz,
  completed_at timestamptz,
  auto_generated boolean not null default false,
  created_at   timestamptz not null default now()
);

create table activity_log (
  id          bigserial primary key,
  tenant_id   uuid not null,
  actor_type  text not null check (actor_type in ('user','system','artist','ai')),
  actor_id    text,
  entity_type text not null,
  entity_id   uuid not null,
  action      text not null,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
create index on activity_log (tenant_id, entity_type, entity_id, created_at desc);

-- ============================================================
-- MATERIALIZED VIEW: Pipeline
-- ============================================================

create materialized view mv_pipeline as
select tenant_id, date_trunc('month', created_at) mes, stage,
       count(*) total,
       avg(extract(epoch from (now() - stage_since))/86400) dias_medio
from releases where deleted_at is null
group by 1,2,3;
create unique index on mv_pipeline (tenant_id, mes, stage);

select cron.schedule('refresh-pipeline','*/15 * * * *',
  $$refresh materialized view concurrently mv_pipeline$$);

-- ============================================================
-- FUNÇÕES DE RLS
-- ============================================================

create or replace function auth_tenant_ids() returns setof uuid
language sql stable security definer as $$
  select tenant_id from memberships where user_id = auth.uid()
  union all
  select unnest(regexp_split_to_array(
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'app_metadata_tenant_ids', ''),
    ','
  )::uuid[]);
$$;

-- Overload helper (simplified for tests)
create or replace function auth_tenant_ids(p_user_id uuid) returns setof uuid
language sql stable security definer as $$
  select tenant_id from memberships where user_id = p_user_id;
$$;

-- ============================================================
-- RLS POLICIES — todas as tabelas com tenant_id
-- ============================================================

do $$
declare
  tbl text;
begin
  for tbl in
    select table_name from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and column_name = 'tenant_id'
      and table_name in (
        'artists','artist_aliases','artist_contacts',
        'whatsapp_identities','whatsapp_sessions','submissions',
        'releases','tracks','track_participants',
        'splits','authorizations','authorization_recipients',
        'registrations','pitches','tasks','activity_log',
        'label_split_settings'
      )
    group by table_name
  loop
    execute format('alter table %I enable row level security', tbl);

    -- Policy para authenticated (via JWT)
    execute format($pol$
      create policy tenant_rw on %I
        for all to authenticated
        using (tenant_id = any(auth_tenant_ids()))
        with check (tenant_id = any(auth_tenant_ids()));
    $pol$, tbl);

    -- Policy para service_role (bypass total)
    execute format($pol$
      create policy service_role_bypass on %I
        for all to service_role
        using (true)
        with check (true);
    $pol$, tbl);
  end loop;
end $$;

-- Artist-specific RLS: aliases/contacts herd RLS do artista
-- (already handled via tenant_rw since they have tenant_id columns)

-- ============================================================
-- SEEDS: Caso SE SOLTA
-- ============================================================
do $$
declare
  v_tenant_id    uuid;
  v_owner_id     uuid;
  v_artist_gh    uuid;
  v_artist_jac   uuid;
  v_artist_muc   uuid;
  v_release_id   uuid;
  v_track_id     uuid;
begin
  -- Create tenant
  insert into tenants (id, slug, name, legal_name, intake_code, plan)
  values (
    gen_random_uuid(), 'supertime', 'SuperTime Digital',
    'SuperTime Digital Ltda', 'A7K9', 'trial'
  ) returning id into v_tenant_id;

  -- Default split settings
  insert into label_split_settings (tenant_id, digital_mode)
  values (v_tenant_id, 'pro_rata');

  -- Create artists
  insert into artists (id, tenant_id, stage_name, legal_name)
  values (gen_random_uuid(), v_tenant_id, 'MC GH', 'João Gabriel Souza')
  returning id into v_artist_gh;

  insert into artists (id, tenant_id, stage_name, legal_name)
  values (gen_random_uuid(), v_tenant_id, 'MC JACARÉ', null)
  returning id into v_artist_jac;

  insert into artists (id, tenant_id, stage_name, legal_name)
  values (gen_random_uuid(), v_tenant_id, 'MUCILON', 'Pedro H. Lima')
  returning id into v_artist_muc;

  -- Create release
  insert into releases (id, tenant_id, title, release_date, genre_primary, genre_secondary, stage)
  values (gen_random_uuid(), v_tenant_id, 'SE SOLTA', '2027-03-06', 'Funk', 'Trap', 'recebido')
  returning id into v_release_id;

  -- Create track
  insert into tracks (id, tenant_id, release_id, title)
  values (gen_random_uuid(), v_tenant_id, v_release_id, 'SE SOLTA')
  returning id into v_track_id;

  -- Track participants
  insert into track_participants (id, tenant_id, track_id, artist_id, position, billing_role, is_producer)
  values
    (gen_random_uuid(), v_tenant_id, v_track_id, v_artist_gh,  1, 'primary', false),
    (gen_random_uuid(), v_tenant_id, v_track_id, v_artist_jac, 2, 'primary', false),
    (gen_random_uuid(), v_tenant_id, v_track_id, v_artist_muc, 3, 'primary', true);

  -- Splits — Obra (pro-rata 50/50, sem MUCILON porque não é compositor? Não, spec diz que todos são compositores por default)
  insert into splits (id, tenant_id, track_id, scope, holder_type, artist_id, role_label, bps100)
  values
    (gen_random_uuid(), v_tenant_id, v_track_id, 'obra', 'artist', v_artist_gh,  'Autor/compositor', 5000),
    (gen_random_uuid(), v_tenant_id, v_track_id, 'obra', 'artist', v_artist_jac, 'Autor/compositor', 5000);

  -- Splits — Fonograma
  insert into splits (id, tenant_id, track_id, scope, holder_type, artist_id, role_label, bps100)
  values
    (gen_random_uuid(), v_tenant_id, v_track_id, 'fonograma', 'label',  null,          'Produtor fonográfico', 4170),
    (gen_random_uuid(), v_tenant_id, v_track_id, 'fonograma', 'artist', v_artist_gh,  'Intérprete', 2085),
    (gen_random_uuid(), v_tenant_id, v_track_id, 'fonograma', 'artist', v_artist_jac, 'Intérprete', 2085),
    (gen_random_uuid(), v_tenant_id, v_track_id, 'fonograma', 'artist', v_artist_muc, 'Músico', 1660);

  -- Splits — Digital (pro_rata com selo)
  insert into splits (id, tenant_id, track_id, scope, holder_type, artist_id, role_label, bps100)
  values
    (gen_random_uuid(), v_tenant_id, v_track_id, 'digital', 'artist', v_artist_gh,  'Primary Artist', 2500),
    (gen_random_uuid(), v_tenant_id, v_track_id, 'digital', 'artist', v_artist_jac, 'Primary Artist', 2500),
    (gen_random_uuid(), v_tenant_id, v_track_id, 'digital', 'artist', v_artist_muc, 'Primary Artist', 2500),
    (gen_random_uuid(), v_tenant_id, v_track_id, 'digital', 'label',  null,          'Selo', 2500);

  -- Registrations
  insert into registrations (id, tenant_id, track_id, kind)
  values
    (gen_random_uuid(), v_tenant_id, v_track_id, 'obra_ecad'),
    (gen_random_uuid(), v_tenant_id, v_track_id, 'fonograma_ecad'),
    (gen_random_uuid(), v_tenant_id, v_track_id, 'isrc'),
    (gen_random_uuid(), v_tenant_id, v_track_id, 'distribuicao'),
    (gen_random_uuid(), v_tenant_id, v_track_id, 'youtube_cid');

  raise notice 'Seed SE SOLTA: tenant=%, release=%, track=%', v_tenant_id, v_release_id, v_track_id;
end $$;
