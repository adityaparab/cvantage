# CVantage — Agent Instructions for GPT-6

Use this file as the repository entry point when working on CVantage. It is plain Markdown guidance: explicitly load it in your coding tool if that tool does not discover `AGENT.md`. Skill paths below can likewise be read as files; no particular vendor's skill loader is required.

## Read the right context

1. Read the current user request and inspect the working-tree changes. Preserve unrelated and uncommitted work.
2. Read [CLAUDE.md](CLAUDE.md) for engineering standards and [PROJECT.md](PROJECT.md) for product requirements.
3. For implementation work, read the relevant milestone and dependencies in [PLAN.md](PLAN.md). The plan describes proposed work, not proof that a feature exists.
4. Load only the skills relevant to the task from the table below, then inspect the code being changed. Open supporting references only when needed.

Follow the host's system/developer instructions and the user's current task. Within repository documents, `PROJECT.md` defines product behavior, `CLAUDE.md` defines shared engineering standards, and `PLAN.md` proposes execution order. This file and skills explain how to apply them. If documents conflict materially, identify the conflict instead of silently inventing a new requirement.

## Skill routing

Skills live in the existing `.claude/skills/` directory and are usable as repository instructions regardless of the development model.

| Task | Read |
| --- | --- |
| NestJS controllers, services, DTOs, configuration, routing, backend tests | [nestjs](.claude/skills/nestjs/SKILL.md) |
| React pages, forms, hooks, client routing, API calls, client build | [react](.claude/skills/react/SKILL.md) |
| MongoDB records, ownership queries, PII storage, schema publication, revisions, job recovery | [resume-persistence](.claude/skills/resume-persistence/SKILL.md) |
| LangChain/LangGraph, LiteLLM, prompts, worker/judge loops, review transitions, tailoring | [resume-ai-workflow](.claude/skills/resume-ai-workflow/SKILL.md) |
| PDF/DOCX/DOC parsing, local PII redaction, file cleanup, PDF/DOCX export | [resume-documents](.claude/skills/resume-documents/SKILL.md) |
| LangChain/LangGraph package setup and compatibility | [langchain-dependencies](.claude/skills/langchain-dependencies/SKILL.md) |
| LangChain model/agent APIs, tools, structured responses | [langchain-fundamentals](.claude/skills/langchain-fundamentals/SKILL.md) |
| LangChain middleware and model/tool hooks | [langchain-middleware](.claude/skills/langchain-middleware/SKILL.md) |
| LangGraph state, nodes, reducers, edges, graph execution | [langgraph-fundamentals](.claude/skills/langgraph-fundamentals/SKILL.md) |
| LangGraph checkpointers, thread isolation, state recovery | [langgraph-persistence](.claude/skills/langgraph-persistence/SKILL.md) |
| LangGraph interrupts and resuming user review | [langgraph-human-in-the-loop](.claude/skills/langgraph-human-in-the-loop/SKILL.md) |
| MongoDB client setup, pooling, connection errors | [mongodb-connection](.claude/skills/mongodb-connection/SKILL.md) |
| MongoDB document modeling and validation | [mongodb-schema-design](.claude/skills/mongodb-schema-design/SKILL.md) |
| MongoDB indexing and query performance work | [mongodb-query-optimizer](.claude/skills/mongodb-query-optimizer/SKILL.md) |

Combine applicable skills: for example, a parsing service needs NestJS and AI workflow guidance; a checkpoint change also needs persistence guidance. Ordinary documentation edits do not require loading every skill. These are implementation instructions, not evidence that their dependencies or features are installed.

The dependency skills are upstream references; use their TypeScript examples for this project and check APIs against installed versions. Their sample models, provider keys, PostgreSQL checkpointers, tracing services, and infrastructure choices do not replace this project's LiteLLM configuration, MongoDB persistence, PII boundaries, or bounded workflows. Generic schema-migration advice does not authorize migrating existing resumes. Use repository context to answer setup questions already settled here. Source revisions and installation scope are recorded in [skill sources](.claude/skills/SOURCES.md).

## Work within the requested scope

- Carry the requested task through implementation and necessary verification; do not stop at a proposal when the user requested action. Do not implement the entire plan merely because it is present.
- Make routine, reversible implementation choices using existing patterns. Ask a focused question only when a missing decision materially affects correctness or scope; continue independent work while it is unresolved.
- Keep new requirements distinct from implementation choices. OCR and text/review-draft retention remain open in `PROJECT.md`; do not guess that OCR is supported or retention is unlimited.
- Keep changes coherent and avoid unrelated refactors. Do not replace configuration, switch models, weaken validation, or alter product rules just to make a test pass.
- Update plan checkboxes only when implementation and completion criteria are satisfied. Record relevant decisions or blockers, not a transcript of every action.
- A request to edit code does not itself request publishing, deploying, or sending data to unrelated external services. Respect the tool's actual permissions and available capabilities.

## Engineering standard

Apply `CLAUDE.md` as the shared standard:

- Keep functions short, name concepts by intent, use guard clauses, and avoid hidden side effects.
- Keep controllers and components thin. Put business logic in services/hooks or plain functions; inject dependencies at I/O boundaries.
- Keep TypeScript strict. Validate runtime inputs and model outputs rather than relying on casts or `any`.
- Prefer small, explicit abstractions that meet current requirements. Avoid speculative infrastructure and duplicated sources of truth.
- Surface meaningful errors without exposing secrets or PII. Keep credentials in server-side environment configuration.
- Test behavior and meaningful failure cases. Add a regression test for a bug fix, and use integration tests when database or HTTP behavior is the contract.

## Repository mechanics

- Backend code is in `src/`; API integration tests are in `test/`. Client code and dependencies are in the separate `client/` package.
- NestJS applies `/api` globally. Controller paths must not duplicate it. Unknown API routes must remain JSON 404s, while non-API deep links load the React app.
- Client API calls use relative `/api/...` URLs. Preserve the Vite development proxy and production SPA serving.
- Use root dependencies for the backend and `yarn --cwd client ...` for client dependencies. Inspect package manifests and installed APIs before adding or using libraries.
- `PROJECT.md` specifies application worker/judge models through `.env`. Using GPT-6 as the coding agent does not authorize changing those identifiers.

## Verify and report

Run focused checks as you work, then the checks appropriate to the completed change. Once those pass, broaden or repeat verification only when new changes, failures, or unresolved concerns justify it. Existing root commands are:

```sh
yarn build
yarn lint
yarn --cwd client lint
yarn test --runInBand
yarn test:e2e --runInBand
```

`yarn lint` applies fixes: inspect its diff. The client currently has no test script; inspect its manifest before claiming to run one. For documentation-only work, verify links, consistency, and formatting rather than running unrelated application tests. Keep default AI tests deterministic and offline, and use synthetic resumes instead of real personal data.

Finish with a concise account of what changed, what passed, and any remaining limitation or blocker. Distinguish checks actually run from proposed checks; do not claim a feature works based only on a stub, mock, or plan.
