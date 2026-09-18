import { containsPii, redactPii } from './pii';
const pii = {
  name: 'Synthetic Applicant',
  email: 'applicant@example.test',
  contactNumber: '+1 555 123 4567',
  location: 'Warsaw, Poland',
};
it('redacts repeated contact values, names and locations without removing professional facts', () => {
  const result = redactPii(
    'Synthetic Applicant\napplicant@example.test\n+1 555 123 4567\nWarsaw, Poland\nReact engineer at Example Labs.\nSYNTHETIC APPLICANT',
    pii,
  );
  expect(result).not.toMatch(
    /synthetic applicant|applicant@example.test|Warsaw|555/i,
  );
  expect(result).toContain('React engineer at Example Labs');
  expect(
    containsPii({ basics: { headline: 'Synthetic Applicant' } }, pii),
  ).toBe(true);
});
