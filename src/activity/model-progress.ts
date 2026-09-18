import type { ModelGateway } from '../adapters/ports';
import { redactPii } from '../documents/pii';
import type { Pii } from '../documents/pii';
import type { StepRun } from './activity.types';

// Wait for complete JSON string tokens before decoding/redacting. This prevents
// split tokens and escaped Unicode from exposing identifying prefixes in previews.
export function safePreview(raw: string, pii: Pii): string {
  const values: string[] = [];
  const tokens = raw.matchAll(/"(?:[^"\\]|\\[\s\S])*"/g);
  for (const token of tokens) {
    const end = (token.index ?? 0) + token[0].length;
    const following = raw.slice(end).trimStart();
    if (!following || following.startsWith(':')) continue;
    try {
      const value: unknown = JSON.parse(token[0]);
      if (typeof value === 'string' && value.length)
        values.push(redactPii(value, pii));
    } catch {
      /* Incomplete or malformed tokens are never displayed. */
    }
  }
  return values.join('\n').slice(0, 8000);
}

export async function trackedGenerate(
  models: ModelGateway,
  role: 'worker' | 'judge',
  instructions: string,
  data: unknown,
  pii: Pii,
  run: StepRun,
  save: () => Promise<void>,
): Promise<unknown> {
  let raw = '';
  let lastWrite = 0;
  const hidden = run.step.startsWith('preparation_');
  await save();
  try {
    const result = await models.generate(
      role,
      instructions,
      data,
      async (event) => {
        if (event.type === 'retry') {
          raw = '';
          run.output = '';
          run.received = 0;
          run.retries = event.attempt;
        } else {
          raw += event.text;
          run.received += event.text.length;
        }
        if (event.type === 'retry' || Date.now() - lastWrite >= 200) {
          run.output = hidden ? '' : safePreview(raw, pii);
          await save();
          lastWrite = Date.now();
        }
      },
    );
    run.output = hidden ? '' : safePreview(raw, pii);
    run.status = 'success';
    run.finishedAt = new Date();
    await save();
    return result;
  } catch {
    run.status = 'failure';
    run.finishedAt = new Date();
    await save();
    throw new Error('MODEL_STEP_FAILED');
  }
}
