# Backend architecture reference

Deep detail behind the `nestjs` skill. Read this when changing the
static-serving setup, the `/api` prefix, the route-exclude pattern, or when
debugging why a route returns HTML instead of JSON (or vice versa).

## Request routing model (production)

One NestJS process on `PORT` (default 3000) handles everything:

| Request | Handled by | Result |
| --- | --- | --- |
| `/` and other non-file, non-`/api` paths | ServeStaticModule fallback | `client/dist/index.html` (200) |
| `/about`, `/anything/deep` | ServeStaticModule fallback | `index.html` (200) — React Router renders it |
| `/assets/*`, `/favicon.svg`, `/icons.svg` | `express.static` | the actual file |
| `/api/hello`, `/api/health`, … | Nest controllers | controller response |
| unknown `/api/*` | Nest router (fallback excluded) | JSON 404 `{"message":"Cannot GET ...","error":"Not Found","statusCode":404}` |

The critical distinction: **unknown SPA routes fall back to `index.html`;
unknown API routes return JSON 404.** That's the whole point of the `exclude`.

## How ServeStaticModule wires this (v5 on Express 5)

From `@nestjs/serve-static`'s Express loader:

- It registers `app.use(express.static(rootPath))` to serve real files.
- It registers the SPA fallback as `app.get('{*any}', renderFn)` — `{*any}` is
  the Express 5 / path-to-regexp v8 catch-all. `renderFn` checks the request
  against the `exclude` patterns: if excluded it calls `next()` (→ Nest router,
  → JSON 404 when no route matches); otherwise it `res.sendFile(index.html)`.
- `exclude` patterns are compiled with `pathToRegexp(pattern)` and tested
  against `pathname + '/'`.

## Verifying an exclude pattern

`exclude` matching is `pathToRegexp(pattern).regexp.exec(pathname + '/')`. To
confirm a pattern before trusting it (run from the repo root, where
`path-to-regexp` resolves):

```js
// node -e
const { pathToRegexp } = require('path-to-regexp');
const hit = (pat, p) => !!pathToRegexp(pat).regexp.exec(p + '/');
const pat = '/api/{*path}';
for (const p of ['/api', '/api/x', '/api/a/b', '/apiary', '/about', '/'])
  console.log(p, '->', hit(pat, p));
// /api,/api/x,/api/a/b => true ; /apiary,/about,/ => false
```

`'/api/{*path}'` is verified correct: it matches `/api` and everything nested
under it, and nothing else (note `/apiary` must NOT match — a bare `/api`
prefix without the brace form would either miss `/api` itself or over/under-match).

## Config files that encode this setup

- `src/main.ts` — `setGlobalPrefix('api')`, `listen(process.env.PORT ?? 3000)`.
- `src/app.module.ts` — `ServeStaticModule.forRoot({ rootPath: join(__dirname,
  '..', 'client', 'dist'), exclude: ['/api/{*path}'] })`.
- `tsconfig.build.json` — excludes `client` so `nest build` only compiles `src`.
- `tsconfig.json` — excludes `node_modules`, `dist`, `client` (keeps the TS
  language server / ts-node scoped to the server).
- root `package.json` scripts — `build` (client→server), `prestart`
  (`build:client`), `start:prod` (`node dist/main`), `dev` (concurrent).
