---
name: resume-ai-workflow
description: Implement or review CVantage LangChain/LangGraph parsing, LiteLLM integration, worker-judge contracts, user review transitions, and factual tailoring. Use when changing model calls, prompts, graph state, or acceptance logic.
---

# Resume AI workflow

Read the parsing, judge, and versioning sections in [PROJECT.md](../../../PROJECT.md) before changing workflow behavior. Read the relevant milestone in [PLAN.md](../../../PLAN.md). Inspect the installed LangChain/LangGraph versions and their APIs instead of assuming examples from another version apply.

## Model boundary

Use injectable model adapters through the configured LiteLLM proxy. Read worker and judge identifiers from `LITELLM_WORKER_MODEL` and `LITELLM_JUDGE_MODEL`; the development model is unrelated to these runtime identifiers. Never print `.env` contents or include credentials in test fixtures.

Keep trusted instructions separate from redacted source data and job descriptions. Do not give extraction or judging calls unrelated tools. Treat worker output and judge feedback as untrusted input: validate structure and screen for PII before storing or feeding them to another call. Provider-side structured output, when supported, does not replace application validation.

## Graph and acceptance

- Model schema generation and value mapping as separate stages with separate counters. An iteration includes a worker proposal and its judge evaluation; the initial proposal counts. Invalid output still consumes budget.
- Implement acceptance as a single tested application function using the exact contract in `PROJECT.md`. Do not let individual graph nodes weaken it or use confidence alone as approval.
- Route rejected output back with actionable feedback until the stage budget is exhausted, then pause for user review. Do not add hidden correction calls, recursive retries, or fresh graphs that reset the limit.
- Keep transport retries bounded separately. Represent cancellation, provider failure, review-required, and accepted outcomes distinctly. A network failure is not a successful judgment.
- Publish/reuse an approved schema before mapping, then pin its version for that mapping loop. Schema publication conflicts consume the remaining schema-validation budget rather than creating a new allowance.
- User review resolves uncertainty without bypassing structural or PII checks. Record user approval independently from judge verdict/confidence, and resume only the appropriate next stage.
- Checkpoint only sanitized, retention-approved state. Coordinate attempt identities, leases, and final writes with the persistence implementation so restarts cannot repeat unlimited work or overwrite user corrections.

## Tailoring

Use the corrected resume revision and its original schema version as the source of truth. Save a separate variant. Job descriptions can guide emphasis, not supply new claims about the applicant. Preserve factual fields and flag unsupported changes for user review. Do not reuse parsing iteration limits as an undocumented tailoring policy.

## Verification

Use scripted fake-model responses to test acceptance, malformed JSON, contradictory checks, boundary confidence, exhaustion in both stages, cancellation, and resume-after-review. Include source text containing instruction-like content and ensure it remains data. Test the actual serialized inputs and checkpoints for synthetic PII leaks. Keep live-proxy quality evaluations separate from deterministic tests and report observed failures without silently changing acceptance rules.
