# Development and verification

Use Node.js 24+ and Yarn 1. Run `yarn install:all`. The backend currently uses `@nestjs/config` 4.0.4, the native MongoDB driver 7.6.0, Zod 4.6.5 for runtime contracts, and Ajv for a restricted JSON Schema draft-07 dialect. LangChain core 1.2.11, OpenAI adapter 1.5.13 and LangGraph 1.4.15 provide the LiteLLM workflow.

Copy `.env.example` to `.env`, populate credentials/model identifiers and a random session secret of at least 32 characters. Never commit `.env`. Application startup fails when required configuration or MongoDB is unavailable. Tests supply synthetic environment values.

## Local MongoDB

Use a local MongoDB replica set for transactions. For an installed MongoDB server, create a data directory outside the repository and run:

```sh
mkdir -p /tmp/cvantage-mongo-dev
mongod --dbpath /tmp/cvantage-mongo-dev --replSet cvantage --bind_ip 127.0.0.1 --port 27017
```

In another terminal: `node scripts/init-mongo.cjs 27017 cvantage`. Wait for the server to elect its primary, then run `yarn dev`. Development data under `/tmp` is disposable; choose a durable local path if needed. Production requires an authenticated deployment; these loopback commands are for local development only.

For isolated tests, start a second server with its own path and port:

```sh
mkdir -p /tmp/cvantage-mongo-test
mongod --dbpath /tmp/cvantage-mongo-test --replSet cvantage-test --bind_ip 127.0.0.1 --port 27118
```

Initialize with `node scripts/init-mongo.cjs 27118 cvantage-test`. `yarn test:e2e` generates a random database, runs HTTP and repository tests, and drops only that database afterward. Override `TEST_MONGODB_URI` only with a disposable test replica set. No model service is called. The runner enables Node VM modules because the MongoDB driver loads runtime adapters with dynamic imports under Jest.

Run `yarn build`, `yarn lint`, `yarn --cwd client lint`, `yarn test --runInBand`, and `yarn test:e2e`. Backend lint applies formatting fixes, so inspect the diff.

## Persistence contracts

Schema publication uses a MongoDB transaction to insert an immutable version and advance the registry together. Conflicting publishers must revalidate against the new version. Accepted records retain their extraction schema version. Resume updates compare owner and revision; a stale write cannot overwrite user corrections.

Parsing acceptance inserts the accepted resume and deletes its temporary parsing record in one transaction. Job expiry uses `expiresAt` with a TTL index; callers must also reject expired jobs because background TTL deletion is asynchronous. Acceptance and review services must perform runtime structure and PII validation before repository writes.

The editor-compatible schema subset supports bounded nested objects, arrays, strings, numbers, and booleans. Objects have explicit properties and forbid unknown properties. External references, executable expressions, arbitrary schema keywords, and identifying field names are rejected. Four base sections are required. Null is not supported in this initial subset; use an empty string, array, or object where the declared type permits it.

## Authentication

Passwords use salted scrypt (N=32768, r=8, p=1). Sessions last seven days, are stored as keyed hashes, and are sent through HttpOnly, SameSite=Strict cookies (Secure in production). Mutations require a session CSRF token. Login/registration require a custom same-origin request header and have a bounded per-process IP attempt limit. Configure trusted proxy handling and a shared throttle store before running multiple public-facing instances. Authentication tests use synthetic accounts only.

Client behavior tests: `yarn --cwd client test`.

## Upload parsing

Install Poppler (`pdftotext`) and util-linux (`prlimit`) on Linux. DOCX uses Mammoth with bounded ZIP inspection; legacy DOC uses word-extractor. Worker threads isolate parsing with a 20-second timeout, 128 MB JS heap and at most two concurrent extractions. PDF subprocesses have additional CPU/address-space limits. The upload cap is 20,000,000 bytes; multipart buffering stops at one byte above this inclusive limit. Textless/image-only, corrupt or unsupported documents require a new readable upload; OCR is not implemented.

Original bytes remain in memory and are cleared after extraction; originals are never written to disk. The user supplies name/location/contact values, local patterns also redact email and phone numbers, and the user must inspect/correct the redacted text before any model call. This review is essential for names, locations, headers and unusual contact formats that cannot be identified reliably by patterns alone. PII is stored separately. Redacted source and review drafts expire after 30 days and will be deleted upon acceptance. Test fixtures contain synthetic contact details only.

## Durable parsing

A single background scheduler claims jobs with three-minute MongoDB leases. Each graph invocation runs worker → judge → decision for one reserved iteration. MongoDB job snapshots are the recovery checkpoints; there is no second graph-history collection. Counters are persisted before calls, so crashes consume ambiguous attempts and cannot reset budgets. Reclaimed jobs resume from the stored stage. Both stages stop at five attempts. Schema conflicts re-evaluate against the new latest schema within that budget. Acceptance atomically deletes the entire temporary snapshot; TTL and access-time checks enforce 30-day expiry. Cancellation deletes the job and fences further writes.

Model calls use the configured LiteLLM chat-completions endpoint with no tools, no transport retries, a 60-second request timeout and 12,000 output-token cap. Malformed JSON is a failed iteration; provider errors produce a visible failed job for user review. Ambient LangSmith/LangChain tracing and verbose model logs are disabled to prevent exporting resume content. Worker proposals and judge feedback are screened before storage or reuse.

Run `yarn build:server && node scripts/smoke-models.cjs` after configuring `.env` to check both models with synthetic data. This sends four bounded calls and applies the production acceptance contract. Live evaluation has not run in this workspace because credentials/model identifiers are absent. The deterministic MongoDB tests use the real graph with a scripted model adapter; they do not establish live model quality.

## Review and editing

Failed/exhausted jobs pause in application-owned MongoDB state. User approval validates schema/data and PII again, records the approval source separately, and continues only the next stage without resetting counters. Schema publication and the review transition share one transaction. Recursive editors support all schema field types; published field types remain locked in schema review. Existing resumes always edit against their recorded version. Contact updates compare both contact and resume revisions, so they cannot authorize an accidental overwrite of a newer resume edit.

## Tailoring

Tailoring uses a saved source revision and its extraction schema. It permits summary/highlight wording changes while preserving all other values, list order and highlight counts; new numeric claims are rejected. The judge checks narrative fidelity, and every proposal still requires user review with a source/proposal comparison. Model judgment is not proof of factual equivalence. Variants store the non-PII source snapshot for comparison and never overwrite the source. Older-source variants are labeled in the UI. Calls are bounded to one worker and one judge, without retries, with at most two active requests per process and one per account. The job description is redacted and requires user confirmation before use; it is not stored.
