# Task Zero Panel Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct all ten reported panel failures, harden privileged mutations, and prove the resulting release in production.

**Architecture:** Keep synchronous UI mutations in authenticated Next.js server actions, but move audio transcription and AI pitching to a persistent PostgreSQL job queue consumed on the VPS. Share document, status, task, permission, and feedback primitives so every affected route follows the same tested behavior.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library, Supabase/PostgreSQL, Cloudflare Pages, Node worker, FastAPI/faster-whisper, Playwright.

---

### Task 1: Authorization Documents and Clipboard

**Files:**
- Modify: `apps/web/lib/docs/simple-pdf.ts`
- Modify: `apps/web/lib/docs/authorization-document.test.ts`
- Create: `apps/web/lib/docs/simple-pdf.test.ts`
- Create: `apps/web/lib/docs/authorization-clipboard.ts`
- Create: `apps/web/lib/docs/authorization-clipboard.test.ts`
- Modify: `apps/web/components/docs/authorization-document-preview.tsx`
- Modify: `apps/web/app/api/releases/[id]/authorizations/[authorizationId]/document/route.ts`
- Create: `apps/web/app/api/releases/[id]/authorizations/[authorizationId]/document/route.test.ts`

- [ ] **Step 1: Add failing PDF, DOCX, route, and clipboard tests**

Assert extracted PDF text includes all canonical sections; unzip DOCX and assert `word/document.xml` contains the same content; assert the route returns non-empty format-specific content; assert clipboard HTML has `color:#000`, transparent background, table structure, and a plain-text fallback.

- [ ] **Step 2: Run the focused tests and verify the content assertions fail**

Run: `pnpm --filter @ar/web test -- authorization-document simple-pdf authorization-clipboard route`

Expected: FAIL because PDF positioning loses later lines and clipboard serialization does not exist.

- [ ] **Step 3: Fix absolute PDF positioning and implement clipboard serialization/action**

Render each PDF line with an independent text matrix (`Tm`) instead of cumulative `Td`. Export a serializer returning `{ html, text }`; in the client preview use `ClipboardItem` when available, then `writeText`, and expose copied/error feedback without embedding a background color.

- [ ] **Step 4: Pass focused document tests and commit**

Run: `pnpm --filter @ar/web test -- authorization-document simple-pdf authorization-clipboard route`

Expected: PASS with readable PDF/DOCX content and both clipboard MIME formats.

Commit: `fix: restore authorization documents and clipboard copy`

### Task 2: Reversible Authorization and Registration Statuses

**Files:**
- Modify: `apps/web/app/releases/[id]/autorizacao/page.tsx`
- Create: `apps/web/components/releases/authorization-status-button.tsx`
- Create: `apps/web/components/releases/authorization-status-button.test.tsx`
- Modify: `apps/web/app/releases/[id]/registros/page.tsx`
- Create: `apps/web/lib/registration-status.ts`
- Create: `apps/web/lib/registration-status.test.ts`
- Create: `packages/db/migrations/003_task_zero_panel_hardening.sql`

- [ ] **Step 1: Write failing tests for approved-to-pending reversal and legacy `na` normalization**

Assert an approved checklist row exposes `Marcar pendente`, calls the status action with `pending`, and legacy `na` values render/select as `pendente` without an `N/A` option.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `pnpm --filter @ar/web test -- authorization-status-button registration-status`

Expected: FAIL because the primary checklist is one-way and `na` is still supported.

- [ ] **Step 3: Add the reversible control and migration normalization**

Use one client button with `useTransition`, pending state, and success feedback for both directions. Update historical rows from `na` to `pendente`, then replace the registration status check constraint without `na`.

- [ ] **Step 4: Pass tests and commit**

Run: `pnpm --filter @ar/web test -- authorization-status-button registration-status`

Expected: PASS.

Commit: `fix: make authorization status reversible`

### Task 3: Central Role Authorization, Team Invitations, and Label Editing

**Files:**
- Create: `apps/web/lib/auth/require-membership.ts`
- Create: `apps/web/lib/auth/require-membership.test.ts`
- Create: `apps/web/app/config/actions.ts`
- Create: `apps/web/app/config/actions.test.ts`
- Modify: `apps/web/app/config/equipe/page.tsx`
- Create: `apps/web/app/config/equipe/invite-member-form.tsx`
- Create: `apps/web/app/config/equipe/invite-member-form.test.tsx`
- Modify: `apps/web/app/config/selo/page.tsx`
- Create: `apps/web/app/config/selo/label-settings-form.tsx`
- Create: `apps/web/app/config/selo/label-settings-form.test.tsx`
- Modify: `packages/db/migrations/003_task_zero_panel_hardening.sql`

- [ ] **Step 1: Write failing permission, invite-validation, and label-form tests**

Assert unauthenticated/non-member calls fail; owner checks pass only for owners; invitation accepts `ar`, `financeiro`, or `viewer` and rejects `owner`; label updates reject immutable fields and invalid email/CNPJ data.

- [ ] **Step 2: Run focused tests and verify failures**

Run: `pnpm --filter @ar/web test -- require-membership config invite-member-form label-settings-form`

Expected: FAIL because centralized role checks and write actions do not exist.

- [ ] **Step 3: Implement owner-scoped actions and forms**

Resolve user, membership, tenant, and role inside every action. Invite through Supabase Auth Admin, then upsert the profile and tenant membership. Update only `name`, `legal_name`, `cnpj`, `logo_url`, `responsible_name`, `contact_email`, and `contact_phone`; display code/slug/plan/status as immutable.

- [ ] **Step 4: Extend the migration with editable label fields and indexes**

Add nullable contact columns to `tenants`; add supporting membership lookup indexes without changing tenant identifiers or secrets.

- [ ] **Step 5: Pass focused tests and commit**

Run: `pnpm --filter @ar/web test -- require-membership config invite-member-form label-settings-form`

Expected: PASS.

Commit: `feat: add secured team and label settings`

### Task 4: Release Tasks and Semantic Priorities

**Files:**
- Modify: `apps/web/lib/data/tasks.ts`
- Create: `apps/web/lib/tasks/sync-stage-task.ts`
- Create: `apps/web/lib/tasks/sync-stage-task.test.ts`
- Modify: `apps/web/app/releases/actions.ts`
- Modify: `apps/web/app/tarefas/page.tsx`
- Modify: `apps/web/components/tasks/tasks-table.tsx`
- Create: `apps/web/components/tasks/tasks-table.test.tsx`
- Modify: `packages/db/migrations/003_task_zero_panel_hardening.sql`

- [ ] **Step 1: Write failing stage-sync and priority-style tests**

Assert every active release has exactly one open task for its current stage, prior-stage tasks complete after a transition, repeated sync is idempotent, and high/medium/low badges use distinct semantic variants.

- [ ] **Step 2: Run focused tests and verify failures**

Run: `pnpm --filter @ar/web test -- sync-stage-task tasks-table`

Expected: FAIL because rule definitions are not dispatched and low priority is visually neutral.

- [ ] **Step 3: Implement deterministic synchronization and backfill**

Use task kind `stage:<stage>` with a partial unique index on tenant/release/kind. Synchronize from release mutations and backfill active releases in the migration. Use danger, warning, and info semantic badge/filter variants for high, medium, and low.

- [ ] **Step 4: Pass focused tests and commit**

Run: `pnpm --filter @ar/web test -- sync-stage-task tasks-table`

Expected: PASS.

Commit: `feat: synchronize release tasks and priorities`

### Task 5: Grounded Presentation Job Pipeline

**Files:**
- Modify: `packages/ai/src/pitch.ts`
- Modify: `packages/ai/src/pitch.test.ts`
- Create: `apps/web/lib/presentation/jobs.ts`
- Create: `apps/web/lib/presentation/jobs.test.ts`
- Modify: `apps/web/app/releases/actions.ts`
- Modify: `apps/worker/src/index.ts`
- Create: `apps/worker/src/presentation/processor.ts`
- Create: `apps/worker/src/presentation/processor.test.ts`
- Modify: `packages/db/migrations/003_task_zero_panel_hardening.sql`
- Modify: `infra/docker-compose.yml`

- [ ] **Step 1: Write failing prompt and job-lifecycle tests**

Assert the prompt requests artist relevance research, transcription-derived themes/mood, sonic traits, cultural context, marketing plan, DSP fit, citations/source notes, and explicit non-invention rules. Assert queued jobs claim once, persist transcript/analysis, complete with pitch text, and retain a safe failure message on error.

- [ ] **Step 2: Run focused AI/worker/web tests and verify failures**

Run: `pnpm --filter @ar/ai test -- pitch && pnpm --filter @ar/worker test -- processor && pnpm --filter @ar/web test -- presentation`

Expected: FAIL because jobs and full-transcript processing do not exist.

- [ ] **Step 3: Add persistent presentation jobs and RLS**

Create `presentation_jobs` with queued/processing/completed/failed states, timestamps, attempts, tenant/release/track references, one active job per track, RLS via memberships, and status indexes.

- [ ] **Step 4: Implement worker processing and improved grounded prompt**

The web action enqueues after owner/A&R authorization. The worker atomically claims work, calls the internal audio analysis endpoint, stores transcription and audio signals, invokes Claude web search with official DSP-aware instructions, and stores presentation plus safe source/warning metadata. Retries must not duplicate active work.

- [ ] **Step 5: Wire the worker service and pass focused tests**

Run: `pnpm --filter @ar/ai test -- pitch && pnpm --filter @ar/worker test -- processor && pnpm --filter @ar/web test -- presentation`

Expected: PASS with no external network dependency in unit tests.

Commit: `feat: process grounded pitching jobs asynchronously`

### Task 6: Consistent Interaction Feedback and Faster Navigation

**Files:**
- Modify: `apps/web/components/ui/button.tsx`
- Modify: `apps/web/components/ui/save-button.tsx`
- Create: `apps/web/components/ui/save-button.test.tsx`
- Create: `apps/web/components/navigation-progress.tsx`
- Create: `apps/web/components/navigation-progress.test.tsx`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/components/releases/release-tabs.tsx`
- Create: `apps/web/app/releases/[id]/loading.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Write failing button, save-state, and navigation-feedback tests**

Assert buttons have visible press motion/focus/disabled behavior, mutation submits expose pending and completed labels, internal navigation starts progress, and release tab links prefetch by default.

- [ ] **Step 2: Run focused tests and verify failures**

Run: `pnpm --filter @ar/web test -- save-button navigation-progress release-tabs button`

Expected: FAIL because press motion/global navigation feedback are absent and tab prefetch is disabled.

- [ ] **Step 3: Implement shared feedback and loading UI**

Add `active:scale-[0.98]`, transition and disabled affordances to the shared button; use transition-aware submit feedback with spinner and confirmation; add an accessible top progress indicator for internal navigation; remove `prefetch={false}`; add nested skeleton loading. Extend ESLint ignores for generated backup/build directories without deleting them.

- [ ] **Step 4: Pass focused tests and commit**

Run: `pnpm --filter @ar/web test -- save-button navigation-progress release-tabs button`

Expected: PASS.

Commit: `fix: add responsive panel interaction feedback`

### Task 7: Full Verification, Database, VPS, Production, and Git

**Files:**
- Modify only if a test exposes a scoped regression.

- [ ] **Step 1: Run the complete local gate**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`

Expected: all commands exit 0; only documented non-blocking Turbo output warnings may remain.

- [ ] **Step 2: Review schema and migration safety**

Run the migration against the intended AeR Supabase project without printing connection values, then query only schema metadata/counts to confirm columns, constraints, indexes, RLS, task backfill, and job table.

- [ ] **Step 3: Deploy and health-check the AeR worker/audio pipeline**

Back up current AeR deployment files, deploy only AeR worker/audio changes, confirm health endpoints, enqueue one controlled job, and verify transcription/pitch persistence without changing unrelated projects or secrets.

- [ ] **Step 4: Deploy Cloudflare production and run authenticated Playwright E2E**

Verify login, authorization PDF/DOCX extracted text, formatted clipboard payload, reversible checklist, no N/A status, presentation job completion, tasks, priority colors, team invitation validation, label save/immutability, button/navigation feedback, route timings, console/network errors, and mobile layout at `https://aerdigital.pages.dev`.

- [ ] **Step 5: Clean controlled test data and inspect production logs**

Remove only records created by the smoke test, then confirm no new application errors or failed jobs.

- [ ] **Step 6: Commit final test fixes, merge, push, and synchronize the local checkout**

Merge `codex/aer-task-zero-fixes` into local `master` non-interactively, push `master`, verify remote SHA and CI result, deploy from that SHA, and confirm the original checkout is clean at the same commit.

- [ ] **Step 7: Record the final evidence and score**

Report each of the ten requirements with its production proof, exact automated test totals, deployment/commit identifiers, unchanged-secret statement, residual risks, and a 1-to-10 score based only on observed evidence.
