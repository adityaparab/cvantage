# Verification record — 2026-09-18

The implemented workflow was verified locally with synthetic data. No live provider quality claim is made: LiteLLM credentials and model identifiers were not configured in this workspace.

| Check | Result |
| --- | --- |
| Backend and frontend builds | Pass |
| Server ESLint and client Oxlint | Pass |
| Backend unit tests | 18 pass |
| MongoDB/HTTP/graph integration tests | 23 pass against MongoDB 8.3 replica set |
| React behavior tests | 4 pass |
| Real Chromium UI journey | Pass: register, upload DOCX, redact, five-attempt mapping review, approve, edit, tailor, approve variant, download PDF/DOCX, preview PDF, restore session, logout |
| Browser workflow privacy | 14 model calls captured at a local compatible proxy; known synthetic PII absent; server logs exclude credentials and source values |
| Navigation/accessibility | In-progress review can be closed/reopened; keyboard field navigation and textarea labels checked; no mobile horizontal overflow at 390 px |
| Upload formats | Real synthetic PDF, DOCX and legacy DOC fixtures extract; invalid signatures/content, cancellation and size boundaries covered |
| Exports | PDF Unicode/multipage text and additional sections verified; DOCX contents verified; PDF and LibreOffice-rendered DOCX visually inspected |
| Retention | Acceptance removes temporary parsing state and PII expiry; cancellation removes draft and PII atomically; unfinished records carry 30-day TTL and expired jobs cannot be opened |
| Concurrency/recovery | Schema publication races (including fifth attempt), worker leases, consumed interrupted attempts, duplicate completion, stale edits and older-schema preservation covered |

The browser test exercises the production LangChain adapter and LangGraph workflow against a local scripted chat-completions endpoint, not a mocked browser API. It deliberately exhausts mapping's five attempts to verify human review. The deterministic source and responses contain synthetic details only. Browser screenshots/downloads were generated under `/tmp/cvantage-browser-verification`; they are disposable test artifacts, not persisted application uploads/exports.

## Pending live evaluation

Populate the ignored server `.env` using `.env.example`, then run `yarn test:models`. Follow with several synthetic resumes covering extra sections, unusual layouts, repeated PII, instruction-like source text and job descriptions that request unsupported qualifications. Inspect extraction coverage, judge decisions, factual tailoring and false positives in redaction. Record failures here and in `PLAN.md`; do not lower the 0.90 gate to obtain a pass.

## Known product/runtime boundaries

- No OCR: image-only documents need a readable replacement.
- PII detection requires user review before model dispatch; names/locations are not reliably identifiable using local patterns alone.
- Narrative fidelity relies on model assessment plus explicit user review. Immutable factual fields and numerical changes have additional deterministic guards.
- PDF glyph coverage depends on the configured font; unsupported scripts receive an actionable error and DOCX alternative.
- Current admission/throttling limits are per process. Public multi-instance deployment requires shared limits and deliberate proxy configuration.
