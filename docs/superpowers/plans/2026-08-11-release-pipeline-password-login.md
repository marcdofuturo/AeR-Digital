# Release Pipeline And Password Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update AeR Digital so releases follow the requested operational order, digital split settings are editable, and login uses email/password instead of magic links.

**Architecture:** Keep the current Next.js/Supabase shape. Centralize release stages in shared/AI packages, migrate the database check constraint incrementally, and add focused server actions for stage/config changes. Authentication remains Supabase Auth, but the UI switches from OTP magic link to `signInWithPassword`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase Auth/Postgres, Vitest, Tailwind UI components.

---

### Task 1: Release Pipeline Model

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/ai/src/crm.ts`
- Modify: `packages/ai/src/crm.test.ts`
- Modify: `apps/web/lib/wa/handler-db.ts`
- Add: `packages/db/migrations/002_release_pipeline_v3.sql`

- [ ] Write failing tests that expect the new nine-stage order.
- [ ] Run `pnpm --filter @ar/ai test` and confirm the stage-order test fails.
- [ ] Replace old stage ids with `em_analise`, `autorizacao_pendente`, `registrar_obra`, `registrar_fonograma`, `pronto_p_distribuir`, `distribuido`, `situacao_ecad`, `concluido`, `arquivado`.
- [ ] Make WhatsApp-created releases start at `em_analise`.
- [ ] Add migration that maps `recebido` to `em_analise`, `autorizado` to `registrar_obra`, and `registrado` to `situacao_ecad`, then replaces the check constraint.
- [ ] Re-run focused tests.

### Task 2: Kanban And Release Detail UI

**Files:**
- Modify: `apps/web/components/releases/kanban-card.tsx`
- Modify: `apps/web/app/releases/page.tsx`
- Modify: `apps/web/app/releases/[id]/layout.tsx`
- Modify: `apps/web/app/artists/[id]/page.tsx`
- Modify: `apps/web/app/releases/[id]/autorizacao/page.tsx`
- Modify: `apps/web/app/releases/[id]/registros/page.tsx`

- [ ] Add tests or snapshots where existing coverage supports it for the new labels.
- [ ] Update labels and operational copy to match analysis, authorization checklist, work registration, phonogram registration, distribution, ECAD status, completion, archive.
- [ ] Show authorization recipients as a checklist with pending/approved states.
- [ ] Show registration rows with fields for physical author names, split, association/entity, external id/status, and due alert semantics.

### Task 3: Editable Digital Split Settings

**Files:**
- Add or modify: `apps/web/app/config/splits/actions.ts`
- Modify: `apps/web/app/config/splits/page.tsx`
- Add or modify tests under `apps/web/app/config/splits/`

- [ ] Write failing tests for saving fixed label percentage and pro-rata mode.
- [ ] Add a server action that validates owner tenant, clamps label bps100 between 0 and 10000, upserts `label_split_settings`, and revalidates `/config/splits`.
- [ ] Replace read-only UI with radio/segmented controls and numeric percent input for fixed mode.
- [ ] Explain through UI labels that fixed mode reserves the label percentage and distributes the remainder pro-rata; pro-rata mode divides 100% among track participants plus label.

### Task 4: Email/Password Login

**Files:**
- Modify: `apps/web/app/(auth)/login/page.tsx`
- Add or modify: `apps/web/app/(auth)/login/page.test.tsx`

- [ ] Write failing test that the login form has a password field and no magic-link copy.
- [ ] Change login action to call `supabase.auth.signInWithPassword`.
- [ ] Preserve redirect behavior.
- [ ] Configure the existing Supabase admin user password operationally without printing the password.

### Task 5: Verification And Production

**Files:**
- No code unless verification exposes a bug.

- [ ] Run `pnpm --filter @ar/ai test`.
- [ ] Run `pnpm --filter @ar/splits test`.
- [ ] Run `pnpm --filter @ar/web test`.
- [ ] Run `pnpm --filter @ar/web typecheck`.
- [ ] Run `pnpm --filter @ar/web lint`.
- [ ] Run `pnpm --filter @ar/web build`.
- [ ] Deploy to Cloudflare Pages.
- [ ] Configure password for `marc@audiolinkbrasil.com` in Supabase Auth without echoing it.
- [ ] Validate production login by password with a cookie-based HTTP route sweep.
- [ ] Execute the WhatsApp flow with the files in `C:\Users\cttma\OneDrive\Desktop\TESTE AUDIOLINK` or report the exact external gate if real WhatsApp sending requires manual phone action.
