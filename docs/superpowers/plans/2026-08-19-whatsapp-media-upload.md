# WhatsApp Media Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, resumable cover-and-WAV upload page to the active WhatsApp intake and return the artist to WhatsApp after validated persistence.

**Architecture:** The webhook signs a two-hour stateless grant for the active WhatsApp session. Public server actions exchange that grant for path-scoped Supabase TUS tokens, independently validate stored media headers, update the session draft, and send the existing metadata continuation through Evolution.

**Tech Stack:** Next.js 15 server actions, React 19, TypeScript, Supabase Storage signed TUS uploads, `tus-js-client`, Vitest, Testing Library, Web Crypto.

---

### Task 1: Binary media contracts

**Files:**
- Create: `apps/web/lib/media/media-contract.ts`
- Create: `apps/web/lib/media/media-contract.test.ts`

- [ ] Write failing tests for square PNG/JPEG/WebP dimensions, malformed images, compliant RIFF/RF64 PCM WAV, and failures for mono, non-PCM, non-44.1-kHz, or non-16-bit audio.
- [ ] Run `pnpm --filter @ar/web test -- lib/media/media-contract.test.ts` and confirm failures because the parsers do not exist.
- [ ] Implement bounded `Uint8Array` parsers returning typed image and WAV metadata plus requirement validators.
- [ ] Re-run the focused tests and commit `feat: validate intake media headers`.

### Task 2: Signed session grants

**Files:**
- Create: `apps/web/lib/wa/upload-grant.ts`
- Create: `apps/web/lib/wa/upload-grant.test.ts`
- Modify: `apps/web/lib/wa/session-store.ts`
- Test: `apps/web/lib/wa/session-store.test.ts`

- [ ] Write failing tests for grant round-trip, tampering, expiry, wrong purpose, missing secret, and active-session lookup by UUID.
- [ ] Run the focused tests and observe the missing behavior.
- [ ] Implement base64url HMAC-SHA256 grants with domain separation, constant-time verification, and a two-hour expiry.
- [ ] Add `loadSessionById` and an atomic compare-by-step session update that returns whether one active row changed.
- [ ] Re-run focused tests and commit `feat: authorize temporary WhatsApp uploads`.

### Task 3: Reusable WhatsApp media continuation

**Files:**
- Modify: `packages/wa/src/handlers.ts`
- Modify: `packages/wa/src/types.ts`
- Modify: `packages/wa/src/intake.test.ts`

- [ ] Write a failing test that supplies validated audio filename/URLs and expects parsed metadata, resolved artists, and either `confirm_file_metadata` or `ask_metadata_correction`.
- [ ] Extract a focused exported helper from the existing `ask_audio`/`ask_cover` behavior without changing direct-media fallback behavior.
- [ ] Run `pnpm --filter @ar/wa test` and commit `refactor: share WhatsApp media continuation`.

### Task 4: Grant-aware resumable upload actions

**Files:**
- Create: `apps/web/app/envio/[grant]/actions.ts`
- Create: `apps/web/app/envio/[grant]/actions.test.ts`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] Write failing action tests for invalid grant, wrong session step, path scoping, cover/audio ticket types, storage readback, invalid-object deletion, and successful session continuation.
- [ ] Add `tus-js-client` to `@ar/web`.
- [ ] Implement `createWhatsAppUploadTicket` with no application audio-size cap and unique tenant/session paths.
- [ ] Implement `completeWhatsAppMediaUpload`: verify both object records, fetch bounded headers, validate actual media, persist one session transition, and send the continuation through Evolution.
- [ ] Ensure errors never include provider keys, signed tokens, phone numbers, or storage URLs.
- [ ] Run focused tests and commit `feat: persist resumable WhatsApp media uploads`.

### Task 5: Link the webhook to the upload page

**Files:**
- Modify: `apps/web/app/api/webhooks/whatsapp/route.ts`
- Modify: `apps/web/app/api/webhooks/whatsapp/route.test.ts`
- Modify: `apps/web/lib/wa/session-store.ts`

- [ ] Add failing tests for single/album transitions to `ask_audio`, link renewal for text received at `ask_audio`, and preserved direct WAV/image fallback.
- [ ] Make `saveSession` return the persisted session ID.
- [ ] Generate the grant only after the active session is saved and replace the upload prompt with the public `/envio/<grant>` link.
- [ ] Intercept non-media input at `ask_audio` to renew the same session link without treating text as an audio filename.
- [ ] Run webhook plus WhatsApp suites and commit `feat: send secure upload link in WhatsApp intake`.

### Task 6: Mobile upload interface

**Files:**
- Create: `apps/web/app/envio/[grant]/page.tsx`
- Create: `apps/web/app/envio/[grant]/upload-client.tsx`
- Create: `apps/web/app/envio/[grant]/upload-client.test.tsx`
- Modify: `apps/web/components/nav/app-shell.tsx`
- Modify: `apps/web/middleware.ts`

- [ ] Write failing tests for both requirement cards, local binary validation, disabled/enabled submit, progress states, error replacement, success countdown, automatic close attempt, and WhatsApp fallback link.
- [ ] Add `/envio` to public and shell-free routes and mark the page noindex/no-store/no-referrer.
- [ ] Build the responsive dark Audiolink interface using existing tokens and accessible live regions.
- [ ] Upload cover then audio through TUS with retry delays, progress, abort, and fingerprint removal after success.
- [ ] On completion, attempt `window.close()` and then replace location with the WhatsApp deep link while keeping a visible fallback button.
- [ ] Run component, navigation, and middleware tests; commit `feat: add WhatsApp media upload interface`.

### Task 7: Full verification and publication

**Files:**
- Modify only files required by failures directly caused by Tasks 1-6.

- [ ] Run `pnpm --filter @ar/wa test` and `pnpm --filter @ar/web test`.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm audit --prod`.
- [ ] Run `gitleaks git --staged --redact --no-banner` and `git diff --check`.
- [ ] Perform a local Playwright test with a compliant generated cover and the real 44.1-kHz WAV from `C:\Users\cttma\OneDrive\Desktop\TESTE AUDIOLINK`.
- [ ] Push a feature branch, open a PR, wait for CI, merge to `master`, and synchronize the main local checkout.
- [ ] Deploy Cloudflare Pages and verify immutable/canonical URLs, zero console errors, and public-route headers.
- [ ] When SSH is healthy, back up `/opt/ar-digital/.env`, replace only `ANTHROPIC_API_KEY`, recreate only `ar-worker`, and confirm the key with a status-only API probe.
- [ ] Run a production intake/upload/readback test. Report the real handset message as a separate gate if no controlled phone is available.

