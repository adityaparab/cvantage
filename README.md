# CVantage

Prepare a resume, review the extracted details, tailor it to a job description, and download PDF or DOCX. The application uses NestJS, React, MongoDB, LangChain and LangGraph through a configurable LiteLLM proxy.

## Run locally

Requires Node.js 24+, Yarn 1, Docker with Compose 2.30+ for local MongoDB, Poppler (`pdftotext`), util-linux (`prlimit`) and a PDF font such as DejaVu Sans.

```sh
yarn install:all
cp .env.example .env
# Configure session secret, LiteLLM key and worker/judge model identifiers.
yarn db:up
yarn dev
```

For a single local server, run `yarn start`. Its prestart hook runs `yarn setup`, which restarts the local MongoDB container if running or starts it if stopped/absent, waits for health, then builds the client. Run `yarn setup` directly whenever you need that database preparation. Existing database volumes are preserved; setup failures prevent the application from starting.

Open `http://localhost:5173`. [Local deployment](deploy/local/README.md) provisions an isolated MongoDB replica set on port 27018 with persistent Docker volumes. `yarn db:down` stops it and preserves its data. Existing `.env` files must use the URI documented there. See [development setup](docs/development.md) for configuration, parser dependencies and recovery behavior, and [deployment boundaries](deploy/README.md) for the separate future Railway setup. To run the compiled application:

```sh
yarn build
yarn start:prod
```

The backend serves the client and API at `http://localhost:3000`. API routes use `/api`; unknown API routes remain JSON 404s.

`yarn start:prod` does not run Docker setup, keeping deployment startup independent of local infrastructure.

To clear application data, stop the application and run `yarn db:wipe`. It reads `MONGODB_URI` and an explicit `MONGODB_DATABASE` from the environment or root `.env`, shows the target, and asks you to type the database name. For noninteractive use: `yarn db:wipe --confirm <database-name>`. This deletes that database's accounts, resumes, PII, drafts, sessions and schema versions. Other databases and Docker volumes remain intact. Restart the application afterward to recreate indexes and seed the baseline schema.

## Workflow and privacy

- Upload PDF, DOCX or legacy DOC up to 20,000,000 bytes. Originals are processed in memory and discarded after extraction. Image-only documents need a readable replacement; OCR is not implemented.
- Enter contact details separately, then edit the redacted source on its own review page before any model call. Use PII_NAME, PII_EMAIL, PII_PHONE and PII_LOCATION for missed details; common equivalent markers normalize locally. Approval starts parsing.
- Schema modification has one worker–judge pass; value mapping has at most five attempts. Schema work stays in the background. Every parsed resume awaits your approval or rejection; accepted resumes keep their extraction version.
- Review a readable resume and use each field’s pencil to edit it in place. The check accepts a change; the cross or Escape cancels it. Empty sections can be added on demand, and contact details stay separate. Tailoring preserves the source and creates a version for explicit review.
- Generate PDF/DOCX on demand. Contact details are restored only on the server; files are not retained.
- Temporary parsing data is deleted on acceptance and expires after 30 days when unfinished. Contact details for abandoned uploads expire as well; accepted records and their contact details remain.

## Verification

Start the disposable test replica set described in [development setup](docs/development.md), then run:

```sh
yarn build
yarn lint
yarn --cwd client lint
yarn test --runInBand
yarn test:e2e
yarn --cwd client test
yarn playwright install chromium
yarn test:browser
```

Browser tests use synthetic data, a random disposable database and a local deterministic model server. They exercise the real client, backend, LangChain adapter and LangGraph workflow. Use `yarn test:models` separately to evaluate configured live models. Offline tests do not establish live model quality.

[PROJECT.md](PROJECT.md) defines product behavior. [PLAN.md](PLAN.md) tracks implementation, PRs, verification and pending live evaluation. [AGENT.md](AGENT.md) contains agent guidance and installed skill routing.

Successful uploads immediately open their redacted text for review. Loading shows a progress indicator and automatically displays text when ready; failed loads can be retried on the same page. Approving it opens the live workflow activity page. Follow preparation, extraction, review, loop attempts and retries there; the navigation bell reopens active work. Schema processing stays internal, and you approve or reject only parsed resume content. Appearance supports Light, Dark and System (the default).

The authoritative resume schema is [`schema/schema.json`](schema/schema.json). It is seeded into MongoDB on startup. The worker can propose only source-supported missing fields; existing definitions are preserved and resumes with no new fields reuse the current version. Ship the `schema/` directory with the built server.
