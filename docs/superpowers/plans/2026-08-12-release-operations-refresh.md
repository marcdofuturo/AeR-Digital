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

- [ ] Merge Creditos into Visao Geral and remove "Oculto" from displayed credits.
- [ ] Add current-year copyright with tenant label name.
- [ ] Add inline save action for legal name and ECAD code.
- [ ] Ensure authorization checklist rows from every track participant.
- [ ] Remove YouTube Content ID from UI registration order.
- [ ] Add compact participant add form for Registrar Obra and Registrar Fonograma.

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

- [ ] Update pure split rules and prove sums remain 100%.
- [ ] Persist generated splits for new WhatsApp releases and for manual regeneration.
- [ ] Add manual split edit/confirm by creating the next split version.
- [ ] Update config copy so digital settings apply to future arrivals.

### Task 5: Apresentacao With Claude

**Files:**
- Modify: `packages/ai/src/pitch.ts`
- Modify: `packages/ai/src/pitch.test.ts`
- Create: `apps/web/lib/ai/presentation.ts`
- Test: `apps/web/lib/ai/presentation.test.ts`
- Modify: `apps/web/app/releases/[id]/pitch/page.tsx`
- Modify: `apps/web/app/releases/actions.ts`

- [ ] Rename UI text from Pitch to Apresentacao.
- [ ] Build one presentation prompt per track and optional improvement prompt.
- [ ] Call Claude with `ANTHROPIC_API_KEY`, `CLAUDE_SONNET_MODEL`, and JSON parsing fallback.
- [ ] Enforce 100 tenant AI credits, 2 credits per generation, using `pitches` count.

### Task 6: Pipeline, Verification, Deploy

**Files:**
- Modify: `AR_DIGITAL_PIPELINE.md`
- Modify: docs under `docs/superpowers/`

- [ ] Update the pipeline document to match the current release stages and presentation terminology.
- [ ] Run targeted tests, package tests, typecheck, lint, build, Cloudflare deploy, production smoke tests, and git status.
- [ ] Commit, push to `origin/master`, and report exact evidence.

