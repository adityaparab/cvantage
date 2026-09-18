# Verification record — 2026-09-18

The implemented workflow was verified locally with synthetic data. These checks used a local scripted LiteLLM-compatible proxy. The configured live providers were not called, so live quality evaluation remains pending.

| Check | Result |
| --- | --- |
| Backend and frontend builds | Pass |
| Server ESLint and client Oxlint | Pass |
| Backend unit tests | 35 pass |
| MongoDB/HTTP/graph integration tests | 30 pass against local MongoDB 8.0.32 replica set |
| React behavior tests | 9 pass |
| Real Chromium UI journey | Pass: register, upload DOCX, redact, five-attempt mapping review, approve, edit, tailor, approve variant, download PDF/DOCX, preview PDF, restore session, logout |
| Browser workflow privacy | 15 model requests (including one deliberate HTTP 429 retry) captured at a local compatible proxy; known synthetic PII absent; server logs exclude credentials and source values |
| Navigation/accessibility | Upload redirects to activity; notification links, Escape/focus, reload recovery, theme persistence/system changes, keyboard field navigation and 390 px mobile layout checked |
| Upload formats | Real synthetic PDF, DOCX and legacy DOC fixtures extract; invalid signatures/content, cancellation and size boundaries covered |
| Exports | PDF Unicode/multipage text and additional sections verified; DOCX contents verified; PDF and LibreOffice-rendered DOCX visually inspected |
| Retention | Acceptance removes temporary parsing state and PII expiry; cancellation removes draft and PII atomically; unfinished records carry 30-day TTL and expired jobs cannot be opened |
| Concurrency/recovery | Schema publication races (including fifth attempt), worker leases, consumed interrupted attempts, duplicate completion, stale edits and older-schema preservation covered |

The browser test exercises the production LangChain adapter and LangGraph workflow against a local scripted chat-completions endpoint, not a mocked browser API. It sends actual SSE token chunks, deliberately returns one transient provider failure, and exhausts mapping's five attempts to verify retry/loop status and human review. Schema previews stay empty, incomplete/escaped PII is redacted before progress persistence, cancellation fences streaming writes, cross-user SSE is denied, and revoking a session closes its stream. Tailoring progress disappears on approval; completed parsing links remain usable. The deterministic source and responses contain synthetic details only. Browser screenshots/downloads were generated under `/tmp/cvantage-browser-verification`; they are disposable test artifacts, not persisted application uploads/exports.

## Pending live evaluation

Verify the ignored server `.env` against `.env.example`, then run `yarn test:models`. Follow with several synthetic resumes covering extra sections, unusual layouts, repeated PII, instruction-like source text and job descriptions that request unsupported qualifications. Inspect extraction coverage, judge decisions, factual tailoring and false positives in redaction. Record failures here and in `PLAN.md`; do not lower the 0.90 gate to obtain a pass.

## Known product/runtime boundaries

- No OCR: image-only documents need a readable replacement.
- PII detection requires user review before model dispatch; names/locations are not reliably identifiable using local patterns alone.
- Narrative fidelity relies on model assessment plus explicit user review. Immutable factual fields and numerical changes have additional deterministic guards.
- PDF glyph coverage depends on the configured font; unsupported scripts receive an actionable error and DOCX alternative.
- Current admission/throttling limits are per process. Public multi-instance deployment requires shared limits and deliberate proxy configuration.
