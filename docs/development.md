# Development and verification

Use Node.js 24+ and Yarn 1. Run `yarn install:all`. The backend currently uses `@nestjs/config` 4.0.4, the native MongoDB driver 7.6.0, Zod 4.6.5 for runtime contracts, and Ajv for a restricted JSON Schema draft-07 dialect. LangChain core 1.2.11, OpenAI adapter 1.5.13 and LangGraph 1.4.15 provide the LiteLLM workflow.

Copy `.env.example` to `.env`, populate credentials/model identifiers and a random session secret of at least 32 characters. Never commit `.env`. Application startup fails when required configuration or MongoDB is unavailable. Tests supply synthetic environment values.

## Local MongoDB

The recommended local setup is [Docker Compose](../deploy/local/README.md): run `yarn db:up` from the repository root. It automatically initializes a replica set, waits for a writable primary, and preserves data in named volumes. `.env.example` points to this instance on port 27018. Local deployment configuration lives under `deploy/local/`; future Railway configuration is separate.

`yarn setup` restarts a running local MongoDB container or starts it if stopped/absent, then waits for health. `yarn start` runs setup before its client build and server launch, aborting on any setup failure. `yarn dev` and `yarn start:prod` do not run setup automatically; production connects to separately provisioned infrastructure.

For a deliberate data reset, stop application processes, keep MongoDB running, and run `yarn db:wipe`. The command loads root `.env` without overriding existing environment variables, requires explicit `MONGODB_URI`/`MONGODB_DATABASE`, displays the target without credentials, and asks for the exact database name. Noninteractive calls need `--confirm <database-name>`. It drops only that database, including accounts, PII and schema versions; it rejects `admin`, `config`, `local`, invalid/missing names and mismatched confirmation. Docker infrastructure and other databases are unaffected. Restart the application after wiping to restore indexes and seed the baseline; running application processes must not continue using a dropped registry.

### Alternative: installed MongoDB server

Use a local MongoDB replica set for transactions. An existing standalone `mongod` does not become a replica set just because the URI contains `replicaSet=cvantage`. The server must start with `--replSet cvantage`, then be initialized.

For an installed MongoDB server and a free port 27017, create a durable, ignored data directory and run from the repository root:

```sh
mkdir -p .local-data/mongodb
mongod --dbpath "$PWD/.local-data/mongodb" --replSet cvantage --bind_ip 127.0.0.1 --port 27017
```

In another terminal: `node scripts/init-mongo.cjs 27017 cvantage`. Wait for the server to elect its primary, then run `yarn dev`. Restart MongoDB with the same data directory, port, and replica-set name after a reboot; initialization is needed only once. Production requires an authenticated deployment; these loopback commands are for local development only.

For this non-Docker alternative, set `MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=cvantage` in `.env` instead of the Compose URI.

If another MongoDB already uses port 27017, keep it intact and use port 27018 for this project's instance in both commands. Set `MONGODB_URI=mongodb://127.0.0.1:27018/?replicaSet=cvantage` in `.env`. A separate instance has a separate database; it does not migrate existing data. Never point two MongoDB processes at the same data directory.

### Startup troubleshooting

Startup errors identify the failing configuration or service without printing credentials or database values:

| Message | Action |
| --- | --- |
| Invalid environment configuration | Populate the named `.env` fields; the session secret needs at least 32 characters. |
| Invalid MongoDB connection configuration | Correct the URI syntax and options in `MONGODB_URI`. |
| MongoDB connection failed | Check host/port reachability, replica-set initialization, and matching `replicaSet` name. A standalone server at that address also causes this error when the URI requests a replica set. |
| MongoDB is running as a standalone server | Follow the replica-set setup above. Removing `replicaSet` from the URI does not enable the transactions CVantage needs. |
| MongoDB authentication failed / access denied | Check credentials, `authSource`, and read/write/index-creation permissions for `MONGODB_DATABASE`. |
| MongoDB initialization failed | Check database permissions and conflicting existing indexes. |
| PORT is already in use | Stop the conflicting application or choose a free `PORT` in `.env`. |

For isolated tests, start a second server with its own path and port:

```sh
mkdir -p /tmp/cvantage-mongo-test
mongod --dbpath /tmp/cvantage-mongo-test --replSet cvantage-test --bind_ip 127.0.0.1 --port 27118
```

Initialize with `node scripts/init-mongo.cjs 27118 cvantage-test`. `yarn test:e2e` generates a random database, runs HTTP and repository tests, and drops only that database afterward. Override `TEST_MONGODB_URI` only with a disposable test replica set. No model service is called. The runner enables Node VM modules because the MongoDB driver loads runtime adapters with dynamic imports under Jest.

Run `yarn build`, `yarn lint`, `yarn --cwd client lint`, `yarn test --runInBand`, and `yarn test:e2e`. Backend lint applies formatting fixes, so inspect the diff.

## Persistence contracts

Schema publication uses a MongoDB transaction to insert an immutable version and advance the registry together. A conflicting schema publisher fails preparation without retrying or overwriting the winning version. Accepted records retain their extraction schema version. Resume updates compare owner and revision; a stale write cannot overwrite user corrections.

Parsing acceptance inserts the accepted resume and deletes its temporary parsing record in one transaction. Job expiry uses `expiresAt` with a TTL index; callers must also reject expired jobs because background TTL deletion is asynchronous. Acceptance and review services must perform runtime structure and PII validation before repository writes.

`schema/schema.json` is the source-controlled baseline and must be shipped alongside `dist/` (its path is resolved relative to the server module, independent of the working directory). Startup seeds its exact contents as version 1 in an empty registry, before accepting requests. Seeding and registry advancement are transactional and idempotent across concurrent starts. Later starts retain approved extensions. Existing registries receive missing baseline fields in a new version, retaining old fields and constraints; conflicting shared types fail startup with an actionable error and leave old records untouched.

The baseline uses draft-07, local `#/definitions/...` references, descriptions, URI/email formats and its ISO date pattern. Validation and export resolve these references; the form receives a resolved view with contact/tooling fields hidden. The canonical database schema retains every original field. Extraction uses `basics.summary`, `work` and `skills[].name/level/keywords`; historical records keep their recorded layout. Actual contact values remain separate. Optional missing fields are omitted, not filled with invalid blank dates or URLs. Application validation requires declared fields even where the baseline permits additional properties.

The schema worker returns `{additions:[{parentPath,name,definition,evidence}]}`, never a replacement schema. Parent paths target existing object nodes, for example `/properties/work/items`. Every new property needs a matching source excerpt and judge approval. Existing fields, types, metadata and constraints cannot change. New skill categories fit existing `skills[].name` values and do not cause versions. New definitions use the bounded editor subset (object/array/string/number/boolean, explicit properties, title, required, items); no executable keywords, external references, examples, defaults, source values or PII. The supplied baseline's metadata is trusted and redacted before model dispatch. Source evidence is not stored in global definitions.

## Authentication

Passwords use salted scrypt (N=32768, r=8, p=1). Sessions last seven days, are stored as keyed hashes, and are sent through HttpOnly, SameSite=Strict cookies (Secure in production). Mutations require a session CSRF token. Login/registration require a custom same-origin request header and have a bounded per-process IP attempt limit. Configure trusted proxy handling and a shared throttle store before running multiple public-facing instances. Authentication tests use synthetic accounts only.

Client behavior tests: `yarn --cwd client test`.

## Upload parsing

Install Poppler (`pdftotext`) and util-linux (`prlimit`) on Linux. DOCX uses Mammoth with bounded ZIP inspection; legacy DOC uses word-extractor. Worker threads isolate parsing with a 20-second timeout, 128 MB JS heap and at most two concurrent extractions. PDF subprocesses have additional CPU/address-space limits. The upload cap is 20,000,000 bytes; multipart buffering stops at one byte above this inclusive limit. Textless/image-only, corrupt or unsupported documents require a new readable upload; OCR is not implemented.

Original bytes remain in memory and are cleared after extraction; originals are never written to disk. The user supplies name/location/contact values, local patterns also redact email and phone numbers, and the user must inspect/correct the redacted text before any model call. This review is essential for names, locations, headers and unusual contact formats that cannot be identified reliably by patterns alone. PII is stored separately. Redacted source and review drafts expire after 30 days and will be deleted upon acceptance. Test fixtures contain synthetic contact details only.

## Durable parsing

A single background scheduler claims jobs with three-minute MongoDB leases. Each graph invocation runs worker → judge → decision for one reserved iteration. MongoDB job snapshots are the recovery checkpoints; there is no second graph-history collection. Counters are persisted before calls, so crashes consume ambiguous attempts and cannot reset budgets. Reclaimed jobs resume from the stored stage. Schema modification has one worker proposal and at most one judge check; rejection, invalid output, interruption or publication conflict stops preparation without another pass. Previously queued schema jobs with a consumed attempt also stop on recovery. Mapping retains its five-attempt budget. Acceptance atomically deletes the entire temporary snapshot; TTL and access-time checks enforce 30-day expiry. Cancellation deletes the job and fences further writes.

Model calls use the configured LiteLLM chat-completions endpoint with no tools, a 12,000 output-token cap, a 20-second request timeout and a 65-second overall call deadline. Answer text streams through LangChain. Transient HTTP/network failures retry at most twice, with visible retry counts; authentication, validation and cancelled-progress failures do not retry. Retries stay inside the same graph iteration. Malformed JSON is a failed iteration; provider errors produce a visible failed job for user review. Ambient LangSmith/LangChain tracing and verbose model logs are disabled to prevent exporting resume content. Worker proposals and judge feedback are screened before storage or reuse.

Run `yarn build:server && node scripts/smoke-models.cjs` after configuring `.env` to check both models with synthetic data. This sends four bounded calls and applies the production acceptance contract. Live evaluation has not run in this workspace because credentials/model identifiers are absent. The deterministic MongoDB tests use the real graph with a scripted model adapter; they do not establish live model quality.

## Review and editing

Parsed reviews, saved resumes and tailored versions share `ResumeFields`: populated values render as a resume document; empty optional details remain in collapsed controls. Only one field per document enters edit mode. Local field drafts apply only on check and discard on cross/Escape, restoring keyboard focus. Pencil controls appear on hover/focus and remain visible with larger targets on touch devices. Save/approval/export and dependent tailoring controls are disabled during an unfinished edit. Field acceptance updates the local document; the existing overall save or approval action persists it. Trash controls delete optional fields/groups or array entries from the local parsed/source document, preserving schema definitions. Undo restores the last deletion until another data change; it cannot overwrite a later accepted edit. Required properties are protected. Tailored variants keep factual deletions disabled. Separate contact editing and pre-LLM redaction review retain their own forms.

Schema generation, validation and publication are internal background operations. Exhausted schema preparation reports a processing failure without returning proposals or schema judge output to the review API. There is no user schema approval endpoint. Every mapped resume, including one accepted by the judge, waits for explicit user approval or rejection. Approval validates content/PII and atomically saves the resume and deletes temporary state; rejection deletes the draft. Existing resumes edit against their recorded version. Contact updates compare contact and resume revisions.

## Tailoring

Tailoring uses a saved source revision and its extraction schema. It permits summary/highlight wording changes while preserving all other values, list order and highlight counts; new numeric claims are rejected. The judge checks narrative fidelity, and every proposal still requires user review with a source/proposal comparison. Model judgment is not proof of factual equivalence. Variants store the non-PII source snapshot for comparison and never overwrite the source. Older-source variants are labeled in the UI. Calls are bounded to one worker and one judge, each with the same two-retry transport budget, with at most two active workflows per process and one per account. The job description is redacted and requires user confirmation before use; it is not stored.

## Exports

PDFKit and docx render the same schema-based presentation entirely in memory. Downloads restore contact details on the server and never call a model. Variants require explicit user approval. Outputs are not persisted, so errors/disconnects leave no output files to clean up. Export concurrency is two per process and content is bounded to 300,000 serialized presentation characters.

PDF requires a readable single-font TTF/OTF file. The Linux default is DejaVu Sans (`fonts-dejavu-core`); override `EXPORT_FONT_PATH` for another language. Glyph coverage is checked before rendering; unsupported glyphs produce an error with a DOCX alternative, never a silently incomplete PDF. Polish, Greek and Cyrillic text and multipage documents are tested. DOCX uses DejaVu Sans, with viewer font substitution when unavailable. Synthetic PDF and DOCX layouts were visually checked using Poppler and LibreOffice.

## Browser verification and remaining release checks

`yarn playwright install chromium` installs the browser; `yarn test:browser` builds the application and runs a synthetic UI journey against a random disposable database and a local LiteLLM-compatible HTTP fixture. It checks registration, upload/redaction, five-attempt review, correction, tailoring, both downloads, PDF preview, session restoration/logout, mobile overflow, model-input privacy and log privacy. No live credentials are used. Override `BROWSER_EXECUTABLE` for an existing compatible Chromium or `PLAYWRIGHT_BROWSERS_PATH` for its installation directory. Synthetic screenshots/downloads go to `/tmp/cvantage-browser-verification` by default (`BROWSER_ARTIFACT_DIR` overrides). The runner closes services and drops its own database.

Unaccepted PII now shares the draft's 30-day TTL. Acceptance removes that TTL in the same transaction as saving the resume; cancellation deletes the draft and its PII together. Protected responses use `Cache-Control: no-store`. The server accepts JSON up to 2 MB for long redacted source reviews while upload bytes retain their separate 20 MB limit.

Live evaluation is still required with configured LiteLLM credentials and model identifiers. Run `yarn test:models` with synthetic inputs; review extraction coverage, schema additions, judge decisions and tailoring factuality before relying on model output. The current confidence threshold remains 0.90. No live quality claim is made from deterministic fixtures.

Before public multi-instance deployment, replace in-process authentication and model concurrency limits with shared limits and configure trusted proxy handling. This repository currently implements a single-process application with MongoDB job leases for crash recovery.

## Appearance

The header offers System (default), Light, and Dark. A browser-local preference persists across reloads and tabs; System follows live OS changes. The initial HTML applies the selected palette before rendering. Shared CSS variables cover forms, panels, errors, and focus indicators. If browser storage is unavailable, switching still works for the current page.


## Workflow activity

Upload success navigates to `/uploads/:id/review`, a separate editable redaction review with typed selection tools and explicit approval. Only successful approval queues parsing and navigates to `/activity/:id`, which hosts preparation/extraction worker and judge steps, attempt/retry history, and parsed-resume approval or rejection. Unapproved activity links redirect to upload review; notifications open the appropriate page. `/resumes/:id` opens saved content; tailoring returns a workflow ID immediately and opens its own activity page. Its review link selects the resulting variant. The navigation bell lists running workflows and drafts awaiting action, with the current step, attempt, and retry count; rows link to their activity URLs.

`GET /api/workflows` returns owner-scoped summaries. `GET /api/workflows/:id` returns a snapshot; `/events` provides SSE updates from MongoDB every 400 ms when progress changes, with heartbeats. Session revocation is checked throughout streaming. The browser reconnects and retrieves snapshots without repeating model calls. Reverse proxies must allow long-lived SSE and disable response buffering (the endpoint sends `X-Accel-Buffering: no`). Railway configuration remains separate from `deploy/local`.

Streamed answer previews are provisional, redacted, capped at 8,000 characters per step, and revealed only as complete decoded JSON string values arrive, preventing identifying prefixes or escaped Unicode from bypassing redaction. Raw provider deltas, reasoning, prompts, and schema output are never persisted as activity. Preparation steps expose counters and status only. Parsing activity shares the existing job's leases, cancellation, acceptance deletion and 30-day expiry. Accepted records retain only a workflow ID so old activity links resolve to a completed state.

Tailoring progress has a 30-day TTL, is deleted on variant approval, and stores no job description. It runs in the application process; a restart does not replay the in-memory request. An activity with no update for three minutes reports interruption and the user can start again from the saved resume. Shared admission limits and a durable tailoring queue remain future deployment work.

### Typed redaction markers

Local redaction uses `PII_NAME`, `PII_EMAIL`, `PII_PHONE` and `PII_LOCATION`. Supplied values retain their field type; additional detected email/phone patterns use the matching marker. Existing markers are protected against repeated redaction, even when a supplied value overlaps a marker name. The approval endpoint persists the edited text after local normalization of explicit aliases such as `[FULL NAME]`, `[email removed]`, `PHONE_REDACTED` and `{address hidden}`, and reapplies PII redaction. Plain prose and unknown/ambiguous placeholders remain intact. Names/locations not supplied by the user still require manual review. No model calls run before approval; normalization uses no LLM. Editing resets the confirmation checkbox, and failed/stale approval keeps the user on review.

## Redaction text readiness

Successful uploads hand their redacted source/revision directly to the review page through React memory state; it is not written to URL/history state, localStorage or sessionStorage, and is discarded on leaving that upload route. This removes the redundant read on first navigation. Direct links/reloads fetch the job with an indeterminate progress indicator and retry empty or unavailable source once per second. A 30-second deadline aborts stalled work and offers an explicit Retry action; request failures also recover on the same page. Only ready text mounts the form. Polling stops once ready and requests/timers are cancelled on navigation, so delayed responses cannot overwrite user edits. Approval still requires user confirmation and uses the job revision.

Job URL import uses authenticated `POST /api/resumes/:resumeId/job-description` with `{ url }`. It permits public HTTPS pages on port 443, checks all resolved IP addresses, pins the checked address for TLS requests and revalidates each redirect (maximum three). The fetch deadline is 10 seconds, the body limit is 1 MB and returned text must be 20–30,000 characters. Only uncompressed HTML/plain text is accepted; authenticated, script-rendered or blocked pages can be pasted manually. Fetching does not invoke models or persist the URL/page. Imported text is locally redacted and must be reviewed before analysis.

Implementation references: [Node request options](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequesturl-options-callback), [Cheerio loading](https://cheerio.js.org/docs/basics/loading/), and [ipaddr.js address ranges](https://github.com/whitequark/ipaddr.js/). Dependencies are direct and pinned by `yarn.lock`.


### Application sections and tailoring routes

- `/resumes`: source library and confirmed deletion; `/resumes/upload`, `/resumes/uploads/:uploadId/review`, `/resumes/activity/:workflowId` and `/resumes/:resumeId` handle extraction and source editing.
- `/tailoring`: resume selector, pasted/imported job description, privacy confirmation and previous versions.
- `/tailoring/analysis/:workflowId`: live resume analysis, job analysis, wording generation and factual review, including retry/status indicators.
- `/tailoring/resumes/:resumeId/versions/:variantId/suggestions`: select before/after wording changes.
- `/tailoring/resumes/:resumeId/versions/:variantId/resume`: applied result, inline edits, approval and downloads.

`POST /api/resumes/:resumeId/variants/:id/apply` accepts `{ revision, suggestionIds }`. IDs come from the variant detail response's `suggestions`; the server reconstructs the result from its original source snapshot and immutable proposal, validates it and saves with revision protection. Empty selection keeps original wording. Unknown/duplicate paths and stale versions are rejected. Reapplying resets approval and replaces manual draft edits. No source data is changed.

Legacy `/uploads/:id/review`, `/activity/:id`, `/tailoring/activity/:id` and resume variant-query links remain compatible. Approval deletes temporary activity records; saved analysis summaries remain accessible through the variant's workflow link. Temporary stream previews are not retained after approval.
