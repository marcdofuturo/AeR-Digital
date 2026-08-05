# Prompts de Execução — Claude Code

> **Como usar:** coloque `AR_DIGITAL_PIPELINE.md` na raiz do repositório. Rode os prompts **em ordem**, um por sessão. Ao fim de cada um, valide o critério de aceite antes de seguir. Não pule etapas — o Prompt 3 depende dos testes do Prompt 2 estarem verdes.

---

## PROMPT MESTRE (contexto permanente — cole no `CLAUDE.md` do projeto)

```markdown
# A&R Digital — Contexto do Projeto

SaaS multi-tenant para selos e gravadoras brasileiras. Artistas enviam
lançamentos pelo WhatsApp; o A&R gerencia licenciamento, registro e
distribuição num CRM web.

A especificação completa está em `AR_DIGITAL_PIPELINE.md`. Consulte antes
de qualquer decisão de arquitetura ou modelagem.

## Regras invioláveis

1. **5 perguntas + 2 arquivos no WhatsApp.** Nome da música, participantes
   em ordem, produtores, até 2 gêneros, data de lançamento, áudio, capa.
   NUNCA adicione uma 6ª pergunta. Todo dado adicional é preenchido no CRM.

2. **Resposta ao artista em menos de 1,5s.** O LLM só entra no caminho
   crítico nas perguntas 1 e 2, e com timeout de 1200ms e bypass em caso
   de falha. As respostas ao artista são SEMPRE templates pré-escritos com
   interpolação — o LLM nunca gera a mensagem enviada.

3. **Percentuais são inteiros em bps100** (10000 = 100,00%). Jamais float,
   jamais numeric. Toda distribuição usa método do maior resto e soma
   exatamente 10000.

4. **Splits:**
   - Obra: pro-rata igualitário entre todos os autores. Não configurável.
   - Fonograma: 41,70% produtor fonográfico / 41,70% intérpretes /
     16,60% músicos. Não configurável.
   - Digital: dois modos configuráveis pelo selo — 'pro_rata' (selo entra
     como mais um) ou 'fixo' (selo pega X%, resto pro-rata).

5. **Cargos por posição:** 1–4 = 'primary' ("Artista principal"),
   5+ = 'featuring' ("Participação (feat.)").

6. **Um único número de WhatsApp** para todos os selos. Roteamento por
   `whatsapp_identities` (telefone conhecido) ou `intake_code` (#A7K9).

7. **Sem n8n.** Toda orquestração em código: BullMQ para jobs, pg_cron para
   varreduras, regras de negócio como funções tipadas em
   `apps/worker/src/rules/`.

8. **O termo de autorização segue o template verbatim** em
   `packages/docs-gen/templates/autorizacao.hbs`. Não reescreva o texto.

9. **RLS em toda tabela com tenant_id.** Workers usam service_role e
   filtram tenant explicitamente no código.

10. **Nome artístico é o que o artista manda; nome civil é resolvido no
    banco e completado no CRM.** O artista nunca é perguntado sobre nome
    civil, CPF ou dados de contato pelo WhatsApp.

## Stack
Next.js 15 (App Router) · TypeScript strict · Tailwind v4 · shadcn/ui ·
Supabase (Postgres + RLS + Auth + Storage) · Drizzle ORM · BullMQ + Redis ·
Evolution API · Claude (Haiku 4.5 tempo real, Sonnet 4.6 pitch) ·
FastAPI + faster-whisper + librosa · Resend · Playwright (PDF) · Vercel + Hetzner

## Padrões de código
- TypeScript strict. Nenhum `any`. Zod para toda fronteira externa.
- Funções de domínio puras e testáveis, isoladas de I/O.
- Erros de domínio como classes tipadas, nunca strings.
- Datas sempre com timezone America/Sao_Paulo explícito.
- Nada de comentário óbvio. Comente só o "porquê" não-óbvio.
- Teste antes de declarar pronto. Rode e mostre a saída.
```

---

## PROMPT 0 — Bootstrap

```
Crie o monorepo do projeto A&R Digital conforme a seção 1.4 de
AR_DIGITAL_PIPELINE.md.

Turborepo + pnpm workspaces:

apps/web          Next.js 15 App Router, TS strict, Tailwind v4, shadcn/ui
apps/worker       Node + BullMQ + ioredis, TS strict
apps/audio-svc    FastAPI (Python 3.12), gerenciado com uv

packages/db       Drizzle ORM + migrations + policies RLS
packages/wa       WhatsAppProvider + máquina de estados + handlers
packages/splits   motor de rateio (puro, zero I/O)
packages/ai       clients Claude + prompts versionados como constantes tipadas
packages/docs-gen Handlebars → HTML → PDF (Playwright)
packages/ui       design system
packages/shared   tipos, schemas Zod, utilitários de data

Configure:
- TS strict em todos os pacotes, path aliases @ar/*
- ESLint + Prettier + Husky + lint-staged
- Vitest em todos os pacotes; threshold de coverage 90% em packages/splits
- GitHub Actions: lint → typecheck → test → build
- .env.example completo, cada variável comentada
- infra/docker-compose.yml com: evolution-api, redis, audio-svc, caddy
  (reverse proxy com TLS automático)

NÃO implemente lógica de negócio. Só o esqueleto rodando com `pnpm dev`.

Critério de aceite: `pnpm install && pnpm build && pnpm test` passa limpo,
e `pnpm dev` sobe o Next em :3000 e o worker sem erro.
```

---

## PROMPT 1 — Schema, RLS e seeds

```
Implemente em packages/db o schema completo da seção 2 de
AR_DIGITAL_PIPELINE.md, usando Drizzle.

Requisitos:

1. Todas as tabelas exatamente como especificadas, incluindo constraints
   e índices. Extensões: pg_trgm, unaccent, pgcrypto, pg_cron.

2. RLS habilitada em TODA tabela com tenant_id, com policies usando a
   função auth_tenant_ids(). Tabelas: tenants (via membership), artists,
   artist_aliases (via join), artist_contacts (via join), whatsapp_identities,
   whatsapp_sessions, submissions, releases, tracks, track_participants,
   splits, authorizations, authorization_recipients, registrations, pitches,
   tasks, activity_log.

3. O constraint trigger assert_split_totals conforme especificado —
   deferrable initially deferred, aceitando total 0 (rascunho) ou 10000.

4. Materialized view mv_pipeline + agendamento pg_cron de refresh.

5. Seeds de desenvolvimento reproduzindo o caso real:
   - tenant "SuperTime Digital", intake_code 'A7K9'
   - label_split_settings: digital_mode='pro_rata'
   - usuário owner com is_default_ar=true
   - artistas: MC GH, MC JACARÉ, MUCILON
   - release "SE SOLTA", data 2027-03-06, gêneros Funk/Trap
   - track_participants: MC GH pos1, MC JACARÉ pos2, MUCILON pos3
     (MUCILON com is_producer=true)
   - splits esperados:
       obra:      MC GH 5000, MC JACARÉ 5000
       fonograma: SuperTime 4170, MC GH 2085, MC JACARÉ 2085, MUCILON 1660
       digital:   MC GH 2500, MC JACARÉ 2500, MUCILON 2500, SuperTime 2500

6. Suíte de testes de isolamento em packages/db/__tests__/rls.test.ts:
   para CADA tabela com tenant_id, um usuário do tenant A não pode
   ler nem escrever dados do tenant B. Os testes devem FALHAR se qualquer
   policy estiver ausente ou incorreta. Use dois tenants no fixture.

Rode as migrations e os testes. Mostre a saída completa.

Critério de aceite: migrations aplicadas, seeds carregados, 100% dos
testes de RLS verdes, e uma query manual como service_role confirmando
que os splits de SE SOLTA somam 10000 em cada escopo.
```

---

## PROMPT 2 — Motor de splits

```
Implemente packages/splits conforme a seção 4 de AR_DIGITAL_PIPELINE.md.

API pública:
  computeObra(participants): SplitLine[]
  computeFonograma(participants, labelName): SplitLine[]
  computeDigital(participants, config, labelName): SplitLine[]

Internos exportados para teste:
  distributeByWeight, distributeEvenly, reconcile, fmt

Requisitos duros:
- Funções PURAS. Zero I/O, zero import de banco, zero side effect.
- Aritmética inteira em bps100. Método do maior resto com desempate
  determinístico (maior fração, depois menor índice).
- Toda saída soma EXATAMENTE 10000. Sempre.
- Nenhuma linha negativa. Erro de domínio SplitError se acontecer.
- Obra: pro-rata igualitário entre is_composer. Sem selo, sem editora.
- Fonograma: 4170/4170/1660 fixo. Sem músicos → os 1660 vão 830 para
  produtor e 830 para intérpretes.
- Digital: modos 'pro_rata' e 'fixo' conforme especificado.
  Participantes com hidden_from_billing=true ficam FORA do digital
  mas CONTINUAM no fonograma como músicos.

Testes obrigatórios:

1. Snapshot do caso SE SOLTA nos três escopos, batendo exatamente com
   os valores do seed do Prompt 1.

2. Tabela combinatória: 1, 2, 3, 4, 5, 7, 11, 13 participantes ×
   {com produtor, sem produtor} × {com featuring, sem featuring} ×
   {digital pro_rata, digital fixo 2500, digital fixo 1000, fixo 9000}.
   Assert em todos: soma === 10000 e nenhuma linha < 0.

3. Property-based com fast-check: para qualquer array de 1..20
   participantes e qualquer config válida, soma === 10000 && todas >= 0.
   Mínimo 1000 runs.

4. Caso de borda: 3 participantes dividindo 4170 → deve dar
   [1390, 1390, 1390]. 7 participantes dividindo 4170 → soma deve ser
   exatamente 4170 (verifica o maior resto).

5. hidden_from_billing: participante oculto não aparece no digital,
   mas aparece no fonograma com classe "Músico".

Rode os testes e mostre coverage. Não prossiga se estiver abaixo de 90%.
```

---

## PROMPT 3 — Intake WhatsApp

```
Implemente o fluxo de intake da seção 3 de AR_DIGITAL_PIPELINE.md,
em packages/wa + apps/web.

## 1. Adapter
Interface WhatsAppProvider: sendText, sendPresence, downloadMedia,
getInstanceHealth. Implementações: EvolutionProvider e MockProvider
(registra mensagens enviadas em memória, para teste).

## 2. Webhook
POST /api/webhooks/whatsapp em apps/web:
- Valida HMAC do header. 401 se inválido.
- PRIMEIRA AÇÃO: sendPresence("composing") fire-and-forget, sem await
  bloqueante.
- Resolve tenant: whatsapp_identities → intake_code (#XXXX) → fallback
  pedindo o código.
- Processa de forma SÍNCRONA e responde ao artista dentro do request.
- Grava latency_ms em submission_messages para monitorar o SLA de 1,5s.
- Só enfileira no BullMQ o que o artista NÃO precisa esperar
  (download de mídia, validação de arquivo).

## 3. Máquina de estados
Implementação própria, tipada, sem XState (overhead desnecessário aqui).
Estados: ask_title → ask_artists → ask_producers → ask_producer_position
(loop) → ask_genres → ask_date → ask_audio → ask_cover → confirm → done.
Persistida em whatsapp_sessions.step + draft (JSONB).

Cada handler tem a assinatura:
  (session, input, ctx) => Promise<{ reply: string; nextStep: Step; draft: Draft }>

## 4. Handlers — orçamento de latência
- ask_title: Haiku com timeout de 1200ms. Timeout ou erro → aceita como
  veio e marca needs_review. NUNCA trava o fluxo.
- ask_artists: split determinístico por separadores → lookup trigram no
  banco (query da seção 3.3) → Haiku só nos nomes NÃO encontrados,
  em paralelo. Regra de score: >=0.90 vincula; 0.72-0.89 vincula com
  needs_review; <0.72 cria artista novo com needs_review.
- ask_producers: 100% determinístico, sem LLM.
- ask_genres: match contra a lista canônica com unaccent + Levenshtein<=2.
  Sem LLM.
- ask_date: parser em cascata com date-fns, tz America/Sao_Paulo. Sem LLM.
- ask_audio / ask_cover: responde "Recebi!" na hora, valida em background.

## 5. Regras de negócio
- assignRoles: posição 1-4 = 'primary', 5+ = 'featuring'.
- Produtor fora da lista → pergunta a posição. Resposta "NÃO" cria o
  participante com hidden_from_billing=true e is_producer=true.
- Card de confirmação exatamente no formato da seção 3.3.
- Correção pós-confirmação: heurística por palavra-chave reabre o passo
  correspondente. Máximo 3 ciclos, depois cria tarefa para o A&R.

## 6. Conversão
Ao confirmar: cria release + track + track_participants, chama
packages/splits para gerar os três escopos, cria as registrations
pendentes, e grava tudo em transação única.

## 7. Testes com MockProvider
Simule conversas completas e faça assert nas mensagens enviadas:
a) fluxo feliz, 3 artistas, produtor já na lista
b) produtor fora da lista, respondendo posição 3
c) produtor fora da lista, respondendo NÃO
d) 6 artistas (verifica que o 5º e 6º saem como "Participação (feat.)")
e) título com erro de português, artista confirma a correção
f) nome de artista não encontrado no banco (cria novo, needs_review)
g) data "06/03" quando hoje é 05/08/2026 → resolve 2027-03-06
h) capa comprimida (< 3000px) → pede reenvio como documento
i) Haiku indisponível → fluxo completa mesmo assim
j) teste de latência: nenhum handler pode passar de 1500ms com o
   MockProvider e um stub de LLM com 600ms de delay

Rode todos e mostre a saída.
```

---

## PROMPT 4 — Termo, envio e follow-up

```
Implemente a seção 6 de AR_DIGITAL_PIPELINE.md.

1. packages/docs-gen: template Handlebars autorizacao.hbs com o texto
   VERBATIM da seção 6.1 — não reescreva, não "melhore" o texto.
   Helpers: formatação de pct (vírgula decimal, sufixo %), formatação de
   data DD/MM/AAAA, montagem de creditos ("A, B & C").
   Render: Handlebars → HTML com CSS de impressão → Playwright → PDF.

2. Snapshot imutável em authorizations.snapshot no momento da geração.

3. Envio via Resend com endereçamento VERP:
   reply-to = auth+{reply_token}@inbox.{dominio}
   Fila BullMQ com retry exponencial e DLQ.

4. POST /api/webhooks/email/inbound:
   - VALIDA A ASSINATURA DO RESEND. Sem isso, qualquer um forja um
     "autorizo". Isso é obrigatório, não opcional.
   - Extrai reply_token, limpa quoted reply e assinatura.
   - Classifica com Haiku usando o prompt da seção 6.3.
   - confianca < 0.8 ou decisao em {condicional, duvida, indefinido}
     NUNCA aprova automaticamente — vai para revisão do A&R.

5. Motor de follow-up:
   - pg_cron a cada 15 min enfileira; worker processa com
     FOR UPDATE SKIP LOCKED.
   - Intervalo a partir do ÚLTIMO ENVIO, padrão 5 dias.
   - Janela 09:00–19:00 seg–sex America/Sao_Paulo. Fora disso, empurra.
   - 4 níveis de escalada de tom, frequência constante.
   - Para com: resposta, bounce, cancelamento, max attempts, ou data de
     lançamento já passada.

6. Notificação WhatsApp ao A&R (is_default_ar) no formato da seção 6.5.
   Agrupamento: 3+ eventos em 10 min viram uma mensagem só.

Testes:
- PDF gerado bate com um snapshot HTML de referência do caso SE SOLTA.
- Webhook com assinatura inválida → 401, nenhum efeito colateral.
- Classificações: "autorizo" → aprovado; "pode mudar a data?" →
  condicional; "valeu 👍" → indefinido (NÃO aprova).
- Follow-up: dispara no 5º dia, respeita janela, para na resposta,
  para no max attempts.
- Concorrência: dois workers processando a mesma fila não enviam duplicado.
```

---

## PROMPT 5 — CRM

```
Implemente o painel da seção 5 de AR_DIGITAL_PIPELINE.md.

1. packages/ui: tokens da seção 5.1 (extrair os hex reais de
   audiolinkbrasil.com antes; usar os provisórios se não conseguir).
   Todo número financeiro em font-mono com tabular-nums.

2. Rotas da seção 5.2. Server Components por padrão; Client Components
   só onde há interatividade real.

3. Telas prioritárias, nesta ordem:
   a) /inbox e /inbox/[id] — com a tabela de vínculo artístico↔civil da
      seção 5.3 e edição inline do nome civil com autocomplete
   b) /releases — kanban com drag entre colunas, card da seção 5.4,
      badge de dias na etapa vindo de stage_since
   c) /releases/[id]/splits — editor de 3 abas, validação de soma em
      tempo real, botão "Redistribuir o resto", versionamento no override
   d) /releases/[id]/registros — checklist com toggle, external_id,
      marcação retroativa
   e) / — dashboard da seção 5.7, lendo de mv_pipeline
   f) /config/splits — configuração do digital com preview ao vivo

4. Realtime do Supabase no /inbox: submissão nova aparece sem refresh.

5. PWA com next-pwa: manifest, ícone, tema escuro, Web Push para
   autorização respondida, prazo estourando e nova submissão.

6. Regras de negócio em apps/worker/src/rules/ conforme a seção 5.8 —
   array tipado de Rule, cada uma com teste unitário. Nada de n8n.

Mobile-first de verdade: o A&R confere lançamento no celular. Tabelas
viram cards abaixo de md.
```

---

## PROMPT 6 — Pitching

```
Implemente a seção 7 de AR_DIGITAL_PIPELINE.md.

1. apps/audio-svc (FastAPI):
   POST /analyze { audio_url } → { transcript, segments, bpm, key, mode,
   energy, brightness, duration, hook_at_sec, sections[] }
   faster-whisper large-v3, language="pt", vad_filter=True, e o
   initial_prompt da seção 7.2 — sem ele o Whisper formaliza a gíria e a
   letra sai inútil.

2. Cliente Spotify (Client Credentials) em packages/ai:
   busca por artista, top-tracks BR, related-artists, audio-features.
   Match automático só com score alto E país BR; abaixo disso, sugere ao
   A&R e NÃO vincula sozinho.
   Cache de 7 dias via artists.spotify_synced_at.

3. Job de pitch (BullMQ), disparado quando o release entra em
   'autorizado' E dias de antecedência >= pitch_min_lead_days.
   Roda [A] transcrição, [B] sinal, [C] Spotify e [D] catálogo em
   paralelo, depois a síntese com Sonnet 4.6 usando o prompt da seção 7.3.

4. Grava lyrics_transcript em tracks — alimenta o cadastro de obra.

5. Tela /releases/[id]/pitch: duas caixas, contador de caracteres,
   Copiar (grava used_option), Regenerar com ajuste (campo livre),
   painel de análise colapsado com waveform e gancho marcado.

6. Se não elegível, mostra o motivo com o número de dias que faltou.

Testes: elegibilidade nos limites (9, 10, 11 dias), fallback quando o
Spotify não encontra o artista, truncamento em 500 caracteres.
```

---

## Ordem de execução e critérios de parada

| Prompt | Só avance quando |
|---|---|
| 0 | `pnpm build && pnpm test` verde |
| 1 | 100% dos testes de RLS verdes + seeds do SE SOLTA batendo |
| 2 | Coverage ≥ 90% e property test com 1000 runs passando |
| 3 | Os 10 cenários de conversa passando + teste de latência < 1,5s |
| 4 | Webhook rejeitando assinatura inválida + follow-up sem duplicata |
| 5 | Selo real conseguindo operar um lançamento ponta a ponta |
| 6 | — |

**Pare após o Prompt 3 e coloque em produção com um selo real.** O intake
sozinho já elimina a maior parte do trabalho manual do A&R, e é ele que
prova ou refuta a tese central do produto: a de que o artista responde
melhor no WhatsApp do que num formulário. Melhor descobrir na semana 7 do
que na semana 26.
