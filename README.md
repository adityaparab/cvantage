# CVantage

Prepare a resume, review the extracted details, tailor it to a job description, and download PDF or DOCX. The application uses NestJS, React, MongoDB, LangChain and LangGraph through a configurable LiteLLM proxy.

## Run locally

Requires Node.js 24+, Yarn 1, a MongoDB replica set, Poppler (`pdftotext`), util-linux (`prlimit`) and a PDF font such as DejaVu Sans.

```sh
yarn install:all
cp .env.example .env
# Configure MongoDB, session secret, LiteLLM key and worker/judge model identifiers.
yarn dev
```

Open `http://localhost:5173`. See [development setup](docs/development.md) for MongoDB initialization, configuration, parser dependencies and recovery behavior. To run the compiled application:

```sh
yarn build
yarn start:prod
```

The backend serves the client and API at `http://localhost:3000`. API routes use `/api`; unknown API routes remain JSON 404s.

## Workflow and privacy

- Upload PDF, DOCX or legacy DOC up to 20,000,000 bytes. Originals are processed in memory and discarded after extraction. Image-only documents need a readable replacement; OCR is not implemented.
- Enter contact details separately and review the redacted source before any model call. User review is necessary for uncertain names and locations.
- Schema generation and value mapping each have at most five worker–judge attempts. Unresolved work pauses for user review; accepted resumes keep their extraction schema version.
- Edit nested fields, additional sections and separate contact details. Tailoring preserves the source and creates a version for explicit review.
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
