# CVantage Implementation Plan and Progress Tracker

## Scope and execution

Implement the upload → parse → user review → tailor → download flow defined in [PROJECT.md](PROJECT.md). Automated job discovery and application submission are out of scope.

`PROJECT.md` is the product source of truth; this plan proposes implementation choices. Start with [AGENT.md](AGENT.md), follow [CLAUDE.md](CLAUDE.md), and load the relevant installed skills listed below. Implement one coherent milestone at a time. Use this file as the ongoing progress tracker, not just an initial proposal.

## Status and next action

**Current state:** milestones 0–19 are merged, including deletion controls in [PR #20](https://github.com/adityaparab/cvantage/pull/20). Milestone 20 is implemented and verified on `feat/redaction-review-loading`.
**Next action:** live provider evaluation and Railway remain separate. [PR #21](https://github.com/adityaparab/cvantage/pull/21) records the redaction loading fix and its merge status.

| Milestone | Status | Depends on | Completion evidence |
| --- | --- | --- | --- |
| 0. Specification, agent instructions, and skills | Complete | — | `PROJECT.md`, `AGENT.md`, installed skills and source manifest; skill metadata, links, and upstream copies validated |
| 1. Configuration, persistence, and contracts | Complete | 0 | Build, both linters, 8 unit tests and 6 real MongoDB/HTTP integration tests pass |
| 2. Authentication and application shell | Complete | 1 | Full build, server/client lint, 8 unit tests, 9 MongoDB/HTTP tests, 2 client behavior tests |
| 3. Upload, extraction, and PII separation | Complete | 1–2 | Full build, both linters, 14 unit, 10 integration, 2 client tests; real PDF/DOCX/DOC fixtures |
| 4. Global schema registry and bounded parsing graph | Complete (offline); live evaluation pending | 1–3 | Server build/lint, 14 unit and 18 integration tests; bounded graph and recovery tested |
| 5. User review and schema-driven editing | Complete | 4 | Full build, both linters, 20 integration and 4 client tests |
| 6. Job-specific tailoring | Complete (offline) | 5 | Full build, both linters, 15 unit, 21 integration and 4 client tests |
| 7. On-demand PDF and DOCX export | Complete | 3, 5; 6 for tailored variants | Build/lint, 18 unit, 21 integration, 4 client tests; PDF and LibreOffice DOCX visual checks |
| 8. End-to-end readiness and documentation | Offline checks complete; live evaluation pending | 1–7 | Build/lint; 18 unit, 23 integration, 4 client tests; full Chromium journey and desktop/mobile visual checks |
| 9. Separate local MongoDB deployment | Complete | 1, startup diagnostics | Compose validation; fresh/repeated startup; 26 integration tests; transaction persistence across recreation; actual app API/UI HTTP 200 |
| 10. Internal schemas and parsed-resume approval | Complete | 4–5 | Build/lint; 29 unit, 26 integration, 5 client tests; full Chromium journey |
| 11. Light/dark/system appearance | Complete | 2 | Build/client lint; 7 client tests; Chromium system changes/reload persistence; light/dark screenshots inspected |
| 12. Streamed workflow activity and notifications | Complete | 10–11 | Full build/both linters; 35 unit, 30 integration, 9 client tests; Chromium streaming/retry/loop/reload/notification/approval/export journey |
| 13. Seeded additive resume schema | Complete | 4, 10, 12 | Full build/both linters; 40 unit, 36 integration, 10 client tests; Chromium extraction/edit/tailor/export using the supplied layout |
| 14. Single-pass schema modification | Complete | 13 | Full build/both linters; 40 unit, 41 integration, 11 client tests; Chromium verifies one preparation pass and five mapping attempts |
| 15. Local startup setup command | Complete | 9 | Real isolated Compose absent/stopped/running checks; data preserved; setup failure blocks startup; full yarn start reaches HTTP 200 |
| 16. Editable redaction review before parsing | Complete | 3, 12 | Full build/both linters; 45 unit, 41 integration, 15 client tests; browser review → activity → export and desktop/mobile inspection |
| 17. Explicit database wipe command | Complete | 15 | 49 integration tests including 8 wipe regressions; actual interactive yarn command cancellation/confirmation; user database untouched |
| 18. Resume review with inline editing | Complete | 5, 10, 13 | Full build/client lint; 21 client tests; Chromium inline review/source/tailored edits, touch/keyboard and exports; light/dark mobile inspection |

| 19. Delete resume fields and groups | Complete | 18 | Full build/client lint; 25 client tests; Chromium deletion/undo and persisted deletions through tailoring/export |
| 20. Redaction review readiness | Complete | 16 | Full build/client lint; 32 client tests; Chromium first navigation without refetch, delayed readiness/progress, and full review-to-export journey |

### How to maintain progress

- Before work, mark the active milestone `In progress`. Use `Blocked` only for a concrete dependency preventing its remaining work; record that dependency and continue unaffected tasks.
- Check off a task only after its deliverable exists and relevant checks pass. Leave partial tasks unchecked and record what remains in the progress log.
- After each implementation session, update the status table, task checkboxes, next action, and progress log together. Record changed paths, actual verification results, and any blocker or decision.
- Mark a milestone `Complete` only when its completion criteria pass. Skill installation, a scaffold, or mocked success alone does not complete an application feature.
- Keep stable milestone numbers for references. If scope changes, revise pending work and explain the decision without discarding completed evidence.

### Branch and PR workflow

Each milestone uses its own `feat/<feature-name>` branch. Verify changes, update this tracker, push the branch, create and attach a PR, and merge it before starting the next milestone from updated `main`. Record PR URLs and merge evidence in the progress log. Do not bypass failing checks or branch protections.

## Skills to use during implementation

Use project-specific skills for CVantage invariants and upstream skills for library mechanics. Links to every skill are in [AGENT.md](AGENT.md); pinned upstream sources are recorded in [SOURCES.md](.claude/skills/SOURCES.md). Read only the relevant skills and their TypeScript references, not the entire catalog for every task.

| Milestone | Applicable skills |
| --- | --- |
| 1 | `nestjs`, `resume-persistence`, `mongodb-connection`, `mongodb-schema-design`, `langchain-dependencies` |
| 2 | `nestjs`, `react`, `resume-persistence` |
| 3 | `nestjs`, `react`, `resume-documents`, `resume-persistence` |
| 4 | `nestjs`, `resume-ai-workflow`, `resume-persistence`, `langchain-fundamentals`, `langgraph-fundamentals`, `langgraph-persistence` |
| 5 | `nestjs`, `react`, `resume-persistence`, `resume-ai-workflow`, `langgraph-human-in-the-loop` |
| 6 | `nestjs`, `react`, `resume-ai-workflow`, `langchain-fundamentals` |
| 7 | `nestjs`, `react`, `resume-documents` |
| 8 | Skills for the behavior under test; `mongodb-query-optimizer` when addressing measured query/index performance |

Load `langchain-middleware` when implementing model/tool hooks, and `langchain-dependencies` when changing AI packages. Generic examples must not replace LiteLLM, MongoDB, source-version preservation, privacy requirements, or the bounded worker–judge workflow. Installing these skills has not installed application packages or connected external services.

## Original starting baseline

The following describes the repository before milestone 1; the status table above records current implementation.

- Backend: NestJS with `/api/hello`, `/api/health`, and production serving of the compiled React app. No authentication, MongoDB integration, document processing, or AI workflow is implemented.
- Frontend: React, TypeScript, Vite, and React Router with starter screens. Development requests to `/api` proxy to NestJS.
- Verification: backend Jest unit tests, Supertest API tests, server ESLint, client Oxlint, and builds for both applications. No client test runner is configured.
- Preserve the `/api` prefix, SPA routing, and health endpoint while replacing starter UI incrementally.

## Proposed architecture

Keep one NestJS application and the existing React client. Use thin controllers, application services for orchestration, and independently testable validators and transformation functions. Avoid adding another service or queue infrastructure until the workflow requires it.

| Backend area | Responsibility |
| --- | --- |
| `config`, `database` | Validated server configuration, MongoDB connection, indexes |
| `auth` | Registration, login, logout, session lookup, ownership enforcement |
| `resumes` | Structured resume records, revisions, separate PII, review decisions |
| `documents` | Content validation, text extraction, local PII detection/redaction, temporary-file cleanup |
| `resume-schemas` | Global immutable schema versions, validation, atomic publication |
| `ai` | LiteLLM adapter, LangChain model calls, prompt contracts, response validation |
| `parsing` | LangGraph workflow, job state, iteration limits, checkpoints, review pauses |
| `tailoring`, `exports` | Factual tailoring, separate variants, PDF/DOCX rendering |

Use authenticated activity snapshots and SSE for long-running work; poll lightweight notification summaries and fall back to snapshots if the stream disconnects. Store workflow state in MongoDB, with a single active lease per job and bounded concurrency. Uploaded file bytes never enter job records or graph checkpoints. Start durable AI processing only after extraction, redaction, and original-file cleanup succeed.

### Persistence boundaries

| Record | Essential fields and invariants |
| --- | --- |
| User/session | Normalized unique email, password hash; expiring and revocable sessions |
| Resume | Owner ID, structured data, extraction schema version, revision, acceptance source; no PII |
| Resume PII | Owner ID, resume ID, name, contact number, email, location; restricted queries and responses |
| Schema version | Unique version, approved definition, definition hash, publication metadata; immutable and free of user values |
| Schema registry | Current approved version and revision for atomic publication |
| Parse job/review draft | Owner ID, stage, separate iteration counters, schema reference, redacted candidates, judge results, status, lease, timestamps |
| Tailored variant | Owner ID, source resume ID and revision, schema version, tailored data, review status; never overwrites the source |

Use optimistic revision checks for user edits and atomic writes for approvals. Ensure the schema registry can advance only to a persisted approved version. Choose the MongoDB transaction/atomic-update strategy in milestone 1 and document its deployment requirements.

### API surface

Define DTOs and error contracts before wiring screens. Proposed routes under `/api`:

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
- `POST /resumes/upload`; return a resume/job reference after local extraction and cleanup.
- `GET /parsing-jobs/:id` and `POST /parsing-jobs/:id/cancel`.
- `GET /resumes`, `GET /resumes/:id`, `PATCH /resumes/:id`.
- `GET /resumes/:id/pii`, `PATCH /resumes/:id/pii`.
- `GET /resumes/:id/review`, `POST /resumes/:id/review` for stage-specific corrections and approval.
- `GET /resume-schemas/:version` for the definition needed by the editor.
- `POST /resumes/:id/tailor`, `GET /resumes/:id/variants/:variantId`, `PATCH /resumes/:id/variants/:variantId`.
- `POST /resumes/:id/export` with selected variant, if any, and `pdf` or `docx` format.

Every resume, PII, job, review, and variant operation enforces ownership on the server. Return actionable validation errors without source text, credentials, or PII. Use consistent processing, review-required, failure, and conflict states.

## Milestones

### 0. Specification, agent instructions, and skills

- [x] Define the product workflow, judge contract, formats, privacy boundaries, and schema versioning in `PROJECT.md`.
- [x] Create GPT-6 repository guidance in `AGENT.md`, based on `CLAUDE.md`.
- [x] Preserve the existing NestJS and React skills and add project-specific persistence, AI workflow, and document-processing skills.
- [x] Install six official LangChain/LangGraph skills and three official MongoDB skills, retaining their supporting references and recording source revisions.
- [x] Establish the implementation milestones and progress tracking in this file.

Completion: instructions and skill routing exist; new skill metadata and local entry-point links are valid; installed dependency skills match their pinned upstream sources. This milestone provides development context, not implemented product features.

### 1. Configuration, persistence, and contracts

Dependencies: milestone 0.

- [x] Inspect Node/Yarn versions, manifests, lockfiles, and current scripts. Select compatible TypeScript dependencies for configuration, validation, and MongoDB; defer LangChain/LangGraph package selection to their milestone 4 integration. Record chosen versions and required runtime changes without rewriting unrelated dependencies.
- [x] Add validated configuration for MongoDB, sessions, the LiteLLM base URL, credentials, `LITELLM_WORKER_MODEL`, and `LITELLM_JUDGE_MODEL`. Provide a placeholder-only `.env.example`.
- [x] Integrate MongoDB and define repositories, indexes, revisions, and atomic publication/approval operations.
- [x] Define upload, job-state, review, schema, and judge DTOs. Centralize runtime validation and the exact judge acceptance predicate from `PROJECT.md`.
- [x] Choose a supported JSON Schema dialect and a documented subset that both the validator and dynamic editor support. Require the four base sections while allowing source-driven additions; preserve existing fields when extending a schema.
- [x] Add injectable adapters for document extraction, LLM calls, and rendering so tests can avoid network services.
- [x] Document and verify local MongoDB/test database setup, including replica-set configuration if required by the selected publication strategy.

Completion: startup validates required configuration without exposing secrets; repository integration tests verify ownership fields, unique indexes, revision conflicts, and atomic schema publication. Document any replica-set requirement for transactions.

### 2. Authentication and application shell

Dependencies: milestone 1.

- [x] Implement email/password registration, password hashing, login, logout, and current-user lookup. Use server-managed sessions with HttpOnly cookies, appropriate Secure/SameSite settings, and CSRF protection for mutations.
- [x] Add request validation, login throttling, and owner-scoped access helpers.
- [x] Replace starter screens with registration/login, a protected resume list, navigation, and shared loading/error states.
- [x] Add a small client test setup for critical interactions as real features arrive.

Completion: a user can register, sign in, refresh the page, and sign out. Tests prove unauthenticated and cross-user requests cannot access protected data, including PII and job status.

### 3. Upload, extraction, and PII separation

Dependencies: milestones 1–2.

- [x] Evaluate parser adapters against representative PDF, DOCX, and legacy DOC fixtures; include any required system executable in setup documentation. Do not assume DOC is interchangeable with DOCX.
- [x] Enforce the 20,000,000-byte limit before buffering oversized uploads; verify document signatures/content and reject malformed, encrypted/unsupported, or unreadable documents clearly.
- [x] Bound extraction time, memory, decompression, and parser concurrency. Prefer memory; isolate and clean up parser-required temporary files on success, failure, cancellation, and abandoned-job recovery.
- [x] Collect user-confirmed name/location and locally detect/redact email/phone, store them separately, and redact their occurrences before any LLM request. Apply the same checks to later edits and job descriptions before model use.
- [x] Add a pre-LLM correction screen for uncertain PII detection; do not send unredacted text to a model to identify PII. Use synthetic fixtures to exercise names, locations, repeated values, headers, and footers.
- [x] Show upload validation, extraction progress, and actionable errors in React. Reject image-only documents without readable text until OCR is explicitly included.

Completion: each allowed format extracts correctly; boundary-size and misleading-extension cases are tested; no original file survives processing. Captured model-input fixtures contain none of the known test PII.

### 4. Global schema registry and bounded parsing graph

Dependencies: milestones 1–3. Apply the retention policy below to durable source/checkpoint storage.

- [x] Integrate LangChain through the configurable LiteLLM adapter. Provide a synthetic smoke command (live execution pending credentials; tracked in milestone 8); validate outputs locally even when provider structured outputs are available.
- [x] Implement LangGraph stages: schema worker → schema judge → publish/reuse schema → mapping worker → mapping judge → save accepted resume, with explicit revision and review branches.
- [x] Limit schema modification to one worker–judge pass and mapping to five iterations, including the first attempt (updated in milestone 14). Stop on acceptance; malformed judge responses consume an iteration. Bound transport retries and timeouts separately.
- [x] Implement the exact acceptance gate: valid response, matching stage, `accept`, four true checks, confidence at least 0.90, empty issues, and successful application schema/PII validation.
- [x] Supply source text as data, separate from instructions. Validate and sanitize worker output and judge feedback before persistence or reuse. Grant parsing models no unrelated tools.
- [x] Publish only approved global schemas. Reuse unchanged definitions, publish atomically, and report schema publication conflicts as processing failures without a second pass (updated in milestone 14).
- [x] Pin the schema version before mapping and record it on the accepted resume. Leave existing resumes unchanged when a new global version appears.
- [x] Persist counters and sanitized workflow state, implement leases and cancellation, and make resume saving/publication idempotent. Recovery must not reset iteration budgets; ambiguous interrupted calls must not permit unbounded retries.

Completion: deterministic fake-model tests cover early acceptance, fifth-iteration mapping acceptance, exhaustion in either stage, invalid/contradictory judge output, transport failures, concurrent publication, restart recovery, and duplicate completion. No unapproved candidate becomes an accepted resume or global schema.

### 5. User review and schema-driven editing

Dependencies: milestone 4.

- [x] Render nested objects, arrays, categorized skills, optional fields, and discovered sections using the record's schema version. Display PII in a separate form.
- [x] Show unresolved issues, confidence, and stage-specific corrections. Schema editing was removed in milestone 10; only parsed resume content is reviewed.
- [x] Implement review approval that rechecks structure and PII, records the user's decision separately, and resumes only the appropriate next stage. Review does not reset exhausted model loops.
- [x] Guard global schema publication from destructive user edits or user-specific values; user review cannot bypass required sections, compatibility, or privacy checks.
- [x] Preserve user corrections with revision checks. Reject stale writes instead of overwriting newer edits or replacing them with regenerated values.

Completion (updated in milestone 10): schema work stays internal; users approve/reject parsed resumes, edit every supported field, and separately correct PII. Tests cover invalid approval, stale writes, old-schema editing, and preservation of corrections.

### 6. Job-specific tailoring

Dependencies: milestone 5.

- [x] Accept a job description and use a snapshot of the latest user-corrected resume, with its recorded schema version, as authoritative input.
- [x] Redact inputs and instruct the model to change wording/emphasis without introducing unsupported facts. Treat job-description instructions as untrusted content.
- [x] Validate structure and PII and compare proposed facts against the source; surface uncertainty for user review rather than treating a model confidence score as proof.
- [x] Save a separate variant linked to the source revision. Present changes for review and editing; clearly identify variants based on an older source revision.
- [x] Bound tailoring calls and failures independently. Do not silently extend the two parsing-loop budgets to this separate workflow.

Completion: tailoring leaves the source and corrections untouched, preserves factual fields in representative fixtures, rejects invalid outputs, and allows the user to review the selected variant.

### 7. On-demand PDF and DOCX export

Dependencies: milestones 3 and 5; include milestone 6 for tailored variants.

- [x] Build a shared presentation model from the selected structured resume and its associated PII, combined only on the server.
- [x] Implement PDF and DOCX renderers, covering all supported schema fields and additional sections without silently dropping data.
- [x] Stream the chosen format with correct content type and filename; clean up temporary output on success, error, or client disconnect. Never persist generated files.
- [x] Add preview/download controls and clear errors for unsupported formats or invalid record state.

Completion: exported files open in standard viewers, contain expected text and PII, handle Unicode and multi-page content, and reflect the selected source/variant. Verify DOCX structure, PDF text extraction, visual layout, and cleanup failure paths.

### 8. End-to-end readiness and documentation

Dependencies: milestones 1–7.

- [x] Exercise registration → upload → parsing → correction/review → tailoring → PDF/DOCX download through the UI with deterministic model responses.
- [ ] Run representative synthetic resumes through the configured proxy to evaluate extraction, PII handling, judge decisions, and factual tailoring. Record observed quality and failures; do not silently change the confidence threshold.
- [x] Check keyboard interaction, field labels, actionable errors, empty states, responsive forms, and in-progress navigation.
- [x] Verify logs and graph traces exclude secrets, raw uploads, PII, and unredacted prompts. Track only safe identifiers, stage timing, iteration counts, and failure codes.
- [x] Document environment setup, MongoDB requirements, parser/rendering dependencies, supported formats, failure recovery, and the implemented retention policy.
- [x] Run the relevant build, lint, unit, API integration, and client checks. Report any skipped live-provider or viewer verification explicitly.

Completion: all applicable acceptance criteria in `PROJECT.md` have passing evidence, the full flow works from a clean documented setup, and unresolved release blockers are recorded.

### 9. Separate local MongoDB deployment

- [x] Add `deploy/local/compose.yaml` with pinned MongoDB, automatic replica-set initialization, primary readiness, loopback port mapping, and named volumes.
- [x] Keep Compose settings separate from application credentials; document a separate future Railway deployment boundary.
- [x] Add `yarn db:up`, `yarn db:down`, and `yarn db:logs`; update `.env.example` and setup documentation.
- [x] Verify fresh startup, repeated startup, container recreation, transactions, and application startup using the current `.env`.

Completion: MongoDB remains healthy on the local Docker kernel, transactions pass, and container recreation preserves data. The existing standalone MongoDB is untouched; no data migration is performed.

### 10. Internal schemas and parsed-resume approval

- [x] Keep schema generation, evaluation, publication and conflict handling internal; remove user schema editing/approval.
- [x] Require explicit approval or rejection of every parsed resume, including judge-accepted output.
- [x] Verify hidden schema content, rejection cleanup and the complete browser workflow. Merged via PR #11.

### 11. Light/dark/system appearance

- [x] Default to System; persist explicit Light/Dark preferences and respond to OS theme changes.
- [x] Apply the theme before first paint and share semantic color tokens throughout the UI.
- [x] Verify theme switching, reload persistence, blocked storage and both palettes in Chromium. Merged via PR #12.

### 12. Streamed workflow activity and notifications

- [x] Stream actual model answer chunks with a separate two-retry transport budget; preserve stage budgets (schema: one pass, mapping: five attempts, updated in milestone 14).
- [x] Persist safe step progress, attempts and retry counts; hide all schema output and redact completed JSON string values before previewing.
- [x] Add owner-scoped snapshots/SSE, session revocation, reconnects, cancellation fencing, interrupted-attempt recovery and retention cleanup.
- [x] Navigate approved uploads and tailoring to dedicated activity URLs (uploads first open redaction review, updated in milestone 16); show each step's inactive/active/success/failure state and review actions.
- [x] Add a top-navigation notification dropdown with live step/attempt/retry summaries, deep links, keyboard dismissal and aligned mobile/desktop rows.
- [x] Verify builds, both linters, 35 unit, 30 integration and 9 client tests; run the full browser journey with actual SSE chunks and a deliberate HTTP 429 retry. Inspect desktop/light and mobile/dark screenshots.

Completion: activity survives page reloads without rerunning models; accepted parsing and tailoring discard temporary progress; schema content never appears in streamed previews. Tailoring remains an in-process task and reports interruption after a server restart rather than replaying a job description. Live provider quality evaluation remains separate.

### 13. Seeded additive resume schema

- [x] Preserve `schema/schema.json` unchanged and seed its exact definition in an empty database before the first server starts accepting requests.
- [x] Make repeated/concurrent startup idempotent; retain approved additions and immutably include missing baseline fields in existing registries without migrating saved resumes.
- [x] Replace full-schema generation with bounded addition proposals that require exact source evidence; reject replacements, removals, constraint changes, unsupported fields and PII.
- [x] Reuse existing versions for empty additions; retain worker/judge gates and schema publication concurrency. Milestone 14 changes the schema budget to one pass; mapping keeps five attempts.
- [x] Support baseline references/formats and its `basics.summary`, `work`, and categorized skill layout across extraction, review, editing, tailoring and export; keep actual contact values separate.
- [x] Verify 40 unit, 36 database/HTTP integration and 10 client tests, full build/both linters, and the Chromium upload-to-export journey. Verify no version churn for a resume already covered by the baseline.

Completion: a fresh startup seeds the supplied file; resumes can add only approved missing fields. Historical versions and corrections remain intact. Incompatible existing field types fail initialization safely instead of being overwritten. Application services remain stopped after isolated verification.

### 14. Single-pass schema modification

- [x] Limit schema preparation to one worker proposal and one judge check; keep source evidence, structural/PII checks and additive-only publication.
- [x] Stop on rejection, invalid output, publication conflict or interrupted schema work without replaying calls; preserve the five-attempt mapping loop.
- [x] Show one preparation pass in workflow activity and avoid promising another schema attempt.
- [x] Verify schema failure/recovery/concurrency and mapping-budget regressions; update product/setup documentation. Full build/both linters, 40 unit, 41 integration and 11 client tests pass; Chromium confirms the one-pass display and complete upload-to-export flow.

Completion: no schema correction loop or replay after interruptions/conflicts. Mapping keeps its existing budget and user approval. [PR #15](https://github.com/adityaparab/cvantage/pull/15) records the dedicated feature change and merge status.

### 15. Local startup setup command

- [x] Add `yarn setup` under `deploy/local`: stop a running MongoDB service, start stopped/absent services, wait for health, preserve data and propagate failures.
- [x] Run setup from `prestart` before the client build; keep production startup independent of local Compose.
- [x] Verify lifecycle behavior against an isolated Compose project, startup ordering/failure handling and data preservation; update documentation. The actual `yarn start` sequence reached API HTTP 200. Script syntax, formatting and diff checks pass.

Completion: the local setup command preserves volumes and gates application startup on database health. Test resources were removed; the existing user database was not restarted. [PR #16](https://github.com/adityaparab/cvantage/pull/16) records the dedicated feature change and merge status.

### 16. Editable redaction review before parsing

- [x] Use PII_NAME, PII_EMAIL, PII_PHONE and PII_LOCATION with clear detection limits; locally normalize equivalent explicit markers before model dispatch (user decision).
- [x] Make editable review a dedicated upload step with selection redaction controls and explicit approval before parsing starts; route notifications and reloads appropriately.
- [x] Verify edit/approval/privacy boundaries, marker handling and browser upload → review → activity flow. Full build/both linters, 45 unit, 41 integration and 15 client tests pass; Chromium journey and desktop/mobile inspection pass.

Completion: user edits and approves redaction separately before any model call. Canonical markers and local aliases are documented; unknown placeholders remain intact. [PR #17](https://github.com/adityaparab/cvantage/pull/17) records the feature change and merge status.

### 17. Explicit database wipe command

- [x] Add `yarn db:wipe` with an explicit target and confirmation; preserve infrastructure and avoid unrelated databases.
- [x] Verify only with disposable data and document restart/reseeding behavior. All 49 integration tests pass, including 8 wipe regressions. Actual interactive Yarn command rejects mismatched input and wipes after exact-name confirmation; script syntax/formatting and server lint pass.

Completion: the command drops only the explicitly configured database, protects system databases, hides credentials and requires confirmation. The next application startup restores indexes and the supplied schema. The user database was never wiped; isolated test services were removed.

### 18. Resume review with inline editing

- [x] Show populated resume content in a readable document layout; keep optional empty details available on demand.
- [x] Add a right-aligned pencil on hover/focus (always available on touch); edit one field at a time with check/cross controls, draft isolation and Escape cancellation.
- [x] Apply the shared editor to parsed reviews, saved resumes and tailored versions; prevent saving, approving or exporting an unfinished field edit.
- [x] Verify nested/array fields, optional values, keyboard navigation, mobile/theme layouts and the browser review → edit → tailor → export journey.
- [x] Update product/verification documentation, push `feat/inline-resume-review` and create [PR #19](https://github.com/adityaparab/cvantage/pull/19); its linked status records the merge.

### 19. Delete resume fields and groups

- [x] Add accessible trash controls to populated fields, groups and existing array entries; preserve schema definitions and required data rules.
- [x] Keep deletion local until approval/save and support undo; block deletion during unfinished field edits.
- [x] Verify deletion/undo, nested and group changes, persistence, keyboard/touch layouts; update documentation and PR tracking.

### 20. Redaction review readiness

- [x] Display the upload response immediately using memory-only state; load direct links with an explicit progress indicator.
- [x] Refresh unavailable text, expose recovery for failed/stalled requests and preserve edits once ready.
- [x] Verify first navigation without reload, delayed content, retries and existing redaction/approval privacy boundaries; update documentation and PR tracking.

## Verification commands

Use the existing scripts as the baseline; add client behavior/browser test scripts when their setup is introduced:

```sh
yarn build
yarn lint
yarn --cwd client lint
yarn test --runInBand
yarn test:e2e --runInBand
yarn --cwd client test
yarn test:browser
# Separately, once live settings are available:
yarn test:models
```

`yarn lint` currently applies fixes; inspect its diff. Run focused checks during milestones and the complete relevant suite at integration. Keep deterministic workflow tests offline; isolate live-proxy evaluation from the default suite. Use a disposable test database and synthetic resumes only.

## Decisions and implementation gates

- **OCR:** unresolved. The initial path rejects documents with no extractable text and explains why. Add OCR only after a product decision.
- **Text/draft retention:** decided by the user: delete temporary parsing data immediately on acceptance; expire unfinished reviews, redacted source text, and checkpoints after 30 days. Expired work requires a fresh upload. Enforce expiration at access time as well as background cleanup.
- **PII detection:** demonstrate acceptable local extraction/redaction on representative fixtures in milestone 3. If uncertainty cannot be resolved locally, require user correction before the first model call.
- **Runtime compatibility:** establish DOC parsing and PDF rendering availability during their milestones, and verify the configured proxy models' capabilities without changing their identifiers or exposing credentials.

## Progress log

| Entry | Work completed | Verification/evidence | Remaining work / next action |
| --- | --- | --- | --- |
| Planning baseline | Inspected starter backend/client and created `PROJECT.md` and the initial implementation plan | Reviewed source files, manifests, and existing test scripts; no application tests run for document creation | Application milestones remain unstarted |
| Agent setup | Added `AGENT.md` and three project-specific skills; preserved NestJS/React skills | New local skills passed the skill validator; instruction links and formatting checked | Add upstream dependency guidance |
| Dependency skills | Installed nine upstream LangChain/LangGraph/MongoDB skills and added routing/source records | Checked metadata, entry-point links, and byte-for-byte equality with pinned sources | Application dependencies still need implementation-time selection |
| Tracker update | Added milestone status, skill mapping, setup completion, and progress-maintenance rules | Local document links and task/status consistency checked | Begin milestone 1: dependency/runtime inspection and configuration |
| Foundations implementation | Added `src/config`, `src/contracts`, `src/database`, adapter ports, `.env.example`, test database scripts, and `docs/development.md` | Full build; server/client lint; 8 unit tests; 6 HTTP/repository tests against local MongoDB 8.3 replica set | Branch `feat/foundations`; create and merge PR before milestone 2. Retention confirmed: acceptance cleanup and 30-day expiry. |
| Foundations merged | [PR #1](https://github.com/adityaparab/cvantage/pull/1), `feat/foundations` → `main` | Verified merge via GitHub; started next branch from updated main | Milestone 2 authentication |
| Authentication implementation | `src/auth`, protected resume routes, React workspace, API helper and client test setup | Build and both linters pass; 8 unit, 9 integration, 2 client tests pass. Session restoration/revocation, expiry, CSRF and cross-user resume/PII isolation verified | Branch `feat/authentication`; create and merge PR before milestone 3 |
| Authentication merged | [PR #2](https://github.com/adityaparab/cvantage/pull/2), `feat/authentication` → `main` | Merge confirmed; next branch created from updated main | Milestone 3 uploads |
| Upload implementation | Memory-only PDF/DOCX/DOC extraction, bounded workers, separate PII, redacted-source confirmation and 30-day expiry | Build, both linters, 14 unit, 10 integration and 2 client tests pass; synthetic fixtures cover all formats | Merge `feat/resume-upload`, then parsing graph. Name/location supplied by user; mandatory source review resolves uncertain local detection. |
| Upload merged | [PR #3](https://github.com/adityaparab/cvantage/pull/3), `feat/resume-upload` → `main` | Merge confirmed | Milestone 4 parsing graph |
| Parsing implementation | LiteLLM adapter, LangGraph worker/judge/decision nodes, durable MongoDB snapshots and leases, cancellation, bounded counters and schema pinning | Server build/lint; 14 unit tests and 18 integration tests pass, including early/fifth acceptance, both-stage exhaustion, malformed judges, transport errors, restart and concurrent claims | Live smoke pending .env; create/merge PR, then user review |
| Parsing merged | [PR #4](https://github.com/adityaparab/cvantage/pull/4), `feat/resume-parsing` → `main` | Merge confirmed | User review and editing |
| Review implementation | Recursive field/schema editors, separate PII form, revision-safe editing, atomic user schema approval and mapping acceptance | Full build, both linters, 20 integration tests and 4 client tests pass. Invalid/PII/stale approvals rejected; old records remain editable against original schema | Merge review PR, then tailoring |
| Review merged | [PR #5](https://github.com/adityaparab/cvantage/pull/5), `feat/resume-review` → `main` | Merge confirmed | Tailoring separate variants |
| Tailoring implementation | Separate revision-linked variants, source/proposal comparison, protected factual fields and mandatory user approval | Full build/lint, 15 unit, 21 integration and 4 client tests. Corrected source remains unchanged; invented skills rejected; stale variant writes and cross-user reads rejected | Merge tailoring PR, then on-demand exports. Live wording/fidelity evaluation remains pending configuration |
| Tailoring merged | [PR #6](https://github.com/adityaparab/cvantage/pull/6), `feat/resume-tailoring` → `main` | Merge confirmed | PDF/DOCX exports |
| Export implementation | Shared schema-based presentation; memory-only PDF/DOCX, server-side PII, source/approved-variant downloads and PDF preview | Full build/lint; 18 unit, 21 integration and 4 client tests. Unicode/multipage text verified; PDF and DOCX (LibreOffice-rendered) visually inspected. Unsupported glyphs fail clearly | Merge export PR, then browser readiness |
| Exports merged | [PR #7](https://github.com/adityaparab/cvantage/pull/7), `feat/resume-export` → `main` | Merge confirmed | Browser readiness and documentation |
| Readiness verification | Real Chromium journey through the actual LiteLLM adapter; keyboard/in-progress navigation; accessible labels; draft PII cleanup and protected-response caching; setup and verification docs | Full build/lint, 18 unit, 23 integration, 4 client tests. Browser passes with 14 redacted model calls, both downloads and clean privacy checks; screenshots inspected | Live proxy evaluation pending `.env` credentials/model identifiers; see `docs/verification.md`. [Readiness PR #8](https://github.com/adityaparab/cvantage/pull/8) records the final integration changes and merge status. |
| Startup diagnostics | `src/main.ts`, configuration and database initialization now report safe actionable errors; reject standalone topology before writes; document persistent local replica-set setup | Server build/lint; 29 unit and 26 integration tests; real compiled process exits cleanly against standalone MongoDB and serves API/UI HTTP 200 against an isolated replica set | [PR #9](https://github.com/adityaparab/cvantage/pull/9), `feat/startup-diagnostics`, records the change and merge status. Local `.env` and existing MongoDB remain unchanged pending the user's database setup choice. |
| Local MongoDB deployment | `deploy/local/`, deployment boundary docs, `db:*` scripts, and matching `.env.example`; local Docker kernel compatibility setting | Compose validates; fresh and repeated starts healthy; 26 integration tests pass against MongoDB 8.0.32; committed marker survives container recreation; actual app API/UI HTTP 200 | [PR #10](https://github.com/adityaparab/cvantage/pull/10), `feat/local-mongodb-compose`, records the change and merge status. Current `.env` already matches the new instance and was preserved. Existing MongoDB on 27017 remains untouched. Railway is deferred. |
| Internal schema processing and resume approval | Removed schema editor/manual publication path; hid schema proposals and judge output; always pause mapped results for user approval/rejection | Build, both linters, 29 unit, 26 integration and 5 client tests; Chromium upload-to-download journey passes | [PR #11](https://github.com/adityaparab/cvantage/pull/11), `feat/background-schema-review`; next: appearance selection |
| Appearance selection | Light, Dark, and System (default); saved preference, live OS changes, pre-paint initialization and shared color tokens | Build/client lint; 7 client tests; Chromium workflow plus appearance/reload checks; both palettes inspected | [PR #12](https://github.com/adityaparab/cvantage/pull/12) merged; streamed workflow activity next |
| Streamed workflow activity | `src/activity`, streaming LiteLLM adapter, protected progress persistence, activity routes, upload/tailoring redirects and notification dropdown | Full build/both linters; 35 unit, 30 integration, 9 client tests; full Chromium journey with 15 redacted requests, retry/loop/reload checks and inspected mobile/dark dropdown | [PR #13](https://github.com/adityaparab/cvantage/pull/13), `feat/workflow-activity`, records the implementation and merge status; live provider evaluation and Railway remain separate |
| Seeded schema extraction | Supplied `schema/schema.json`, startup seed transaction, additive/evidence-based worker contract, baseline validation/editor/export support and historical compatibility | Full build/both linters; 40 unit, 36 integration, 10 client tests; complete Chromium journey and unchanged-schema version reuse | [PR #14](https://github.com/adityaparab/cvantage/pull/14), `feat/seeded-resume-schema`, records the implementation and merge status; live provider evaluation and Railway remain separate |
| Single-pass schema modification | Stage-specific limits, terminal schema rejection/conflicts, restart protection and corrected activity labels | Full build/both linters; 40 unit, 41 integration, 11 client tests; Chromium verifies one preparation pass and full resume journey | [PR #15](https://github.com/adityaparab/cvantage/pull/15), `feat/single-pass-schema`, records the implementation and merge status; live provider evaluation and Railway remain separate |
| Local startup setup | `deploy/local/setup.cjs`, `setup`/`prestart` scripts and local/production startup documentation | Isolated Compose absent/stopped/running paths, stable container/data, failed-Docker startup abort, actual setup → client build → API HTTP 200; test resources cleaned up | [PR #16](https://github.com/adityaparab/cvantage/pull/16), `feat/local-startup-setup`, records the implementation and merge status; existing local database left running without restart |
| Editable redaction review | Typed PII markers, local alias normalization, dedicated editable upload review with selection tools, approval-gated activity and notification routing | Full build/both linters; 45 unit, 41 integration, 15 client tests; Chromium flow and desktop/mobile inspection | [PR #17](https://github.com/adityaparab/cvantage/pull/17), `feat/editable-redaction-review`; next: explicit database wipe command |
| Database wipe command | `scripts/wipe-database.cjs`, `yarn db:wipe`, exact-name confirmation and reset/reseeding documentation | 49 real database integration tests including 8 wipe cases; actual terminal cancellation/confirmation; sibling database preserved; fresh startup reseeds exact baseline | [PR #18](https://github.com/adityaparab/cvantage/pull/18), `feat/database-wipe`; live provider evaluation and Railway remain separate |

| Inline resume review | Shared readable document layout, per-field drafts/check/cross, collapsed empty details, keyboard/touch controls and unfinished-edit guards | Full build/client lint; 21 client tests; complete synthetic Chromium workflow and desktop/mobile visual inspection | [PR #19](https://github.com/adityaparab/cvantage/pull/19), `feat/inline-resume-review`; merge status recorded on GitHub |

| Delete resume fields/groups | Shared trash controls, single-deletion undo, required-field/edit protection, unchanged schemas | Full build/client lint; 25 client tests; Chromium proves field/group deletions survive approval, reload and tailoring; desktop/mobile inspection | [PR #20](https://github.com/adityaparab/cvantage/pull/20) merged as `a59beaf`; next: redaction loading fix |

| Redaction review readiness | Route-persistent memory-only upload handoff; loading indicator, automatic readiness polling, timeout/retry, aborted obsolete requests and edit preservation | Full build/client lint; 32 client tests; Chromium verifies first visit without refetch or reload, delayed content and complete workflow; loading screenshot inspected | [PR #21](https://github.com/adityaparab/cvantage/pull/21), `feat/redaction-review-loading`; merge status recorded on GitHub |

For future entries, record: milestone/task, concrete changed paths, checks and results (including skipped checks), decisions or blockers, and the next unfinished action. Keep entries concise and evidence-based.
