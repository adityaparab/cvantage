---
name: react
description: >-
  Conventions and gotchas for THIS repo's React client (the Vite SPA in
  ./client, served in production by the NestJS server). Use this whenever
  working inside ./client — building or editing components, pages, hooks,
  routes, calling the backend API, adding assets, or touching vite.config.ts /
  the client tsconfigs. Consult it even for small client edits, because this
  project has specific rules for API calls (relative /api + Vite proxy),
  routing (React Router + server SPA fallback), and a strict TypeScript setup
  (verbatimModuleSyntax, erasableSyntaxOnly, noUnused*) that rejects code that
  would compile in a looser project.
---

# React client (this repo)

**React 19 + Vite 8 + TypeScript**, living in `client/` as its own package
(`client/package.json`, own `node_modules`). Routing is
**react-router-dom v7**. In production the compiled output (`client/dist`) is
served by the NestJS server; in dev it runs on Vite with hot reload.

## Calling the backend — always relative `/api`, never a hardcoded host

Use relative paths and let the environment route them:

```tsx
// Right — works identically in dev and prod:
fetch('/api/health').then((r) => r.json())

// Wrong — breaks in production and couples code to a port:
fetch('http://localhost:3000/api/health')
```

Why it works: in **dev**, `client/vite.config.ts` proxies `/api` →
`http://localhost:3000` (the Nest server), so there's no CORS and no port in
your code. In **production**, the SPA is served by that same Nest server, so
`/api/...` is already same-origin. See `components/ApiStatus.tsx` for the
canonical fetch pattern.

## Routing — add a route in two places, deep links just work

Routes are declared in `client/src/main.tsx` (`<BrowserRouter>` → `<Routes>`).
Current routes: `/` → `App`, `/about` → `pages/About`, `*` → `pages/NotFound`.

To add a page:
1. Create the component in `client/src/pages/`.
2. Add a `<Route path="/thing" element={<Thing />} />` in `main.tsx`
   (keep the `path="*"` NotFound route **last**).

You do **not** need to touch the server. The Nest server falls back to
`index.html` for any unknown non-`/api` path, so a hard refresh or direct visit
to `/thing` loads the SPA and React Router renders it. The `path="*"` route is
the client-side 404 page. (If you ever switch to `HashRouter` you'd lose clean
deep links — don't, the server fallback is already set up for `BrowserRouter`.)

## Strict TypeScript — code that compiles elsewhere may fail here

`client/tsconfig.app.json` is strict in ways that reject otherwise-valid code.
When you hit a build error, it's usually one of these — fix the code, don't
loosen the config:

- **`verbatimModuleSyntax: true`** → import types with `import type`:
  `import type { ReactNode } from 'react'`. A value import of a type errors.
- **`erasableSyntaxOnly: true`** → no `enum`, no `namespace`, no constructor
  parameter properties. Use `const` objects / union types / plain fields.
- **`noUnusedLocals` / `noUnusedParameters`** → remove unused variables and
  params (prefix an intentionally-unused param with `_`).
- **`jsx: react-jsx`** → no `import React` needed just for JSX.

Lint is **oxlint** (`yarn --cwd client lint`), which enforces
`react/rules-of-hooks` and `react/only-export-components` — keep hooks at the
top level and, in files that export a component, avoid also exporting
non-constant values.

## Components & assets

- Function components, one default export per file (matches
  `only-export-components`). Existing layout: reusable bits in
  `client/src/components/`, routed pages in `client/src/pages/`.
- Static files: put them in `client/public/` to serve at the root
  (`/favicon.svg`, `/icons.svg`), or `import` them from `client/src/assets/`
  to get a hashed, bundled URL.

## Commands (run from the repo root unless noted)

- `yarn dev` — API + Vite together; **open http://localhost:5173** to develop.
- `yarn --cwd client build` — `tsc -b && vite build` → `client/dist`
  (what Nest serves). Prefer `yarn build` from root to build client + server.
- `yarn --cwd client dev` / `lint` / `preview` — client-only scripts.

Note: `client/` has its own dependencies. New client packages go in via
`yarn --cwd client add <pkg>`, not the root `package.json`.
