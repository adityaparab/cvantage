# Engineering standards for this repo

How code should be written here — for any agent or contributor. These are
cross-cutting standards; the **repo-specific mechanics** live in the `nestjs`
and `react` skills (`.claude/skills/`), which you should consult when touching
the backend (`src/`) or the client (`client/`) respectively.

The goal in one line: **leave the codebase easier to change than you found it.**
Optimize for the next person reading the code, not for the speed of writing it.

---

## Manage cognitive load first

Code is read far more than it's written. A reader can only hold a few things in
their head at once — respect that budget.

- **Keep functions short and at one level of abstraction.** A function should
  read like a short paragraph about a single idea. If you're narrating "first
  do X, then the low-level Y, then Z," extract the low-level parts.
- **Reduce nesting with guard clauses.** Handle edge cases and errors up front
  and `return` early; keep the happy path at the left margin. Deeply nested
  `if/else` is where bugs hide.
- **Name things for intent, not mechanism.** `remainingRetries`, not `n`;
  `fetchOverdueInvoices()`, not `getData2()`. A good name removes the need for a
  comment.
- **Prefer boring, explicit code over clever code.** Cleverness you have to
  decode is a tax paid on every future read. If a one-liner needs a comment to
  be understood, write the three obvious lines instead.
- **Minimize what a reader must know to be correct.** Localize state, avoid
  hidden side effects and action-at-a-distance, and prefer immutable data and
  pure functions so a function's behavior is fully explained by its inputs.

## Single responsibility & clear boundaries

- **One reason to change per unit.** A module/class/function should do one thing.
  When you struggle to name it without "and," it's doing too much — split it.
- **Separate the layers.** Keep transport/framework concerns (controllers,
  React components) thin and push real logic into services/hooks/plain
  functions that don't know about HTTP or the DOM. Business logic that lives in
  a plain, framework-free function is the easiest thing in the world to test and
  reuse.
- **Depend on abstractions at the seams.** Use dependency injection (NestJS
  providers) and pass collaborators in rather than reaching for globals or
  `new`-ing dependencies inside a unit — that's what makes code testable and
  swappable.
- **Isolate side effects** (I/O, network, time, randomness) at the edges so the
  core stays deterministic and pure.

## Make it testable, then test it

Testability is a design property, not an afterthought — if something is hard to
test, that's a design smell telling you to decouple it.

- **Test behavior, not implementation.** Assert on observable outcomes and
  public contracts so tests survive refactors instead of breaking on every
  internal change.
- **Pick the right level.** Fast unit tests for logic/edge cases; e2e
  (`test/*.e2e-spec.ts`) for wiring and the request/response contract. Don't
  e2e what a unit test covers, and don't unit-mock so heavily you test the mocks.
- **Cover the paths that matter:** the happy path, boundaries, and failure
  modes. Aim for meaningful coverage, not a coverage percentage.
- **Keep tests fast, deterministic, and independent** — no shared mutable state,
  no reliance on wall-clock time or ordering. A flaky test is worse than no test.
- **When you fix a bug, add the test that would have caught it.**

## Robustness & correctness

- **Fail fast and loudly at boundaries.** Validate inputs where untrusted data
  enters (API DTOs, form input, env config) and reject bad data early with a
  clear error rather than letting it corrupt state downstream.
- **Never silently swallow errors.** Handle it, or let it propagate with
  context. An empty `catch` hides the very thing someone will need at 2am.
- **Errors should carry meaning** — enough context to diagnose without a
  debugger. Log the *why*, never secrets/PII/tokens.
- **Lean on the type system.** This project runs strict TypeScript for a reason;
  model states precisely and avoid `any` / unchecked casts — a type is a test
  that runs on every keystroke.
- **Handle the money/edge cases:** empty collections, nulls, timeouts,
  concurrent access, and the unhappy responses from anything over a network.

## Stay pragmatic — don't over-engineer

"Easy to extend" and "don't build what you don't need" are in tension; resolve
it by designing clear *seams*, not speculative machinery.

- **YAGNI.** Build for today's known requirements. Don't add config options,
  abstraction layers, or generality for hypothetical futures — that's cognitive
  load you pay now for a maybe.
- **Design for extension by keeping things simple and cohesive**, so change is a
  local edit. Extensibility comes from good boundaries, not from frameworks
  layered on speculatively.
- **Prefer a little duplication over the wrong abstraction.** Wait until the
  third occurrence before extracting — a premature "DRY" abstraction couples
  unrelated things and is costlier to unwind than duplication.
- **Delete dead code and stale comments.** Unused code isn't free; it misleads.
- **Measure before optimizing.** Write it clearly first; optimize the hot path
  only when a real measurement says to, and comment why.

## Working style

- **Match the surrounding code.** Consistency (naming, structure, patterns,
  formatting) beats personal preference — the codebase should read as if written
  by one careful person. Run the existing linters/formatters
  (eslint/prettier for the server, oxlint for the client).
- **Make small, focused, coherent changes.** One concern per commit/PR; don't
  mix a refactor with a behavior change — it makes review and rollback painful.
- **Comment the *why*, not the *what*.** The code says what it does; comments
  explain intent, trade-offs, and non-obvious constraints.
- **Manage secrets and config through the environment**, never hardcoded. No
  credentials in source or logs.
- **Leave it working and say so honestly.** Build, lint, and tests pass before
  you call something done; if you skipped or couldn't verify a step, state that
  plainly rather than implying success.
