# Verification record — 2026-09-19

The implemented workflow was verified locally with synthetic data. These checks used a local scripted LiteLLM-compatible proxy. The configured live providers were not called, so live quality evaluation remains pending.

| Check | Result |
| --- | --- |
| Backend and frontend builds | Pass |
| Server ESLint and client Oxlint | Pass |
| Backend unit tests | 45 pass |
| MongoDB/HTTP/graph integration tests | 41 pass against an isolated local replica set |
| React behavior tests | 15 pass |
| Real Chromium UI journey | Pass: register, upload DOCX, redact, five-attempt mapping review, approve, edit, tailor, approve variant, download PDF/DOCX, preview PDF, restore session, logout |
| Browser workflow privacy | 15 model requests (including one deliberate HTTP 429 retry) captured at a local compatible proxy; known synthetic PII absent; server logs exclude credentials and source values |
| Navigation/accessibility | Upload opens editable redaction review; approval redirects to activity; notification links, Escape/focus, reload recovery, theme persistence/system changes, keyboard field navigation and 390 px mobile layout checked |
| Upload formats | Real synthetic PDF, DOCX and legacy DOC fixtures extract; invalid signatures/content, cancellation and size boundaries covered |
| Exports | PDF Unicode/multipage text and additional sections verified; DOCX contents verified; PDF and LibreOffice-rendered DOCX visually inspected |
| Retention | Acceptance removes temporary parsing state and PII expiry; cancellation removes draft and PII atomically; unfinished records carry 30-day TTL and expired jobs cannot be opened |
| Concurrency/recovery | Schema publication races without revalidation, worker leases, consumed interrupted attempts, duplicate completion, stale edits and older-schema preservation covered |

The browser test exercises the production LangChain adapter and LangGraph workflow against a local scripted chat-completions endpoint, not a mocked browser API. It sends actual SSE token chunks, deliberately returns one transient provider failure, and exhausts mapping's five attempts to verify retry/loop status and human review. Schema previews stay empty, incomplete/escaped PII is redacted before progress persistence, cancellation fences streaming writes, cross-user SSE is denied, and revoking a session closes its stream. Tailoring progress disappears on approval; completed parsing links remain usable. The deterministic source and responses contain synthetic details only. Browser screenshots/downloads were generated under `/tmp/cvantage-browser-verification`; they are disposable test artifacts, not persisted application uploads/exports.

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
