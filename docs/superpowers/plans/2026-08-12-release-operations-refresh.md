# Release Operations Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the current AeR Digital release operations panel end to end with active UI controls, automatic operational data, Claude presentations, tests, deploy, and GitHub update.

**Architecture:** Keep the existing Next.js App Router structure. Add small server actions/data helpers beside current release pages, preserve Supabase schema where possible, and rely on `@ar/splits` for deterministic split generation.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase, Vitest, Playwright, Cloudflare Pages/OpenNext, Claude via `ANTHROPIC_API_KEY`.

---

### Task 1: Shell and Intake

**Files:**
- Modify: `apps/web/components/nav/sidebar.tsx`
- Modify: `apps/web/components/nav/user-menu.tsx`
- Create: `apps/web/components/dashboard/intake-whatsapp-link.tsx`
- Modify: `apps/web/app/page.tsx`
- Test: `apps/web/components/nav/app-shell.test.tsx`
- Test: `apps/web/app/page.test.tsx`

- [ ] Add a desktop collapse state with a `SkipBack` icon button and compact labels.
- [ ] Add a client copy component for `https://wa.me/5511948059297?text=A7K9`.
- [ ] Verify with focused Vitest tests that the button exists and the intake link can be copied.

### Task 2: Artists and Release Modal

**Files:**
- Modify: `apps/web/lib/data/artists.ts`
- Modify: `apps/web/app/artists/page.tsx`
- Modify: `apps/web/app/artists/[id]/page.tsx`
- Modify: `apps/web/lib/data/releases.ts`
- Modify: `apps/web/components/releases/kanban-card.tsx`
- Modify: `apps/web/components/releases/release-details-dialog.tsx`
- Test: `apps/web/components/releases/release-details-dialog.test.tsx`
- Test: `apps/web/lib/data/artists.test.ts`

- [ ] Fix artist catalog mapping to use `releases.id` and admin client with tenant filters.
- [ ] Add `stageSince` to release cards.
- [ ] Hide missing duration/BPM/key placeholders.
- [ ] Rename modal tile from "No estágio" to "Iniciou em:" and render stage start date.
- [ ] Guard cover image rendering so placeholder values do not create broken images.

### Task 3: Overview, Artist Metadata, Authorizations, Registros

**Files:**
- Modify: `apps/web/components/releases/release-tabs.tsx`
- Modify: `apps/web/app/releases/[id]/page.tsx`
- Modify: `apps/web/app/releases/[id]/creditos/page.tsx`
- Modify: `apps/web/app/releases/[id]/autorizacao/page.tsx`
- Modify: `apps/web/app/releases/[id]/registros/page.tsx`
- Modify: `apps/web/app/releases/actions.ts`
- Test: `apps/web/app/releases/release-actions.test.ts`

- [x] Merge Creditos into Visao Geral and remove "Oculto" from displayed credits.
- [x] Add current-year copyright with tenant label name.
- [x] Add inline save action for legal name and ECAD code, renamed to Nome Completo.
- [x] Ensure authorization checklist rows from every track participant.
- [x] Remove YouTube Content ID from UI registration order.
- [x] Add compact participant add form for Registrar Obra and Registrar Fonograma.
- [x] Generate authorization document per track with panel preview and DOCX download.
- [x] Add per-artist release email fields and reversible approval status.
- [x] Make Visao Geral editable for release/track/distribution fields so data mirrors across tabs.

### Task 4: Splits and WhatsApp Creation

**Files:**
- Modify: `packages/splits/src/obra.ts`
- Modify: `packages/splits/src/fonograma.ts`
- Modify: `packages/splits/src/splits.test.ts`
- Create: `apps/web/lib/splits/persist.ts`
- Test: `apps/web/lib/splits/persist.test.ts`
- Modify: `apps/web/lib/wa/handler-db.ts`
- Modify: `apps/web/app/releases/[id]/splits/page.tsx`
- Modify: `apps/web/app/config/splits/page.tsx`
- Modify: `apps/web/app/releases/actions.ts`

- [x] Update pure split rules and prove sums remain 100%.
- [x] Persist generated splits for new WhatsApp releases and for manual regeneration.
- [x] Add manual split edit/confirm by creating the next split version.
- [x] Update config copy so digital settings apply to future arrivals.
- [x] Keep fonograma label at 41,70%; if there is no musician/producer line, the 16,60% musician pool goes to interpreters instead of increasing the label to 50%.

### Task 5: Apresentacao With Claude

**Files:**
- Modify: `packages/ai/src/pitch.ts`
- Modify: `packages/ai/src/pitch.test.ts`
- Create: `apps/web/lib/ai/presentation.ts`
- Test: `apps/web/lib/ai/presentation.test.ts`
- Modify: `apps/web/app/releases/[id]/pitch/page.tsx`
- Modify: `apps/web/app/releases/actions.ts`

- [x] Rename UI text from Pitch to Apresentacao.
- [x] Build one presentation prompt per track and optional improvement prompt.
- [x] Call Claude with `ANTHROPIC_API_KEY`, `CLAUDE_SONNET_MODEL`, web search, and JSON parsing fallback.
- [x] Enforce 100 tenant AI credits, 2 credits per generation, using `pitches` count.
- [x] Confirm original audio pipeline: `apps/audio-svc` transcribes audio and stores `tracks.lyrics_transcript`; Apresentacao consumes this transcript when available.

### Task 5B: WhatsApp Album/Single and Audio Filename Review

**Files:**
- Modify: `packages/wa/src/types.ts`
- Modify: `packages/wa/src/handlers.ts`
- Modify: `packages/wa/src/machine.ts`
- Modify: `packages/wa/src/intake.test.ts`
- Modify: `apps/web/app/api/webhooks/whatsapp/route.ts`

- [x] Ask whether the submission is single or album/EP before title.
- [x] For album/EP, ask how many tracks are in the submission.
- [x] Add `voltar` support and append correction guidance to every answer.
- [x] Read audio filename metadata from Evolution payload and infer title/participants when possible.
- [x] Ask for corrections in list format when filename-derived title/participants are not correct.

### Task 6: Pipeline, Verification, Deploy

**Files:**
- Modify: `AR_DIGITAL_PIPELINE.md`
- Modify: docs under `docs/superpowers/`

- [ ] Update the pipeline document to match the current release stages and presentation terminology.
- [ ] Run targeted tests, package tests, typecheck, lint, build, Cloudflare deploy, production smoke tests, and git status.
- [ ] Commit, push to `origin/master`, and report exact evidence.
