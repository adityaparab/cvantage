---
name: resume-documents
description: Implement or review CVantage PDF, DOCX, and DOC ingestion, local PII redaction, temporary-file lifecycle, and on-demand PDF/DOCX export. Use for document adapters and file processing, not general Markdown edits.
---

# Resume document processing

Read the uploads, PII, and export requirements in [PROJECT.md](../../../PROJECT.md), then the relevant milestone in [PLAN.md](../../../PLAN.md). Treat its exact formats and byte limit as the source of truth.

## Ingestion

- Enforce upload limits while receiving data, before allocating an oversized buffer. Verify actual content as well as extension/MIME declarations.
- Keep independent adapters for PDF, DOCX, and legacy DOC. Prove support with real synthetic format fixtures; a DOC file renamed to DOCX is not conversion.
- Inspect parser runtime requirements before selecting a dependency. If invoking an external parser, use explicit executable arguments rather than interpolating upload names into a shell command; bound execution and resource use.
- Treat uploaded content as data. Do not execute document macros, follow embedded external resources, or use user-controlled filenames as filesystem paths.
- Prefer memory. If temporary files are necessary, use isolated generated paths and cleanup on success, error, timeout, and cancellation; provide recovery for abandoned temporary files after crashes. Delete originals before waiting for user review.
- Return actionable errors for corrupt, unsupported/encrypted, or textless documents. Do not silently add OCR or report an empty extraction as success.

## PII boundary

Extract and redact the user's name, phone, email, and location locally before LLM dispatch. Regex matching email/phone alone is not sufficient for names and locations. Preserve legitimate professional facts while removing the user's identifying values wherever they recur.

Where detection is uncertain, obtain corrections before sending source text to a model. Store PII in its separate authorized record, not resume data, checkpoints, parser logs, or schema examples. Reapply this boundary after user edits and before tailoring. Use opaque placeholders only where needed; keep any re-identification mapping out of model-visible content.

## Export

Render from the selected structured source/variant and its recorded schema. Retrieve associated PII explicitly and combine it on the server, without a model call. Escape user-provided text in rendering templates; do not execute HTML or fetch arbitrary remote resources from resume fields.

Generate PDF or DOCX only, include additional supported schema sections, and stream the result with correct headers. Do not persist exports. Ensure cleanup works when the client disconnects as well as when rendering fails.

## Verification

Use synthetic fixtures for each true format, exact upload-size boundaries, misleading extensions, corruption, repeated PII, Unicode, and multi-page resumes. Inspect captured model inputs and cleanup paths. Check exported text/content and DOCX structure, then visually review representative PDF/DOCX layouts; text extraction alone cannot establish layout quality.
