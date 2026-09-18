# Development and verification

Use Node.js 24+ and Yarn 1. Run `yarn install:all`. The backend currently uses `@nestjs/config` 4.0.4, the native MongoDB driver 7.6.0, Zod 4.6.5 for runtime contracts, and Ajv for a restricted JSON Schema draft-07 dialect. LangChain/LangGraph packages will be selected and integrated in milestone 4, using their installed dependency skill and current TypeScript APIs.

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
