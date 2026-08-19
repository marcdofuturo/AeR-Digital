# WhatsApp Media Upload Design

## Objective

Replace the fragile audio-and-cover transfer inside WhatsApp with a secure mobile web page that keeps the current AeR Digital visual language. The artist receives a temporary link in the active WhatsApp intake, uploads one cover and one audio file, sees reliable progress and validation, and is sent back to WhatsApp to continue metadata confirmation.

## Confirmed Media Contract

- Cover: JPEG, PNG, or WebP; square; minimum 1600 x 1600 pixels; maximum 3000 x 3000 pixels.
- Audio: RIFF/RF64 WAV, PCM, stereo, 16-bit, 44.1 kHz.
- Audio size: AeR Digital adds no application-level cap. The effective maximum remains the Supabase project global limit. Resumable TUS upload is used because Supabase recommends it for files larger than 6 MB.
- Both files are required before the intake advances.

## Chosen Architecture

### Temporary WhatsApp grant

The webhook creates a short-lived signed grant whenever a session enters `ask_audio`. The grant contains only the session UUID and a two-hour expiry. It is HMAC-SHA256 signed with a domain-separated key derived from the existing `EVOLUTION_API_KEY`; no new secret or database column is required.

The upload page and server actions accept the grant only when all conditions hold:

1. the signature is valid using constant-time comparison;
2. the grant has not expired;
3. the referenced WhatsApp session still exists and is active;
4. the session step is `ask_audio` or `ask_cover`.

Completing the upload moves the session to metadata confirmation, which makes the grant unusable. The page is `noindex`, `no-store`, and sends a `no-referrer` policy so the bearer grant is not cached or forwarded.

### Direct resumable upload

Cloudflare never receives the media bytes. A server action validates the grant and issues a Supabase signed upload token for an unguessable path under `release-assets/<tenant>/whatsapp/<session>/`. The browser uploads with `tus-js-client` directly to the Supabase resumable endpoint, using retries and progress callbacks.

The signed upload token is scoped to one path and expires according to Supabase Storage. Files use unique object names and are never overwritten, avoiding CDN stale-content behavior.

### Independent validation

The browser performs a fast preflight for immediate feedback, but completion never trusts browser metadata. The server fetches bounded byte ranges from the stored object and parses the actual headers:

- PNG, JPEG, and WebP dimensions are read from their binary headers.
- RIFF/RF64 chunks are scanned until `fmt ` is found; the parser verifies PCM format 1, two channels, 44,100 Hz, and 16 bits.
- Storage object existence, non-zero size, and content type are verified before the session is updated.
- Any invalid object is removed. Both successfully validated URLs are persisted together only after every check passes.

### WhatsApp continuation

After both files pass validation, the server:

1. parses title and participants from the WAV filename using the existing WhatsApp parser;
2. resolves or creates artists through the existing tenant-scoped handler DB;
3. stores `audio_url`, `cover_url`, filename, title, and resolved artists in the active session draft;
4. advances to `confirm_file_metadata` when filename metadata is sufficient, otherwise to `ask_metadata_correction`;
5. sends the corresponding continuation message through the existing Evolution HTTPS provider.

The page shows success, attempts `window.close()`, then redirects to the Audiolink WhatsApp deep link. Browsers do not guarantee that a page opened by an app may close itself, so a visible `Voltar ao WhatsApp` button remains as the deterministic fallback.

## Interface

The public route is `/envio/[grant]`. It is excluded from the authenticated CRM shell and uses the existing dark tokens: near-black background, graphite cards, Audiolink green, DM Sans, rounded controls, and the same button motion.

Mobile layout:

- compact Audiolink/AeR masthead and security/expiry note;
- two large upload cards, cover first and WAV second;
- explicit requirement chips and filename/technical-summary states;
- per-file progress bars, retry/cancel behavior, and accessible status text;
- one final `Enviar arquivos` action enabled only after both local validations pass;
- success state with a short countdown and WhatsApp return action.

No CRM navigation, tenant details, phone number, storage token, or internal identifiers are rendered.

## Error Handling

- Invalid or expired grant: neutral expired-link screen instructing the artist to request a new link in WhatsApp.
- Invalid local file: upload does not start and the exact failed requirement is shown.
- Interrupted upload: TUS retries and resumes from its stored fingerprint.
- Server-side validation failure: invalid objects are deleted and the page allows replacement without advancing the session.
- Evolution reply failure after successful persistence: files and session state remain saved; the page still returns to WhatsApp with a message asking the artist to type `continuar`.
- Repeated completion: returns the already-completed state without creating duplicate catalog records.

## Verification

- Unit tests for grant signing/tamper/expiry and all binary parsers.
- Server-action tests for tenant/session scope, signed paths, invalid-object cleanup, atomic session advancement, and safe Evolution failures.
- Webhook tests proving the temporary link is sent on both single and album paths and that plain text at `ask_audio` renews the link instead of being treated as audio.
- Component tests for requirements, disabled/enabled action, progress, errors, success, and WhatsApp fallback.
- Existing WhatsApp and web suites, lint, typecheck, production build, dependency audit, and secret scan.
- Production E2E with the real test WAV and a generated compliant square cover, followed by sanitized Supabase readback and a controlled WhatsApp continuation check.

## Operational Boundaries

- A browser cannot guarantee automatic tab closure; deep-link redirect plus a visible fallback is the reliable behavior.
- “Any size” means no AeR Digital cap. Supabase plan/global limits still apply; current `release-assets` has no bucket-specific size restriction.
- A controlled webhook or database readback does not by itself prove a real handset round trip. Final WhatsApp confirmation must distinguish infrastructure checks from an observed message on the device.

