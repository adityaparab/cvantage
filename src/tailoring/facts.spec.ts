import { preservesFacts } from './facts';
const source = {
  basics: { headline: 'Engineer' },
  professionalSummary: 'Software developer',
  workExperience: [
    {
      employer: 'Example Labs',
      startDate: '2020',
      highlights: ['Built 3 tools'],
    },
  ],
  skills: [{ category: 'Languages', items: ['TypeScript'] }],
};
it('allows narrative emphasis while protecting facts and numerical claims', () => {
  expect(
    preservesFacts(source, {
      ...source,
      professionalSummary: 'Developer focused on software',
    }),
  ).toBe(true);
  expect(
    preservesFacts(source, {
      ...source,
      skills: [{ category: 'Languages', items: ['Python'] }],
    }),
  ).toBe(false);
  expect(
    preservesFacts(source, {
      ...source,
      professionalSummary: 'Developer with 15 years experience',
    }),
  ).toBe(false);
  expect(
    preservesFacts(source, {
      ...source,
      workExperience: [
        { ...source.workExperience[0], highlights: ['Built 30 tools'] },
      ],
    }),
  ).toBe(false);
  expect(
    preservesFacts(source, {
      ...source,
      workExperience: [
        { ...source.workExperience[0], employer: 'Invented Employer' },
      ],
    }),
  ).toBe(false);
});
