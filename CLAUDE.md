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

## Infraestrutura
- Supabase: https://dwqdpumeehcamnrbddad.supabase.co
- VPS Hostinger: 193.203.182.39 (KVM 4, Ubuntu 24.04)
- GitHub: https://github.com/marcdofuturo/AeR-Digital
