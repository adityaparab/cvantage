import { acceptsJudge } from './workflow';
const accepted = {
  stage: 'mapping',
  verdict: 'accept',
  confidence: 0.9,
  checks: {
    structureValid: true,
    sourceCovered: true,
    sourceFaithful: true,
    piiAbsent: true,
  },
  issues: [],
};
const validation = { structureValid: true, piiAbsent: true };
it('accepts only the full acceptance contract at the threshold', () => {
  expect(acceptsJudge(accepted, 'mapping', validation)).toBe(true);
  expect(
    acceptsJudge({ ...accepted, confidence: 0.899 }, 'mapping', validation),
  ).toBe(false);
  expect(acceptsJudge(accepted, 'schema', validation)).toBe(false);
  expect(
    acceptsJudge(accepted, 'mapping', { ...validation, piiAbsent: false }),
  ).toBe(false);
  expect(
    acceptsJudge({ ...accepted, verdict: 'revise' }, 'mapping', validation),
  ).toBe(false);
  expect(
    acceptsJudge(
      { ...accepted, checks: { ...accepted.checks, sourceFaithful: false } },
      'mapping',
      validation,
    ),
  ).toBe(false);
  expect(
    acceptsJudge(
      {
        ...accepted,
        issues: [
          {
            code: 'missing',
            path: '/skills',
            message: 'Missing source',
            suggestedFix: 'Add source skills',
          },
        ],
      },
      'mapping',
      validation,
    ),
  ).toBe(false);
  expect(acceptsJudge('not json', 'mapping', validation)).toBe(false);
});
