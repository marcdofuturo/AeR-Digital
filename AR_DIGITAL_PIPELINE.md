# A&R Digital — Pipeline de Construção v2

**SaaS multi-tenant · Intake por WhatsApp · CRM de licenciamento, registro e distribuição**
Design system: Audiolink Brasil · Escala-alvo: 500+ gravadoras

---

## REGRAS FIXAS DO PROJETO (definidas pelo cliente — não negociáveis)

| # | Regra |
|---|---|
| R1 | O WhatsApp coleta **5 perguntas + 2 arquivos**. Nada mais. Todo o resto acontece no CRM. |
| R2 | O artista informa o **nome artístico**. O sistema localiza no banco e vincula nome artístico + nome civil no CRM. Só repergunta se vier com erro de português. |
| R3 | Ao receber a lista, devolve **nome artístico + cargo por posição** para confirmação. Posições 1–4 = primários; 5+ = featuring. |
| R4 | **Obra:** sempre pro-rata igualitário entre todos os autores. |
| R5 | **Fonograma:** padrão fixo já existente (41,70% produtor fonográfico / 41,70% intérpretes / 16,60% músicos). |
| R6 | **Digital:** dois modos configuráveis pelo selo — selo entra no pro-rata, **ou** selo com percentual fixo e o restante pro-rata. |
| R7 | **Um único número** de WhatsApp recebe todas as mensagens de todos os selos. |
| R8 | **Sem n8n.** Toda orquestração em código. |
| R9 | **Resposta instantânea.** O artista nunca espera. |
| R10 | O termo de autorização segue o modelo enviado, verbatim. |

---

# 1. ARQUITETURA

## 1.1 Stack

| Camada | Tecnologia |
|---|---|
| Frontend + API | Next.js 15 (App Router) · TypeScript strict · Tailwind v4 · shadcn/ui · Vercel |
| Banco | Supabase (Postgres 15) — RLS multi-tenant, Auth, Storage, Realtime |
| Fila / Jobs | BullMQ + Redis (Hetzner) — **substitui o n8n integralmente** |
| Agendamento | `pg_cron` (varreduras SQL) + BullMQ repeatable jobs (lógica) |
| WhatsApp | Evolution API (Docker, Hetzner) atrás de um adapter |
| IA | Claude Haiku 4.5 (validação/classificação em tempo real) · Claude Sonnet 4.6 (pitch) |
| Áudio | FastAPI + faster-whisper + librosa (Hetzner) |
| E-mail | Resend (envio + inbound webhook) |
| Documentos | Playwright headless → PDF |
| Observabilidade | Sentry + Better Stack |

## 1.2 Topologia

```
Artista ──WhatsApp──► [ NÚMERO ÚNICO DA PLATAFORMA ]
                              │
                              ▼
                     Evolution API (Hetzner)
                              │ webhook (HMAC)
                              ▼
        ┌─────────────────────────────────────────┐
        │  Next.js /api/webhooks/whatsapp         │
        │  ── responde em < 1.5s ──               │
        │  1. sendPresence("composing")  [0ms]    │
        │  2. resolve tenant + sessão    [<20ms]  │
        │  3. handler determinístico     [<80ms]  │
        │  4. LLM só quando necessário   [~600ms] │
        │  5. resposta por template      [0ms]    │
        └───────────┬─────────────────────────────┘
                    │
                    ▼
            Supabase (Postgres + RLS + Storage)
                    ▲
                    │
        ┌───────────┴──────────────┐
        │  Worker BullMQ (Hetzner) │
        │  · follow-up 5 dias      │
        │  · geração de PDF        │
        │  · envio de e-mail       │
        │  · transcrição + pitch   │
        │  · sync Spotify          │
        │  · notificação ao A&R    │
        └──────────────────────────┘
```

**Divisão dura:** o webhook do WhatsApp **nunca** enfileira nada que o artista precise esperar. Tudo o que é lento (PDF, e-mail, transcrição, pitch) roda no worker, depois da conversa.

## 1.3 Roteamento com número único

Um número, 500 selos. A identificação do tenant acontece em duas camadas:

**Camada 1 — telefone já conhecido.** Se `whatsapp_identities.phone_e164` existe, o tenant vem direto do banco. `<20ms`. Cobre todo artista recorrente.

**Camada 2 — código de intake.** Artista novo entra pelo link que o selo divulga:

```
https://wa.me/5511970416135?text=%23A7K9
```

A primeira mensagem chega como `#A7K9`, o sistema resolve o tenant por `tenants.intake_code`, grava em `whatsapp_identities` e **nunca mais pergunta**.

**Fallback.** Mensagem sem código e telefone desconhecido:

```
Oi! Pra começar, me manda o código do seu selo
(tipo #A7K9). Quem te chamou pra lançar consegue te passar.
```

## 1.4 Monorepo

```
ar-digital/
├── apps/
│   ├── web/                 Next.js — CRM + API + webhooks
│   ├── worker/              BullMQ — jobs assíncronos
│   └── audio-svc/           FastAPI — whisper + librosa
├── packages/
│   ├── db/                  Drizzle schema + migrations + RLS
│   ├── wa/                  WhatsAppProvider + máquina de estados + handlers
│   ├── splits/              Motor de rateio (puro)
│   ├── ai/                  Prompts versionados + clients Claude
│   ├── docs-gen/            Termo → HTML → PDF
│   ├── ui/                  Design system Audiolink
│   └── shared/              Zod schemas, tipos, datas (tz America/Sao_Paulo)
└── infra/
    └── docker-compose.yml   evolution-api · redis · audio-svc · caddy
```

---

# 2. MODELO DE DADOS

**Convenções:**
- Todo percentual é `int` em **bps100** (`10000 = 100,00%`). Nunca float.
- Toda tabela com `tenant_id` tem RLS.
- Documentos de licenciamento nunca são deletados (`deleted_at`).

```sql
-- ============================================================
-- TENANCY
-- ============================================================

create table tenants (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,              -- 'SuperTime Digital'
  legal_name   text,
  cnpj         text,
  logo_url     text,
  intake_code  text unique not null,       -- 'A7K9'  → wa.me/...?text=%23A7K9
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
  is_default_ar boolean not null default false,   -- recebe notificação WhatsApp
  unique (tenant_id, user_id)
);

-- Configuração de rateio: SÓ o digital é configurável (R4, R5, R6)
create table label_split_settings (
  tenant_id                uuid primary key references tenants(id) on delete cascade,
  digital_mode             text not null default 'fixo'
                           check (digital_mode in ('pro_rata','fixo')),
  digital_label_bps100     int  not null default 2500,  -- usado só em 'fixo'
  digital_weight_primary   int  not null default 100,
  digital_weight_featuring int  not null default 100,
  reminder_interval_days   int  not null default 5,
  reminder_max_attempts    int  not null default 6,
  pitch_min_lead_days      int  not null default 10,
  updated_at               timestamptz not null default now(),
  updated_by               uuid references profiles(id)
);

-- ============================================================
-- ARTISTAS (nome artístico ↔ nome civil)  [R2]
-- ============================================================

create table artists (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  stage_name        text not null,          -- 'MC JACARÉ'  ← o que o artista manda
  legal_name        text,                   -- 'João da Silva' ← vinculado no CRM
  cpf_cnpj          text,
  ecad_code         text,
  pro_affiliation   text,                   -- UBC / ABRAMUS / SBACEM
  spotify_id        text,
  spotify_url       text,
  spotify_followers int,
  spotify_genres    text[],
  spotify_synced_at timestamptz,
  needs_review      boolean not null default false,  -- criado pelo bot, sem civil
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index on artists (tenant_id, lower(stage_name));
create index artists_trgm on artists using gin (stage_name gin_trgm_ops);

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
-- SESSÕES WHATSAPP  [R7, R9]
-- ============================================================

-- Telefone → tenant. Resolve o roteamento em <20ms para recorrentes.
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
  draft           jsonb not null default '{}'::jsonb,  -- respostas acumuladas
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
  draft       jsonb not null,          -- snapshot confirmado pelo artista
  status      text not null default 'em_andamento'
              check (status in ('em_andamento','confirmado','convertido','descartado')),
  release_id  uuid,
  created_at  timestamptz not null default now(),
  confirmed_at timestamptz
);

create table submission_messages (
  id            bigserial primary key,
  session_id    uuid references whatsapp_sessions(id) on delete cascade,
  direction     text not null check (direction in ('in','out')),
  body          text,
  media_url     text,
  media_kind    text check (media_kind in ('audio','image','document')),
  provider_msg_id text,
  latency_ms    int,                   -- monitoramento de R9
  created_at    timestamptz not null default now()
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
  stage_since     timestamptz not null default now(),   -- tempo de atuação
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

-- Fonte de verdade dos três rateios
create table track_participants (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  track_id     uuid not null references tracks(id) on delete cascade,
  artist_id    uuid not null references artists(id),
  position     int  not null,
  billing_role text not null check (billing_role in ('primary','featuring')),
  is_producer  boolean not null default false,  -- → músico acompanhante no fono
  is_composer  boolean not null default true,   -- → obra (pro-rata entre todos)
  is_performer boolean not null default true,   -- → intérprete no fono
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

create or replace function assert_split_totals() returns trigger as $$
declare total int; tid uuid; sc text; v int;
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
  snapshot     jsonb not null,          -- splits congelados no envio
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
```

**RLS (aplicar em toda tabela com `tenant_id`):**

```sql
create or replace function auth_tenant_ids() returns setof uuid
language sql stable security definer as $$
  select tenant_id from memberships where user_id = auth.uid();
$$;

alter table releases enable row level security;
create policy tenant_rw on releases for all
  using      (tenant_id in (select auth_tenant_ids()))
  with check (tenant_id in (select auth_tenant_ids()));
```

Workers usam `service_role` e filtram tenant explicitamente no código.

---

# 3. FLUXO WHATSAPP — 5 PERGUNTAS, RESPOSTA INSTANTÂNEA

## 3.1 O orçamento de latência (R9)

A regra é: **nenhuma resposta pode passar de 1,5s**, e a percepção precisa ser de conversa humana. Isso se consegue tirando o LLM do caminho crítico na maioria dos turnos.

| Passo | Custo | Quando |
|---|---|---|
| `sendPresence("composing")` | ~0ms (fire-and-forget) | **Sempre**, na primeira linha do webhook |
| Resolver tenant + sessão | < 20ms | Sempre (1 query indexada) |
| Handler determinístico do passo | < 80ms | Sempre |
| Busca de artista (trigram) | < 30ms | Pergunta 2 e 3 |
| Chamada Haiku (validação PT) | ~500–700ms | **Só** perguntas 1 e 2 |
| Montar resposta (template) | ~0ms | Sempre |

**Perguntas 3, 4 e 5 não chamam LLM nenhum.** São matching determinístico. Latência real: ~100ms.

**Regra dura:** a resposta ao artista é **sempre** um template pré-escrito com interpolação. O LLM nunca gera a mensagem — só valida e normaliza. Geração de texto por LLM custaria 2–4s e destruiria R9.

## 3.2 Máquina de estados

```
                    ┌──────────────┐
  #A7K9 ───────────►│  ASK_TITLE   │  P1: nome da música
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │ ASK_ARTISTS  │  P2: participantes em ordem
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │ASK_PRODUCERS │  P3: produtores
                    └──────┬───────┘
                           ▼
              ┌────────────────────────┐
              │ ASK_PRODUCER_POSITION  │◄─┐ (loop por produtor
              └────────────┬───────────┘  │  fora da lista)
                           ▼───────────────┘
                    ┌──────────────┐
                    │  ASK_GENRES  │  P4: até 2 gêneros
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │   ASK_DATE   │  P5: data de lançamento
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │  ASK_AUDIO   │  Arquivo 1
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │  ASK_COVER   │  Arquivo 2
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │   CONFIRM    │  devolve lista + cargos
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │     DONE     │  → cria release no CRM
                    └──────────────┘
```

Estado persistido em `whatsapp_sessions.step` + `draft` (JSONB). Cada turno: lê, processa, grava, responde. Sem buffer, sem espera.

## 3.3 Os turnos, um a um

### Abertura

```
Fala! 👋 Aqui é o {SELO}.

Vou te fazer 5 perguntas rapidinhas e no fim
você me manda a música e a capa. Leva 1 minuto.

*1. Qual o nome da música?*
```

---

### P1 — Nome da música → `ASK_TITLE`

**Processamento:** `trim` → normaliza espaços → validação de português via Haiku (paralelo com a gravação da sessão).

**Prompt de validação (Haiku, `max_tokens: 200`):**

```
Verifique o título de música brasileira abaixo.
Responda APENAS JSON, sem markdown.

REGRAS:
- Corrija SOMENTE erro de ortografia claro ("SE SOULTA" → "SE SOLTA").
- NUNCA altere gíria, estrangeirismo, grafia estilizada intencional
  ("Vrau", "Kaverinha", "Trakinas", "TÁ OK") — são escolhas artísticas.
- Se estiver correto, ok=true e corrigido=null.
- Se houver erro claro, ok=false e corrigido=texto corrigido.

{"ok": bool, "corrigido": string|null, "motivo": string|null}

TÍTULO: {input}
```

**Se `ok=true`:**
```
✅ *{TÍTULO}*

*2. Quais artistas participam? Manda na ordem que
vai aparecer no título, separando por vírgula.*

Ex: MC GH, MC Jacaré, Mucilon
```

**Se `ok=false`:** repergunta uma vez (R2 — "só pedir de novo se vier com erro de português"):
```
Achei que tem um errinho: "{original}" → *{corrigido}*

Tá certo assim? Responde *SIM*, ou manda o nome
do jeito certo.
```
`SIM` aceita a correção. Qualquer outro texto vira o novo título, **sem revalidar** (evita loop). `retry_count` limita a 1.

---

### P2 — Artistas → `ASK_ARTISTS` **(o coração do R2)**

**Processamento em 3 etapas, todas rápidas:**

**Etapa A — Split determinístico (sem LLM, <5ms):**
```typescript
const RAW_SEPARATORS = /\s*(?:,|;|\/|&|\be\b|\bfeat\.?\b|\bft\.?\b|\bcom\b)\s*/gi;

function splitNames(input: string): string[] {
  return input
    .split(RAW_SEPARATORS)
    .map(s => s.replace(/^\d+[\).\-\s]+/, '').trim())  // remove "1) ", "2. "
    .filter(s => s.length >= 2)
    .slice(0, 12);
}
```

**Etapa B — Lookup no banco (paralelo, <30ms):**
```sql
-- Resolução em cascata, por nome, dentro do tenant
with exato as (
  select id, stage_name, legal_name, 1.0::float as score
  from artists
  where tenant_id = $1 and deleted_at is null
    and unaccent(lower(stage_name)) = unaccent(lower($2))
),
alias as (
  select a.id, a.stage_name, a.legal_name, 0.95::float
  from artist_aliases al join artists a on a.id = al.artist_id
  where a.tenant_id = $1 and unaccent(lower(al.alias)) = unaccent(lower($2))
),
fuzzy as (
  select id, stage_name, legal_name, similarity(stage_name, $2)::float
  from artists
  where tenant_id = $1 and deleted_at is null
    and stage_name % $2
  order by similarity(stage_name, $2) desc limit 1
)
select * from exato
union all select * from alias
union all select * from fuzzy
order by score desc limit 1;
```

Regra de decisão:

| Score | Ação |
|---|---|
| `≥ 0.90` | **Vincula** ao artista existente. Traz `legal_name` para o CRM. Se o nome digitado difere, grava alias. |
| `0.72 – 0.89` | Vincula, mas marca `needs_review=true` — o A&R confirma no CRM. O artista **não** é incomodado. |
| `< 0.72` | **Cria artista novo** com `stage_name` e `needs_review=true`, `legal_name = null`. O A&R preenche o nome civil no CRM. |

> Isto é R2 na prática: o artista manda só o nome artístico; o vínculo artístico↔civil acontece no banco e no CRM, nunca no WhatsApp.

**Etapa C — Validação de português (Haiku, ~600ms, só nos nomes NÃO encontrados):**
Nomes que casaram no banco já estão validados por definição. Só os novos passam pelo checador — e com regra ainda mais conservadora, porque nome artístico erra de propósito:

```
Nomes artísticos brasileiros. Sinalize APENAS erro de digitação
evidente (letra trocada, faltando, duplicada) — NUNCA "corrija"
estilo, gíria, abreviação ou grafia não-padrão.

"MC Jacré" → erro (falta 'a')
"Kaverinha" → correto (estilizado de propósito)
"MC GH" → correto (sigla)
"Mucilonn" → suspeito (duplicação)

JSON: {"nomes":[{"original":str,"suspeito":bool,"sugestao":str|null}]}
```

Se algum vier `suspeito=true`, repergunta **apenas aquele nome**:
```
Só confirmando: é *MC Jacré* mesmo ou é *MC Jacaré*?
Responde o nome certo.
```

**Resposta (cargo por posição — R3):**
```
✅ Anotado:
1. MC GH
2. MC Jacaré
3. Mucilon

*3. Quem produziu a música?*
Se for alguém que já tá na lista, é só falar o nome.
```

---

### P3 — Produtores → `ASK_PRODUCERS` (sem LLM)

Split pelos mesmos separadores. Para cada nome, match **contra a lista da P2** (normalizado, sem acento, case-insensitive, tolerância trigram 0.85).

**Todos na lista:** marca `is_producer=true` e segue.

**Algum fora da lista → `ASK_PRODUCER_POSITION`:**
```
O *Mucilon* produziu mas não tá na lista de artistas.

Em que posição ele entra nos créditos?

1. MC GH
2. MC Jacaré

Responde só o número (ex: 3),
ou *NÃO* se ele não deve aparecer no título.
```

| Resposta | Ação |
|---|---|
| `n` entre 1 e `len+1` | Insere na posição, reordena, recalcula cargos |
| `NÃO` / `NAO` / `N` | Cria participante com `hidden_from_billing=true`, `is_producer=true`. **Continua no split de fonograma** (16,6% de músicos) |
| Outro | Repergunta 1×; depois assume o fim da lista e sinaliza ao A&R |

Loop até esgotar os produtores fora da lista.

---

### P4 — Gêneros → `ASK_GENRES` (sem LLM)

Match determinístico contra lista canônica com `unaccent` + Levenshtein ≤ 2:

```typescript
export const GENEROS = [
  'Funk','Trap','Rap','Hip Hop','Pagode','Samba','Sertanejo','Forró',
  'Piseiro','Arrocha','Brega Funk','Funk Mandelão','Funk Bruxaria',
  'Pop','MPB','Rock','Eletrônica','House','Tecno Melody','Gospel',
  'Reggae','Axé','Trap Funk','Drill','R&B','Soul','Bregadeira',
] as const;
```

Mais de 2 → pega os 2 primeiros e avisa. Nenhum match → lista as 6 opções mais próximas para escolher por número.

```
✅ Funk · Trap

*5. Qual a data de lançamento?*
Pode mandar tipo 06/03 ou "dia 6 de março".
```

---

### P5 — Data → `ASK_DATE` (sem LLM)

Parser em cascata com `date-fns` + regex pt-BR, timezone `America/Sao_Paulo`:

1. `DD/MM/AAAA`, `DD/MM/AA`, `DD-MM-AAAA`
2. `DD/MM` → próximo futuro (se `06/03` e hoje é `05/08/2026`, resolve `06/03/2027`)
3. `"6 de março"`, `"6 de março de 2027"`
4. `"sexta"`, `"sexta que vem"`, `"semana que vem"`, `"dia 20"`
5. Falha → repergunta com exemplo explícito

**Validações:**
- Data no passado → `"Essa data já passou. Qual a data certa?"`
- Menos de 3 dias → aceita, mas marca `urgent=true` no draft e avisa o A&R.
- Mais de 18 meses → confirma (`"Lançamento em 2028 mesmo?"`).

```
✅ 06/03/2027 (sexta-feira)

Agora manda o *áudio* da música. 🎧
WAV ou MP3 320kbps.
```

---

### Arquivos → `ASK_AUDIO` / `ASK_COVER`

| Arquivo | Aceito | Validação | Erro |
|---|---|---|---|
| Áudio | WAV, FLAC, MP3 ≥320kbps | 30s–15min, não silencioso, ≥44.1kHz | `"Esse arquivo tá com {problema}. Manda de novo?"` |
| Capa | JPG, PNG | ≥3000×3000, quadrada, ≤10MB | ver abaixo |

**A armadilha da capa:** o WhatsApp recomprime imagem enviada como *foto*. A instrução precisa ser explícita:

```
Perfeito! 🎧

Agora a *capa*. Manda como *ARQUIVO/DOCUMENTO*
(no clipe 📎 → Documento), não como foto —
senão o WhatsApp estraga a qualidade.

Mínimo 3000x3000px, quadrada.
```

Se detectar dimensão < 3000px:
```
A capa chegou com {w}x{h} — o WhatsApp comprimiu.
Manda de novo como *documento* (clipe 📎 → Documento).
```

**Download da mídia é assíncrono.** O bot responde na hora (`"Recebi! ✅"`) e o worker baixa e valida em background. Se a validação falhar, manda a correção 2–3s depois. O artista nunca fica esperando barra de progresso.

---

### Confirmação → `CONFIRM` **(R3)**

```
Confere se tá tudo certo? ✅

🎵 *SE SOLTA*
📅 06/03/2027
🎼 Funk · Trap

*Créditos:*
1. MC GH — Artista principal
2. MC Jacaré — Artista principal
3. Mucilon — Artista principal · Produção

*Vai sair assim:*
MC GH, MC Jacaré & Mucilon — Se Solta

🎧 Áudio ✅
🖼️ Capa ✅

Tá certo? Responde *SIM*.
```

Com 5+ participantes:
```
1. MC GH — Artista principal
2. MC Jacaré — Artista principal
3. Mucilon — Artista principal · Produção
4. DJ TH — Artista principal
5. Kaverinha — Participação (feat.)
```

| Resposta | Ação |
|---|---|
| `SIM` / `OK` / `👍` / `isso` / `certo` | `status='confirmado'` → cria release, splits e tarefas |
| Qualquer outra coisa | Reabre o passo mais provável (heurística por palavra-chave: "ordem"/"nome" → P2, "data" → P5, "gênero" → P4, "título"/"nome da música" → P1). Máx. 3 ciclos, depois escala ao A&R |

**Encerramento:**
```
Fechou! 🎉

O time do {SELO} já recebeu. Se precisar de algo,
te chamamos por aqui.
```

## 3.4 Regra de cargos (R3)

```typescript
// packages/wa/src/roles.ts
export function assignRoles(names: ResolvedArtist[]): Participant[] {
  return names.map((a, i) => {
    const position = i + 1;
    return {
      ...a,
      position,
      billing_role: position <= 4 ? 'primary' : 'featuring',
      is_performer: true,
      is_composer:  true,      // R4: obra é pro-rata entre TODOS
      label: position <= 4 ? 'Artista principal' : 'Participação (feat.)',
    };
  });
}
```

## 3.5 Resiliência sem sacrificar velocidade

| Situação | Tratamento |
|---|---|
| Haiku demora > 1200ms | `Promise.race` com timeout → aceita o input como está e segue. Marca `needs_review` |
| Haiku indisponível | Bypass total da validação de português. O fluxo **nunca** para por causa de IA |
| Artista manda 3 mensagens seguidas | Cada uma processa no passo atual. Como cada passo é uma pergunta objetiva, não há ambiguidade |
| Artista manda áudio de voz em vez de texto | Whisper assíncrono; responde `"Só um segundo, tô ouvindo..."` e processa em ~2s |
| Artista some no meio | Lembrete em 24h e 72h. Após 7 dias, sessão expira e vira tarefa no CRM |
| Artista manda tudo de uma vez na P1 | Handler da P1 detecta múltiplos campos e preenche o draft, pulando os passos já respondidos |

---

# 4. MOTOR DE SPLITS

Três escopos, três regras diferentes. **Só o digital é configurável.**

## 4.1 Obra — pro-rata entre todos os autores (R4)

```typescript
// packages/splits/src/obra.ts
export function computeObra(participants: Participant[]): SplitLine[] {
  const autores = participants.filter(p => p.is_composer);
  if (autores.length === 0) throw new SplitError('Faixa sem autores');

  return reconcile(distributeEvenly(autores, 10000, 'Autor/compositor'));
}
```

Sem selo, sem editora, sem peso. Divisão igualitária entre todos os autores.
`SE SOLTA` com 2 autores → `[5000, 5000]` = 50% / 50%. ✓

## 4.2 Fonograma — padrão fixo (R5)

```
Produtor fonográfico (selo) .... 41,70%   → 4170 bps100
Intérpretes .................... 41,70%   → 4170, dividido igualmente
Músicos acompanhantes .......... 16,60%   → 1660, dividido igualmente
                                ────────
                                 100,00%
```

```typescript
// packages/splits/src/fonograma.ts
const FONO = { produtor: 4170, interpretes: 4170, musicos: 1660 } as const;

export function computeFonograma(
  participants: Participant[],
  labelName: string
): SplitLine[] {
  const interpretes = participants.filter(p => p.is_performer);
  const musicos     = participants.filter(p => p.is_producer);

  let poolProdutor    = FONO.produtor;
  let poolInterpretes = FONO.interpretes;

  // Sem músicos acompanhantes: os 16,60% vão proporcionalmente
  // para produtor e intérpretes (mantém a proporção 50/50 do padrão).
  if (musicos.length === 0) {
    poolProdutor    += 830;
    poolInterpretes += 830;
  }

  return reconcile([
    { holder_type: 'label', role_label: 'Produtor fonográfico',
      name: labelName, bps100: poolProdutor },
    ...distributeEvenly(interpretes, poolInterpretes, 'Intérprete'),
    ...distributeEvenly(musicos,     musicos.length ? FONO.musicos : 0, 'Músico'),
  ]);
}
```

Validação contra o caso real `SE SOLTA`:
`[4170 SuperTime, 2085 MC GH, 2085 MC Jacaré, 1660 Mucilon]` = 100,00% ✓

## 4.3 Digital — dois modos (R6)

```typescript
// packages/splits/src/digital.ts
export function computeDigital(
  participants: Participant[],
  cfg: LabelSplitSettings,
  labelName: string
): SplitLine[] {
  const weight = (p: Participant) =>
    p.billing_role === 'featuring'
      ? cfg.digital_weight_featuring
      : cfg.digital_weight_primary;

  const weighted = participants
    .filter(p => !p.hidden_from_billing)
    .map(p => ({ item: p, w: weight(p) }));

  // MODO 1 — selo entra no pro-rata, como mais um participante
  if (cfg.digital_mode === 'pro_rata') {
    const selo = { item: LABEL(labelName), w: cfg.digital_weight_primary };
    return reconcile(
      distributeByWeight([...weighted, selo], 10000).map(toLine)
    );
  }

  // MODO 2 — selo com percentual fixo, restante pro-rata
  const fixo  = cfg.digital_label_bps100;      // ex.: 2500
  const resto = 10000 - fixo;

  return reconcile([
    { holder_type: 'label', role_label: 'Selo', name: labelName, bps100: fixo },
    ...distributeByWeight(weighted, resto).map(toLine),
  ]);
}
```

**Conferência com o caso real (`SE SOLTA`, digital 25/25/25/25):**
Modo `pro_rata`, 3 participantes + selo, todos peso 100 → `[2500, 2500, 2500, 2500]` ✓

**Configuração na tela do selo:**
```
Rateio digital
○ O selo entra no pro-rata (divide igual com os artistas)
● O selo tem percentual fixo   [ 25,00 ]%   → 75,00% pro-rata entre os artistas

Peso do artista principal   [ 100 ]
Peso da participação (feat) [ 100 ]
```

Preview ao vivo com o elenco de uma faixa real. Alteração vale para **novas** faixas; faixas já autorizadas mantêm o split congelado no snapshot.

## 4.4 Aritmética exata

Sete participantes dividindo 4170 dá 595,71… Se somar errado, o termo sai com 99,99% e a distribuidora rejeita. Solução: inteiros + método do maior resto.

```typescript
// packages/splits/src/math.ts
const TOTAL = 10000;   // 100,00% em centésimos de ponto percentual

export function distributeByWeight<T>(
  items: { item: T; w: number }[], pool: number
): { item: T; bps100: number }[] {
  if (items.length === 0 || pool === 0)
    return items.map(i => ({ item: i.item, bps100: 0 }));

  const totalW = items.reduce((s, i) => s + i.w, 0);
  if (totalW === 0) return items.map(i => ({ item: i.item, bps100: 0 }));

  const raw  = items.map(i => (pool * i.w) / totalW);
  const base = raw.map(Math.floor);
  const rest = pool - base.reduce((s, v) => s + v, 0);

  // desempate determinístico: maior fração, depois menor índice
  const order = raw
    .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.idx - b.idx);

  for (let k = 0; k < rest; k++) base[order[k].idx] += 1;

  return items.map((i, idx) => ({ item: i.item, bps100: base[idx] }));
}

export const distributeEvenly = <T>(items: T[], pool: number, role: string) =>
  distributeByWeight(items.map(item => ({ item, w: 1 })), pool)
    .map(r => ({ ...toLine(r), role_label: role }));

export function reconcile(lines: SplitLine[]): SplitLine[] {
  const sum = lines.reduce((s, l) => s + l.bps100, 0);
  if (sum === TOTAL) return lines;
  const maxIdx = lines.reduce((m, l, i) => l.bps100 > lines[m].bps100 ? i : m, 0);
  lines[maxIdx].bps100 += TOTAL - sum;
  if (lines.some(l => l.bps100 < 0)) throw new SplitError('Linha negativa');
  return lines;
}

export const fmt = (bps: number) =>
  (bps / 100).toFixed(2).replace('.', ',') + '%';
```

---

# 5. CRM — PAINEL A&R

## 5.1 Design system

Extrair os hex exatos do Framer (`audiolinkbrasil.com`) antes de codar. Tokens provisórios coerentes com o site (dark-first, alto contraste, sans geométrica):

```css
@theme {
  --color-bg:        #0A0A0B;
  --color-surface:   #131316;
  --color-surface-2: #1C1C21;
  --color-border:    #26262C;
  --color-fg:        #FAFAFA;
  --color-fg-muted:  #A1A1AA;

  --color-brand:       #6D4AFF;   /* SUBSTITUIR pelo hex real */
  --color-brand-hover: #5B3AE0;

  --color-success: #22C55E;  --color-warning: #F59E0B;
  --color-danger:  #EF4444;  --color-info:    #3B82F6;

  --font-sans: 'Inter Tight', Inter, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  --radius-md: 12px; --radius-lg: 16px;
}
```

**Regra visual:** todo número financeiro em `--font-mono` com `tabular-nums`. Coluna de % que dança entre linhas é o defeito nº1 desse tipo de painel.

## 5.2 Telas

```
/login
/onboarding                  criar selo · config de rateio · gerar intake_code
/                            dashboard
/inbox                       submissões do WhatsApp (fila de triagem)
/inbox/[id]                  conversa + converter em lançamento
/releases                    kanban ⇄ tabela
/releases/[id]
   ├── /                     visão geral + checklist
   ├── /creditos             participantes, ordem, cargos, vínculo civil
   ├── /splits               3 abas: Obra · Fonograma · Digital
   ├── /autorizacao          termo, destinatários, timeline
   ├── /registros            checklist ECAD / ISRC / distribuição
   ├── /pitch                opções A/B
   └── /atividade            log
/artistas                    base + fila de "precisa de revisão"
/artistas/[id]               artístico ↔ civil, CPF, ECAD, Spotify, catálogo
/tarefas                     CRM: pendências e prazos
/relatorios                  gráficos e exportações
/config/{selo,splits,whatsapp,equipe,email,modelo}
```

## 5.3 Inbox — a tela onde o R2 se completa

Cada submissão mostra os participantes com o status do vínculo:

```
SE SOLTA · recebido há 4 min · via WhatsApp (+55 11 9xxxx-xxxx)

Participantes
┌───┬──────────────┬─────────────────────┬──────────────────────┐
│ 1 │ MC GH        │ João Gabriel Souza  │ ✅ vinculado         │
│ 2 │ MC Jacaré    │ —                   │ ⚠️ falta nome civil  │
│ 3 │ Mucilon      │ Pedro H. Lima       │ ⚠️ confirmar (0,81)  │
└───┴──────────────┴─────────────────────┴──────────────────────┘

              [ Converter em lançamento ]
```

Campo de nome civil editável inline com autocomplete na base. É aqui que o A&R fecha o vínculo artístico↔civil que o ECAD exige — e o artista nunca foi incomodado com isso.

## 5.4 Kanban

Colunas = `releases.stage`. Card:

```
┌─────────────────────────────┐
│ 🎵 SE SOLTA                 │
│ MC GH, MC Jacaré & Mucilon  │
│ 📅 06/03 · ⏳ 28 dias       │
│ ●●●○○  3/5 etapas           │
│ ⚠️ Autorização 2/3          │
│ ⏱️ 4 dias nesta etapa       │
│ 👤 Marc                     │
└─────────────────────────────┘
```

Semáforo de prazo: verde >14d, âmbar 7–14d, vermelho <7d.
`⏱️ dias nesta etapa` vem de `stage_since` — é o "tempo de atuação em cada música".

## 5.5 Editor de splits

Três abas. Total validado em tempo real; salvar bloqueado fora de 100,00% com o delta visível (`falta 0,03%`). Botões: **Redistribuir o resto**, **Restaurar padrão**. Override cria nova `version` e registra em `activity_log`.

## 5.6 Checklist de registros

```
☑ Obra cadastrada       UBC       #2847193   21/03/2027  Marc
☑ Fonograma cadastrado  ABRAMUS   #FN88214   21/03/2027  Marc
☑ ISRC gerado           BR-XYZ-27-00001
☑ Distribuição enviada  Audiolink ALB-99213  22/03/2027  Marc
☐ YouTube Content ID    —         pendente   vence 05/04
```

Toggle grava `completed_at`, `completed_by`, `external_id`. Marcação retroativa permitida.

## 5.7 Dashboard

- **Cartões:** lançamentos ativos · autorizações pendentes · registros pendentes · prazo médio recebimento→distribuição.
- **Crescimento do catálogo:** área empilhada, faixas/mês por status.
- **Funil:** submissões → convertidas → autorizadas → distribuídas → registradas.
- **Tempo médio por etapa:** barras horizontais com linha de SLA.
- **Pendências com prazo:** tabela ordenada por urgência, ação inline.

Agregações em materialized views com `pg_cron` a cada 15 min. Não calcular em tempo real com 500 tenants.

```sql
create materialized view mv_pipeline as
select tenant_id, date_trunc('month', created_at) mes, stage,
       count(*) total,
       avg(extract(epoch from (now() - stage_since))/86400) dias_medio
from releases where deleted_at is null
group by 1,2,3;
create unique index on mv_pipeline (tenant_id, mes, stage);

select cron.schedule('refresh-pipeline','*/15 * * * *',
  $$refresh materialized view concurrently mv_pipeline$$);
```

## 5.8 Automações — em código, não em n8n (R8)

Todas as regras vivem em `apps/worker/src/rules/`, como funções tipadas e testáveis, disparadas por eventos de domínio.

```typescript
// apps/worker/src/rules/index.ts
export const RULES: Rule[] = [
  {
    id: 'cria-tarefas-pos-autorizacao',
    on: 'release.stage_changed',
    when: e => e.to === 'autorizado',
    run: async (e, ctx) => {
      await ctx.tasks.createMany(e.tenantId, e.releaseId, [
        { title: 'Subir na distribuidora',   kind: 'upload',      dueInDays: 2 },
        { title: 'Cadastrar obra no ECAD',   kind: 'reg_obra',    dueInDays: 7 },
        { title: 'Cadastrar fonograma',      kind: 'reg_fono',    dueInDays: 7 },
      ]);
    },
  },
  {
    id: 'alerta-prazo-lancamento',
    on: 'cron.daily',
    run: async (_, ctx) => {
      const risco = await ctx.releases.dueWithin(7, ['recebido','em_analise',
                                                     'autorizacao_pendente']);
      for (const r of risco) {
        await ctx.tasks.upsertCritical(r, 'Lançamento em risco');
        await ctx.notify.ar(r.tenantId, alertaPrazo(r));
      }
    },
  },
  {
    id: 'obra-nao-registrada-30d',
    on: 'cron.daily',
    when: () => true,
    run: async (_, ctx) => {
      const pendentes = await ctx.registrations.overdueAfterRelease(30, 'obra_ecad');
      for (const p of pendentes) await ctx.notify.ar(p.tenantId, receitaEmRisco(p));
    },
  },
];
```

Registro único, cobertura por teste, deploy versionado. Adicionar regra = adicionar objeto no array.

---

# 6. TERMO DE AUTORIZAÇÃO

## 6.1 Template (modelo enviado, verbatim — R10)

`packages/docs-gen/templates/autorizacao.hbs`

```handlebars
Olá, pessoal!
Espero que estejam bem.

Sou o {{ar.nome}}, A&R da {{selo.nome}} e neste documento represento o selo
e os artistas {{artistas_principais}}.

Venho por meio deste solicitar, de forma oficial, a autorização para o
lançamento digital da faixa abaixo;

Todos os detalhes do lançamento seguem especificados a seguir:

**Autorização de Distribuição Digital**

| Nome da Faixa:      | {{track.titulo}} |
| Artistas:           | {{creditos}} |
| Data de Lançamento: | {{release.data}} |
| Agregadora:         | {{release.distribuidora}} |
| ISRC:               | {{#if track.isrc}}{{track.isrc}}{{else}}à gerar{{/if}} |
| ID do Álbum:        | {{#if release.album_id}}{{release.album_id}}{{else}}à gerar{{/if}} |
| Link da Faixa:      | [{{track.arquivo_nome}}]({{track.link}}) |

**Obra**

| **ID** | **Artista** | **Classe** | **Participação (%)** |
{{#each splits.obra}}
| {{id}} | {{nome}} | {{classe}} | {{pct}} |
{{/each}}
|  |  | ***Total:*** | 100% |

**Fonograma**

| **ID** | **Artista** | **Classe** | **Participação (%)** |
{{#each splits.fonograma}}
| {{id}} | {{nome}} | {{classe}} | {{pct}} |
{{/each}}
|  |  | ***Total:*** | 100% |

**Digital**

| **ID** | **Artista** | **Classe** | **Participação (%)** |
{{#each splits.digital}}
| {{id}} | {{nome}} | {{classe}} | {{pct}} |
{{/each}}
|  |  | ***Total:*** | 100% |

Caso todos estejam de acordo com o lançamento, por gentileza, responder este
e-mail com a seguinte mensagem:
"Eu, [NOME] sou responsável pelo [ARTISTA], autorizo este lançamento."

Solicito também que seja preenchido o nosso formulário de cadastro:

  - CPF
  - E-mails para repasse de royalties e respectivas porcentagens de
    empresários e agenciadores
  - Telefone para contato (WhatsApp)

Qualquer dúvida, estou à disposição.
```

**Mapeamento de `classe` por escopo:**

| Escopo | Classe |
|---|---|
| Obra | `Autor/compositor` |
| Fonograma | `Intérprete` · `Músico` · `Produtor fonográfico` |
| Digital | `Main Artist` (pos. 1) · `Primary Artist` (2–4) · `Featured Artist` (5+) · `Selo` |

## 6.2 Geração e envio

- **Snapshot imutável:** ao gerar, congela splits e participantes em `authorizations.snapshot`. Alteração posterior não muda o documento enviado.
- **PDF:** Handlebars → HTML (mesmo CSS do preview no painel) → Playwright headless → PDF. Storage privado, signed URL de 7 dias.
- **Nome:** `Autorizacao_{TITULO}_{SELO}_{AAAAMMDD}.pdf`
- **Ações no painel:** enviar por e-mail (1 clique se os e-mails já estão na base), adicionar destinatário na hora, ou baixar o PDF para mandar por fora.

## 6.3 Rastreamento de resposta (VERP)

```
De:        {selo} via A&R Digital <naoresponda@mail.{dominio}>
Responder: auth+{reply_token}@inbox.{dominio}
Assunto:   Autorização de lançamento — SE SOLTA (06/03/2027)
```

Cada destinatário tem `reply_token` único. O inbound webhook do Resend identifica exatamente **quem** respondeu, mesmo que o e-mail venha de outro endereço ou encaminhado.

```
POST /api/webhooks/email/inbound
  ├─ valida assinatura do Resend       ← obrigatório
  ├─ extrai reply_token do campo "to"
  ├─ limpa quoted reply e assinatura
  ├─ classifica (Claude Haiku)
  ├─ atualiza recipient + authorization
  └─ enfileira notificação WhatsApp ao A&R
```

**Classificador:**

```
Classifique a resposta a um pedido de autorização de lançamento musical.
JSON apenas:
{"decisao":"aprovado"|"recusado"|"condicional"|"duvida"|"indefinido",
 "nome_declarado":str|null,"artista_declarado":str|null,
 "condicoes":[str],"resumo":str,"confianca":number}

- "aprovado" só com consentimento inequívoco ao lançamento.
- Pedido de mudança de %, data ou crédito = "condicional".
- Nunca infira aprovação de agradecimento, emoji ou silêncio.
- confianca < 0.8 → "indefinido".
```

`indefinido` e `condicional` **nunca** aprovam automaticamente — vão para revisão do A&R.

> **Ponto de segurança inegociável:** sem validação de assinatura do webhook, qualquer um forja um "autorizo" e cria autorização fraudulenta. É o risco mais grave do sistema.

## 6.4 Follow-up a cada 5 dias

```sql
-- pg_cron a cada 15 min → enfileira no BullMQ
select cron.schedule('reminder-sweep', '*/15 * * * *', $$
  select enqueue_reminders()
$$);
```

```typescript
// apps/worker/src/jobs/reminder.ts
const pendentes = await db.query(`
  SELECT r.*, a.tenant_id, s.reminder_interval_days, s.reminder_max_attempts
  FROM authorization_recipients r
  JOIN authorizations a ON a.id = r.authorization_id
  JOIN label_split_settings s ON s.tenant_id = a.tenant_id
  WHERE r.status IN ('enviado','entregue','aberto')
    AND r.next_reminder_at <= now()
    AND r.attempts < s.reminder_max_attempts
  FOR UPDATE SKIP LOCKED
`);
```

**Regras:**
- Intervalo contado a partir do **último envio**, não da criação.
- **Só em horário comercial** — 09:00–19:00, seg–sex, `America/Sao_Paulo`. Fora disso, empurra para a próxima janela útil. Cobrança às 3h destrói taxa de resposta.
- Escalada de tom, frequência constante:
  1. lembrete cordial
  2. reforça a data de lançamento
  3. avisa que o lançamento pode ser adiado
  4. copia o A&R e sugere contato por WhatsApp
- **Para automaticamente** com: resposta recebida, bounce permanente, lançamento cancelado, `attempts >= max`, ou data de lançamento já passada.
- Esgotou sem resposta → `status='expirado'` + tarefa crítica + alerta.

## 6.5 Notificação ao A&R

```
📬 *Autorização respondida*

🎵 SE SOLTA
👤 MC Jacaré (joao@email.com)

✅ *APROVADO*
"Eu, João Silva, sou responsável pelo MC Jacaré,
autorizo este lançamento."

📊 2 de 3 aprovados
⏳ Falta: Mucilon (enviado há 3 dias)
📅 Lançamento em 28 dias
```

```
🎉 *Autorização completa!*
SE SOLTA — 3 de 3 aprovados.
Liberado para subir na distribuidora.
```

Enviada pelo mesmo número único, ao usuário com `is_default_ar = true`. **Agrupamento:** 3+ eventos em 10 min viram uma mensagem só.

---

# 7. AGENTE DE PITCHING

## 7.1 Elegibilidade

```typescript
const dias = differenceInCalendarDays(release.release_date, submission.created_at);
const elegivel = dias >= cfg.pitch_min_lead_days;  // 10
```

Não elegível → painel explica:
> *"Pitch indisponível: enviado 6 dias antes do lançamento (mínimo: 10)."*

## 7.2 Pipeline

```
        ┌─ [A] Transcrição — faster-whisper large-v3, pt-BR
        │      → letra, temas, gírias
        │
Faixa ──┼─ [B] Sinal — librosa
        │      → BPM, tom, energia, brilho, estrutura, gancho
        │
        ├─ [C] Spotify Web API (por participante)
        │      → seguidores, gêneros, popularidade, relacionados
        │
        └─ [D] Catálogo interno
               → histórico do selo, faixas similares
                        │
                        ▼
            [E] Síntese — Claude Sonnet 4.6
                        │
                        ▼
              2 opções ≤ 500 caracteres
```

```python
# apps/audio-svc/analyze.py
from faster_whisper import WhisperModel
import librosa, numpy as np

model = WhisperModel("large-v3", device="cpu", compute_type="int8")
segments, _ = model.transcribe(
    path, language="pt", vad_filter=True,
    initial_prompt="Letra de música brasileira. Funk, trap, rap."
)

y, sr   = librosa.load(path, sr=22050, mono=True)
tempo,_ = librosa.beat.beat_track(y=y, sr=sr)
chroma  = librosa.feature.chroma_cqt(y=y, sr=sr)
energy  = float(np.mean(librosa.feature.rms(y=y)))
onset   = librosa.onset.onset_strength(y=y, sr=sr)
hook_at = int(np.argmax(onset[len(onset)//3:]) + len(onset)//3) * 512 / sr
```

> O `initial_prompt` é essencial: sem ele o Whisper "corrige" gíria de funk para português formal e a letra sai inútil.

**Ganho colateral:** `lyrics_transcript` alimenta o campo de letra do cadastro de obra — hoje digitado à mão ou simplesmente não preenchido.

## 7.3 Prompt de síntese

```
Você escreve pitches para playlists editoriais brasileiras.
Escreve para um curador que lê 200 pitches por dia.

FAIXA: {titulo} · {creditos} · {generos} · lança {data}
SINAL: {bpm} BPM · tom {key} · energia {energy}/1.0 · gancho aos {hook}s
LETRA (trecho): {transcript_500}
AUDIÊNCIA: {por artista: seguidores, gêneros, popularidade, relacionados}

REGRAS
- Máx. 500 caracteres por opção (limite do Spotify for Artists).
- Português brasileiro, direto. Zero adjetivo vazio ("incrível",
  "imperdível", "sensação"). Curador ignora hype.
- Inclua: o que a faixa É sonoramente · por que agora · prova de tração
  se houver.
- NUNCA invente streams, playlist, prêmio ou parceria.

DUAS OPÇÕES, ÂNGULOS DIFERENTES
A) SONORO — produção, referências, encaixe de playlist
B) NARRATIVO — momento do artista, cena, audiência

JSON: {"opcao_a":str,"opcao_b":str,"angulo_a":str,"angulo_b":str,
       "playlists_sugeridas":[str],"avisos":[str]}
```

Painel: duas caixas lado a lado, contador de caracteres, **Copiar**, **Regenerar com ajuste** (campo livre). Ao copiar, grava `used_option` — vira métrica de qualidade do agente.

---

# 8. ESCALA E CUSTOS

## 8.1 Alvo (500 selos)

| Métrica | Valor |
|---|---|
| Faixas/mês | ~4.000 |
| Mensagens WhatsApp/mês | ~60.000 |
| E-mails/mês | ~25.000 |
| Chamadas Haiku/mês | ~30.000 |
| Transcrições/mês | 4.000 |
| Storage/ano | ~2 TB |

## 8.2 Gargalos

| Gargalo | Solução |
|---|---|
| **Número único = ponto único de falha** | Health check a cada 60s · fila persistente (nada se perde) · QR de reconexão no painel · número reserva pré-aquecido em standby |
| Rate limit do WhatsApp | Máx. 20 msg/min por instância, jitter 800–2500ms. Como o bot **só responde** (nunca inicia), o risco é baixo |
| Transcrição em CPU | Fila dedicada, concorrência 2. Acima de 500/mês → Groq Whisper API |
| Storage de WAV | Lifecycle: WAV → B2/Glacier após 90 dias; manter MP3 320 para o player |
| Conexões Postgres | Supavisor em transaction mode desde o dia 1 |
| Dashboard | Materialized views + `pg_cron` (já previsto) |

## 8.3 Custos mensais

| Item | 10 selos | 500 selos |
|---|---|---|
| Hetzner | €14 (CPX31) | €120 (2× CPX51 + LB) |
| Supabase | US$25 | ~US$600 |
| Vercel | US$20 | ~US$150 |
| Claude API | ~US$25 | ~US$550 |
| Whisper | €0 (self-host) | ~US$120 (Groq) |
| Resend | US$20 | ~US$180 |
| Storage frio | US$5 | ~US$120 |
| Sentry/logs | US$26 | ~US$120 |
| **Total** | **~US$140** | **~US$1.960** |

A R$149/selo/mês × 500 = R$74.500 de receita bruta. Margem de infra ~85%.

---

# 9. ROADMAP

| Fase | Semanas | Entregável |
|---|---|---|
| **0 — Fundação** | 1–2 | Monorepo, schema + RLS, auth, design system, CI com testes de isolamento |
| **1 — Intake WhatsApp** | 3–7 | 5 perguntas + 2 arquivos funcionando ponta a ponta, resposta < 1,5s, submissão virando lançamento. **MVP demonstrável** |
| **2 — Splits + Autorização** | 8–12 | Motor de rateio, config do selo, termo em PDF, envio, VERP, classificador, follow-up de 5 dias, notificação ao A&R |
| **3 — CRM** | 13–17 | Kanban, checklist, tarefas, dashboards, PWA, base de artistas com vínculo civil |
| **4 — Pitching** | 18–21 | audio-svc, Spotify, agente de síntese, tela de pitch |
| **5 — Escala** | 22–26 | Onboarding self-service, faturamento, hardening, integração com o painel Audiolink |

**Sequenciamento crítico:** não construir a Fase 4 antes da Fase 2 estar em produção com um selo real usando. Pitching impressiona na demo; autorização é o que faz o selo pagar.

---

# 10. PROMPTS DE EXECUÇÃO

Os prompts prontos para o Claude Code estão no arquivo `PROMPT_CLAUDE_CODE.md`,
que acompanha este documento. Sequência: Prompt Mestre (vai no `CLAUDE.md` do
repositório) → Prompt 0 (bootstrap) → 1 (schema/RLS) → 2 (splits) → 3 (intake) →
4 (autorização) → 5 (CRM) → 6 (pitching).

Cada prompt tem critério de aceite explícito. Não avance sem ele.
