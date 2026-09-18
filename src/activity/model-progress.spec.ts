import { safePreview, trackedGenerate } from './model-progress';
import type { StepRun } from './activity.types';
const pii = {
  name: 'Synthetic Applicant',
  email: 'private@example.test',
  contactNumber: '+1 555 123 4567',
  location: 'Warsaw, Poland',
};
it('withholds incomplete strings and redacts escaped and split identifying details', () => {
  expect(safePreview('{"summary":"Synthetic Appli', pii)).toBe('');
  const raw =
    '{"summary":"Synthetic Applicant in Wars\\u0061w, Poland. private@example.test. +1 555 123 4567","skills":["TypeScript",';
  expect(safePreview(raw, pii)).toBe(
    '[REDACTED] in [REDACTED]. [REDACTED]. [REDACTED]\nTypeScript',
  );
  expect(safePreview('{"summary":"I use \\"', pii)).toBe('');
});
it('persists provisional safe output and resets it on transport retry', async () => {
  const run: StepRun = {
    step: 'mapping_worker',
    status: 'active',
    attempt: 2,
    retries: 0,
    output: '',
    received: 0,
    startedAt: new Date(),
  };
  const snapshots: StepRun[] = [];
  await trackedGenerate(
    {
      generate: async (_role, _instructions, _data, observe) => {
        await observe?.({
          type: 'delta',
          text: '{"summary":"Safe first response",',
        });
        await observe?.({ type: 'retry', attempt: 1 });
        await observe?.({
          type: 'delta',
          text: '{"summary":"Synthetic Applicant writes TypeScript"}',
        });
        return { summary: 'Synthetic Applicant writes TypeScript' };
      },
    },
    'worker',
    '',
    {},
    pii,
    run,
    () => {
      snapshots.push({ ...run });
      return Promise.resolve();
    },
  );
  expect(
    snapshots.some(
      (value) =>
        value.status === 'active' && value.output === 'Safe first response',
    ),
  ).toBe(true);
  expect(
    snapshots.some((value) => value.retries === 1 && value.output === ''),
  ).toBe(true);
  expect(run).toMatchObject({
    output: '[REDACTED] writes TypeScript',
    status: 'success',
    retries: 1,
  });
});
it('never stores schema output or streams it to activity subscribers', async () => {
  const run: StepRun = {
    step: 'preparation_worker',
    status: 'active',
    attempt: 1,
    retries: 0,
    received: 0,
    output: '',
    startedAt: new Date(),
  };
  await trackedGenerate(
    {
      generate: async (_role, _instructions, _data, observe) => {
        await observe?.({
          type: 'delta',
          text: '{"secretSchema":"internal fields"}',
        });
        return {};
      },
    },
    'worker',
    '',
    {},
    pii,
    run,
    () => {
      expect(run.output).toBe('');
      return Promise.resolve();
    },
  );
  expect(run.received).toBeGreaterThan(0);
});
