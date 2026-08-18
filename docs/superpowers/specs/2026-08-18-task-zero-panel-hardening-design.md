# Task Zero Panel Hardening Design

## Goal

Correct the ten reported panel failures, remove the underlying authorization and job-processing gaps discovered during the audit, and produce deployable evidence from unit, integration, build, browser, database, worker, and production checks.

## Constraints

- Do not create, rotate, revoke, print, or commit credentials.
- Keep the current AeR Digital visual language and existing business rules.
- Preserve tenant isolation and require an explicit membership role before every privileged mutation.
- Long-running audio transcription must not execute inside a Cloudflare request.
- Existing production data must remain available; migrations are additive or normalize only the deprecated `na` registration status.

## Chosen Architecture

### Documents and authorization

The authorization document remains generated from one canonical section model. PDF rendering will use correct absolute text positioning, and DOCX/PDF responses will be covered by content-level tests rather than header-only checks. The preview receives a client-side copy action that writes both `text/html` and `text/plain`; copied HTML explicitly uses black text and a transparent background. The primary checklist exposes the same reversible pending/approved action already available in the secondary card.

### Registrations, tasks, and settings

`N/A` is removed from UI and database constraints; historical `na` rows become `pendente`. Tasks receive one deterministic stage task per active release, with a unique key that prevents duplicates. A migration backfills existing songs, and stage changes synchronize the task.

Team invitations use Supabase Auth Admin only after an owner check. Inviteable roles are `ar`, `financeiro`, and `viewer`; `owner` is not assignable from the form. Label settings expose editable business fields while keeping tenant id, slug, intake code, plan, and status immutable. Both features validate input with Zod and scope every write by `tenant_id`.

### Presentation pipeline

The web action creates a persistent `presentation_jobs` row and returns immediately. The VPS worker claims queued jobs, calls the internal audio service, persists transcription and signal analysis on the track, builds a platform-aware pitching prompt, performs grounded artist research through Claude web search, and stores the presentation plus research warnings. Jobs have queued, processing, completed, and failed states, timestamps, retry-safe claiming, and tenant-scoped RLS.

The prompt follows current official DSP guidance: factual artist context, genre and mood accuracy, song story, collaborators, cultural/location context, sonic characteristics, marketing plan, and playlist fit. It must not invent audience numbers, awards, playlists, press, partnerships, or campaign claims. Lyrics are used to infer themes and mood, not quoted at length.

### Interaction and performance

The shared button gains press motion and disabled/pending affordances. Mutation forms use a shared submit component with spinner and completion state. A global navigation indicator covers slow route transitions. Release tabs restore Next.js prefetch, and nested loading UI makes tab changes immediate while server data arrives. Native browser URL previews are not styleable by the application; internal links remain semantic HTTPS links, while the application supplies its own branded transition feedback.

### Security

A central authorization helper resolves the authenticated user, membership, tenant, and role. Owner-only actions cover team and label administration. Operational mutations require owner or A&R. Service-role clients continue to filter by tenant explicitly. New tables receive RLS policies and supporting indexes.

## Error Handling

- Document routes return typed 401/404 responses and valid binary bodies.
- Clipboard failures fall back to plain text and show a visible failure state.
- Server actions return validation errors without claiming success.
- Presentation jobs expose failure reasons safe for operators, while secret values and provider response bodies stay out of UI/log output.
- Worker jobs can be retried without creating duplicate active jobs or duplicate pitches.

## Verification

1. Red-green unit tests for document content, clipboard payload, reversible authorization, status normalization, task synchronization, permissions, invitation, label editing, prompt quality, job state transitions, and interaction feedback.
2. Full monorepo test, typecheck, lint, and production build.
3. SQL migration application and schema/readback checks.
4. Worker and audio-service health checks plus a real queued transcription/presentation job.
5. Authenticated Playwright flow covering all ten requested items, downloaded DOCX/PDF content, clipboard formats, route timing, console errors, and visible action feedback.
6. Merge to local `master`, push to GitHub, Cloudflare production deployment, and final production smoke test.
