---
name: nestjs
description: >-
  Conventions and gotchas for THIS repo's NestJS 11 backend (the server in
  ./src that also serves the React SPA from ./client/dist). Use this whenever
  working on the backend — adding or changing controllers, modules, services,
  providers, guards, pipes, DTOs, routes, the static-serving / SPA-fallback
  setup, main.ts bootstrap, the build, or the e2e tests. Consult it even for
  small backend edits, because this project runs on Express 5 (path-to-regexp
  v8) and uses a global /api prefix + ServeStaticModule fallback whose rules
  are easy to break without knowing them.
---

# NestJS backend (this repo)

This is a **NestJS 11** app on **`@nestjs/platform-express` (Express 5)**. The
same server process serves a compiled **React SPA** from `client/dist`. Backend
code lives in `src/`; the client is a separate package in `client/`.

Read `references/architecture.md` for the full request-routing model and the
serve-static internals. The essentials are below.

## The two rules that matter most

**1. Every backend route is under `/api` — automatically.**
`src/main.ts` calls `app.setGlobalPrefix('api')`. So a controller written as
`@Controller('users')` + `@Get()` is served at **`/api/users`**, not `/users`.
Never prepend `/api` yourself in `@Controller(...)` — you'd get `/api/api/...`.
The prefix exists so backend routes never collide with the SPA's client-side
routes.

**2. The SPA fallback serves `index.html` for unknown non-`/api` paths.**
`ServeStaticModule` (in `src/app.module.ts`) serves `client/dist` and falls back
to `index.html` for any path that isn't a real file — that's what makes React
Router deep links like `/about` work. Requests under `/api` are excluded from
this fallback via `exclude: ['/api/{*path}']`, so an unknown `/api/*` route
returns a proper JSON 404 instead of HTML.

Consequence: **you rarely need catch-all routes.** Don't add a controller that
matches `*`/`{*splat}` at the app root — it fights the SPA fallback. Just add
normal `/api` routes; the SPA handles everything else.

## Express 5 route syntax (this WILL bite you)

Express 5 uses path-to-regexp v8. The old wildcard syntax is gone:

- `@Get('*')` → **throws** at boot. Use a **named** wildcard: `@Get('*splat')`.
- Route/exclude patterns use braces for optional segments: the SPA-exclude is
  `'/api/{*path}'` (matches `/api` and everything under it). Not `/api*`,
  not `/api/(.*)` — those throw "Missing parameter name".
- `:param` still works for single segments.

If you change the `exclude` pattern, verify it with path-to-regexp before
trusting it — see `references/architecture.md` for a one-liner test.

## Adding a feature

Prefer the CLI so wiring/spec files are generated consistently:

```bash
npx nest g module widgets
npx nest g controller widgets   # served at /api/widgets
npx nest g service widgets
```

- Put request shapes in DTO classes. For validation, add `class-validator` +
  `class-transformer` and a global `ValidationPipe` in `main.ts` (not installed
  yet — add it when the first DTO needs validation).
- Read config/secrets from `process.env` (the port is `process.env.PORT ?? 3000`).
  For anything beyond a couple of vars, reach for `@nestjs/config`.

## Build & run (don't break these)

- `tsconfig.build.json` **excludes `client`** (`"exclude": [... "client" ...]`).
  Never remove that — without it `nest build` tries to compile the client's
  `.tsx` files with the server tsconfig (no `jsx` option) and fails with dozens
  of `TS17004` errors, and emits to `dist/src/**` instead of `dist/main.js`.
- `nest build` → `dist/`, entry `dist/main.js`. `ServeStaticModule`'s
  `rootPath` is `join(__dirname, '..', 'client', 'dist')`, so at runtime
  `dist/main.js` resolves the client at `<root>/client/dist`. **The client must
  be built first** — `yarn build` builds client then server; `prestart` builds
  the client before `start`.
- Dev: `yarn dev` (root) runs the API (`nest start --watch`, :3000) and Vite
  (:5173) together. You develop against Vite, which proxies `/api` to Nest.

## Tests

- Unit specs: `*.spec.ts` next to the code in `src/` (`yarn test`). These
  instantiate providers/controllers directly, so the global prefix doesn't apply.
- e2e: `test/*.e2e-spec.ts` (`yarn test:e2e`). These boot the real module, so
  **mirror `main.ts`: call `app.setGlobalPrefix('api')`** in the test setup and
  hit `/api/...`, or every request 404s. There's a test asserting unknown
  `/api/*` returns a JSON 404 — keep that behavior intact.
