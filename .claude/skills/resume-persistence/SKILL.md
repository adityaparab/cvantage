---
name: resume-persistence
description: Implement or review CVantage MongoDB repositories, global resume schema publication, PII storage, user revisions, and durable parsing jobs. Use for persistence and concurrency changes, not ordinary UI work.
---

# Resume persistence

Read the relevant schema/versioning and PII sections in [PROJECT.md](../../../PROJECT.md) and persistence boundaries in [PLAN.md](../../../PLAN.md). They define the product rules and proposed architecture. Inspect installed database dependencies before choosing an integration; this skill does not imply persistence already exists.

## Queries and record boundaries

- Require authenticated owner IDs in queries for resumes, PII, jobs, drafts, and variants. Derive ownership from the server session, never a request body's owner field. Check a variant belongs to both the requested resume and user.
- Store PII separately and select it explicitly only for authorized editing or export. Avoid automatic joins that expose PII in ordinary resume or job responses.
- Distinguish a resume JSON Schema from a database model and a DTO. Validate dynamic resume values against the record's JSON Schema before saving; TypeScript types alone do not validate runtime data.
- Build allowlisted updates. Do not pass arbitrary client or model objects directly as MongoDB query/update operators or allow clients to change ownership, approval metadata, or extraction version.
- Save user edits with an expected revision in the update condition and increment it atomically. A failed match is a conflict, not permission to overwrite the current record.

## Publishing global schemas

Keep approved definitions immutable. Compare normalized definitions to avoid a new version for formatting changes alone. A global definition may describe fields but must not contain a user's values, PII, or source excerpts.

Publication must persist the approved version and advance the registry consistently. Choose a transaction or another explicit atomic protocol; document deployment prerequisites and prove recovery cannot leave the registry pointing at a missing or unapproved version. A uniqueness check followed by an unguarded insert is insufficient under concurrency.

If publication loses a race, reload the latest definition, preserve its fields, and revalidate the combined additions within the workflow's remaining budget. Keep old records on their extraction version, including editing, tailoring, and export. Do not add automatic migrations.

## Jobs and recovery

- Persist iteration counters before work can be replayed; give each execution an attempt identity. Define recovery for a process dying between dispatch and result persistence without resetting the budget.
- Use expiring leases and an ownership token on job updates so an expired worker cannot overwrite a newer worker's result. Make final writes and review decisions idempotent.
- Do not persist file bytes, unredacted text, or PII in checkpoints. Set draft/source expiration only after the retention policy in `PROJECT.md` is resolved; an absent policy is not indefinite retention.

## Verification

Use a disposable MongoDB database with the same atomic-operation capabilities as the intended runtime. Test cross-user access, stale edits, concurrent publication, duplicate completion, lease loss, and old-version reads. Mock-only tests do not prove database concurrency behavior.
