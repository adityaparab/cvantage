import { applySuggestions, suggestions } from './suggestions';
const source = {
  basics: { summary: 'Build tools', label: 'Engineer' },
  work: [{ name: 'Example', highlights: ['Built a tool', 'Shipped software'] }],
  skills: [{ name: 'TypeScript' }],
};
const proposal = {
  ...source,
  basics: { ...source.basics, summary: 'Engineer building tools' },
  work: [
    {
      ...source.work[0],
      highlights: ['Created a useful tool', 'Shipped software'],
    },
  ],
};
it('applies only selected narrative changes and preserves the source and factual groups', () => {
  const changes = suggestions(source, proposal);
  expect(changes.map((item) => item.id)).toEqual([
    '/basics/summary',
    '/work/0/highlights/0',
  ]);
  const result = applySuggestions(source, proposal, ['/work/0/highlights/0']);
  expect(result).toEqual({ ...source, work: proposal.work });
  expect(source.work[0].highlights[0]).toBe('Built a tool');
  expect(applySuggestions(source, proposal, [])).toEqual(source);
});
it('rejects unknown, factual, prototype and duplicate selection paths', () => {
  for (const selected of [
    ['/skills/0/name'],
    ['/__proto__/polluted'],
    ['/basics/summary', '/basics/summary'],
  ])
    expect(() => applySuggestions(source, proposal, selected)).toThrow(
      'valid suggestions',
    );
});
it('supports historical summary and highlight names and ignores unchanged fields', () => {
  const before = {
    professionalSummary: 'Engineer',
    workExperience: [{ highlights: ['Built tools'] }],
  };
  const after = {
    professionalSummary: 'Tool engineer',
    workExperience: [{ highlights: ['Delivered tools'] }],
  };
  expect(applySuggestions(before, after, ['/professionalSummary'])).toEqual({
    ...before,
    professionalSummary: 'Tool engineer',
  });
  expect(suggestions(source, source)).toEqual([]);
});
