# Verification record — 2026-09-19

The implemented workflow was verified locally with synthetic data. These checks used a local scripted LiteLLM-compatible proxy. The configured live providers were not called, so live quality evaluation remains pending.

| Check | Result |
| --- | --- |
| Backend and frontend builds | Pass |
| Server ESLint and client Oxlint | Pass |
| Backend unit tests | 70 pass |
| MongoDB/HTTP/graph integration tests | 53 pass against an isolated local replica set |
| React behavior tests | 38 pass |
| Real Chromium UI journey | Pass: register, upload DOCX, redact, five-attempt mapping review, approve, edit, tailor, approve variant, download PDF/DOCX, preview PDF, restore session, logout |
| Browser workflow privacy | 21 model requests (including one deliberate HTTP 429 retry) captured at a local compatible proxy; known synthetic PII absent; server logs exclude credentials and source values |
| Navigation/accessibility | Upload opens editable redaction review; approval redirects to activity; notification links, Escape/focus, reload recovery, theme persistence/system changes, keyboard field navigation and 390 px mobile layout checked |
| Upload formats | Real synthetic PDF, DOCX and legacy DOC fixtures extract; invalid signatures/content, cancellation and size boundaries covered |
| Exports | PDF Unicode/multipage text and additional sections verified; DOCX contents verified; PDF and LibreOffice-rendered DOCX visually inspected |
| Retention | Acceptance removes temporary parsing state and PII expiry; cancellation removes draft and PII atomically; unfinished records carry 30-day TTL and expired jobs cannot be opened |
| Concurrency/recovery | Schema publication races without revalidation, worker leases, consumed interrupted attempts, duplicate completion, stale edits and older-schema preservation covered |

The browser test exercises the production LangChain adapter and LangGraph workflow against a local scripted chat-completions endpoint. The successful job URL import response is intercepted with synthetic page text; network-fetch boundaries are tested separately, and a private URL is rejected through the actual API. It sends actual SSE token chunks, deliberately returns one transient provider failure, and exhausts mapping's five attempts to verify retry/loop status and human review. Schema previews stay empty, incomplete/escaped PII is redacted before progress persistence, cancellation fences streaming writes, cross-user SSE is denied, and revoking a session closes its stream. Tailoring progress disappears on approval; completed parsing links remain usable. The deterministic source and responses contain synthetic details only. Browser screenshots/downloads were generated under `/tmp/cvantage-browser-verification`; they are disposable test artifacts, not persisted application uploads/exports.

## Pending live evaluation

Verify the ignored server `.env` against `.env.example`, then run `yarn test:models`. Follow with several synthetic resumes covering extra sections, unusual layouts, repeated PII, instruction-like source text and job descriptions that request unsupported qualifications. Inspect extraction coverage, judge decisions, factual tailoring and false positives in redaction. Record failures here and in `PLAN.md`; do not lower the 0.90 gate to obtain a pass.

## Known product/runtime boundaries

- No OCR: image-only documents need a readable replacement.
- PII detection requires user review before model dispatch; names/locations are not reliably identifiable using local patterns alone.
- Narrative fidelity relies on model assessment plus explicit user review. Immutable factual fields and numerical changes have additional deterministic guards.
- PDF glyph coverage depends on the configured font; unsupported scripts receive an actionable error and DOCX alternative.
- Current admission/throttling limits are per process. Public multi-instance deployment requires shared limits and deliberate proxy configuration.

## Supplied-schema baseline verification

Startup seeds the exact `schema/schema.json` contents once, including during concurrent first starts. Tests cover retaining approved additions on restart, additive adoption into an existing registry, safe rollback on incompatible legacy types, unchanged historical records, supported nested additions, rejection of replacements and unsupported source evidence, local date-reference validation, and PII separation. The Chromium journey now uses `basics.summary`, `work`, and `skills[].name/keywords`, checks that unchanged coverage creates no new schema version, and exercises both export formats. Old-layout export and tailoring tests remain in place. Verification used a temporary MongoDB instance; application services were not restarted.

## Single-pass schema modification

Schema preparation runs one worker proposal and at most one judge check. Integration regressions verify no second pass after rejection, invalid/PII output, publication conflicts (with or without additions), or interrupted work, including legacy jobs with already-consumed attempts. Mapping still stops after five attempts and can accept on its fifth attempt. Client tests verify a one-attempt preparation limit, hidden schema output, and no promise of another pass after rejection.

The Chromium journey passed with the installed Chrome executable (`BROWSER_EXECUTABLE=/usr/bin/google-chrome`), confirming preparation 1/1 and extraction 5/5 before approval and both exports. Its scripted proxy received 15 redacted requests, including the existing temporary transport-failure check. Artifacts are in `/tmp/cvantage-one-pass-browser`. Temporary test services and the isolated MongoDB instance were stopped after verification.

## Local startup setup — 2026-09-19

Verified `yarn setup` against a uniquely named disposable Compose project: an absent container starts, a running container stops/starts without recreation, and a stopped container starts without another stop. Each run waited for MongoDB health; a stored marker survived both restart paths. An unreachable Docker daemon made `yarn start` fail before the client build or NestJS launch. A successful actual `yarn start` ran setup, built the client, compiled/started NestJS and returned HTTP 200 from `/api/health`. The pre-existing local MongoDB container retained its ID and start time. Temporary test services, network and test volumes were removed. Script syntax/formatting and diff checks passed; the unrelated application test suite was not rerun for this script-only change.

## Editable redaction review — 2026-09-19

Full build/both linters, 45 unit tests, 41 MongoDB/HTTP integration tests and 15 client tests passed. Integration checks prove no model call before approval, edited text persistence, canonical marker delivery, repeated PII checks, and stale-approval rejection. Client tests cover selection redaction, checkbox reset after edits, failed approval preserving edits, and links recovering to the appropriate stage. The Chromium journey verifies separate upload review, reload/notification links, typed markers, manual edits, no pre-approval model requests, and the complete parsing/review/tailoring/export flow. Desktop/mobile review screenshots were inspected; artifacts are in `/tmp/cvantage-redaction-browser`. Marker normalization is local and handles explicit aliases; unknown placeholders remain unchanged. Live-provider evaluation remains separate.

## Database wipe command — 2026-09-19

All 49 integration tests pass, including 8 database-wipe cases. Disposable databases prove exact confirmation is required, system/invalid names are refused, credentials are not exposed on configuration errors, and wiping leaves sibling databases intact. The next real database-service initialization recreates indexes and seeds the exact supplied schema once. The actual `yarn db:wipe` terminal prompt was exercised for cancellation and exact-name confirmation. Environment precedence (including explicit empty values) was verified before testing to ensure `.env` could not redirect a disposable target. Script syntax/formatting and server lint pass. The user's database was never wiped; temporary test data and the isolated test MongoDB instance were removed.

## Inline resume review — 2026-09-19

Full build, client lint and all 21 client tests pass. Field regressions cover readable defaults, one active editor, accepted versus cancelled drafts, Escape and focus restoration, nested/discovered fields, array additions/removals, optional clearing, zero/false values, numeric validation and approval payloads. The Chromium journey passes against isolated MongoDB and a local scripted proxy, including review/source/tailored editing, pending-edit guards, hover/keyboard pencil visibility, touch targets, light/dark and 390 px layouts, persisted corrections, and PDF/DOCX exports. Desktop and mobile review screenshots were inspected in `/tmp/cvantage-inline-browser`. Backend unit/integration suites were not rerun for this frontend-only change; their preceding results above remain unchanged. No live model calls were made.

## Resume field/group deletion — 2026-09-19

Full build/client lint and 25 client tests pass. New tests cover scalar/object/array-group removal, undo, schema preservation, required-field protection and prevention of undo overwriting subsequent edits. The Chromium workflow confirms deletion of an individual date and a skills group survives approval, saved editing and tailoring inputs, and both exports still succeed. Desktop/mobile screenshots were inspected in `/tmp/cvantage-delete-browser`. This frontend change used only synthetic data and a local scripted model proxy; backend unit/integration suites were not rerun.

## Redaction review readiness — 2026-09-19

Full build/client lint and 32 client tests pass. Regression coverage includes immediate upload content, route remount handoff and clearing on exit, empty/missing text progressing to ready, request failure/retry, a 30-second timeout, aborted/unmounted requests, ignored late responses and preservation of manual edits. The Chromium journey now checks the first post-upload visit before any reload and confirms no redundant job read. A controlled delayed response exercises the progress indicator and automatic text refresh on the same page; all parsing, deletion, tailoring and export checks still pass. The loading screenshot was inspected in `/tmp/cvantage-redaction-loading-browser`. Tests use synthetic data, an isolated MongoDB replica set and a local scripted model endpoint; backend unit/integration suites were not rerun for these client changes. Temporary test services were removed.

## Resume sections — 2026-09-19

Full build, both linters, 45 backend unit, 51 database/HTTP and 33 client tests pass. The synthetic Chromium journey verifies primary navigation, dedicated upload/review routes, source editing without tailoring controls, the tailoring selector and both exports. Deletion coverage includes confirmation, ownership, CSRF, stale revisions, related-record cleanup, sibling preservation and generation racing with deletion. Browser artifacts: `/tmp/cvantage-sections-browser`.

## Job import and streamed analysis — 2026-09-19

Build/both linters, 67 unit, 52 integration and 35 client tests pass. URL tests cover public-address pinning, private/mixed DNS, redirects, response limits, HTML extraction and local redaction. HTTP tests cover authentication/CSRF boundaries and malformed/PII-bearing analysis rejection. Browser verification uses the actual streaming adapter against a scripted local proxy and displays both new analysis stages before wording/review (17 redacted requests); PDF/DOCX exports pass. Analysis screenshot inspected in `/tmp/cvantage-analysis-browser`. External job sites and live models were not called.

## Tailoring screens and final restructuring — 2026-09-19

Full build, both linters, 70 backend unit tests, 53 database/HTTP integration tests and 38 client tests pass. Selection tests cover subsets, no changes, historical schemas, unknown/duplicate/factual paths, stale revisions, ownership, retained proposals and unchanged source resumes. Client tests verify selected-ID payloads, failed-save behavior and notification routes.

The Chromium journey now covers pasted descriptions and imported text, actual rejection of private URLs, mandatory privacy review, partial streamed resume/job output while each step is active, reload recovery, suggestions and results on separate routes, subset/no-change application, persisted results, approval, both downloads, saved analysis summaries, previous-version links and confirmed/cancelled resource deletion. It captures 21 redacted model requests. Desktop/mobile suggestions and result/input screenshots were inspected in `/tmp/cvantage-tailoring-browser`; browser checks assert no horizontal mobile overflow. External job sites and live providers remain untested. Temporary test services are cleaned up after verification; existing application services are untouched.
