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
it('uses typed markers and leaves them unchanged on repeated redaction', () => {
  const result = redactPii(
    `${pii.name}\n${pii.email}\n${pii.contactNumber}\n${pii.location}`,
    pii,
  );
  expect(result).toBe('PII_NAME\nPII_EMAIL\nPII_PHONE\nPII_LOCATION');
  expect(redactPii(result, pii)).toBe(result);
  expect(containsPii(result, pii)).toBe(false);
});
it('does not redact generated markers when a contact value overlaps a marker name', () => {
  const overlapping = { ...pii, name: 'Name', location: 'Email' };
  const result = redactPii('Name Email PII_NAME PII_EMAIL', overlapping);
  expect(result).toBe('PII_NAME PII_LOCATION PII_NAME PII_EMAIL');
  expect(redactPii(result, overlapping)).toBe(result);
});

it.each([
  ['https://github.com/synthetic-user', 'PII_GITHUB'],
  [
    'http://www.github.com/synthetic-user/project?tab=readme#intro',
    'PII_GITHUB',
  ],
  ['github.com/synthetic-user', 'PII_GITHUB'],
  ['WWW.GITHUB.COM/Synthetic-User/', 'PII_GITHUB'],
  ['//gist.github.com/synthetic-user/abcdef', 'PII_GITHUB'],
  ['https://synthetic-user.github.io/portfolio', 'PII_GITHUB'],
  ['synthetic-user.github.io', 'PII_GITHUB'],
  ['https://github.com./synthetic-user', 'PII_GITHUB'],
  ['https://www.linkedin.com/in/synthetic-user/', 'PII_LINKEDIN'],
  ['linkedin.com/in/synthetic-user?trk=public_profile', 'PII_LINKEDIN'],
  ['IN.LINKEDIN.COM/in/Synthetic-User', 'PII_LINKEDIN'],
  ['https://uk.linkedin.com/pub/synthetic-user/1/2/3', 'PII_LINKEDIN'],
  ['https://lnkd.in/synthetic-link', 'PII_LINKEDIN'],
  ['www.linkedin.com/in/synthetic-%E5%90%8D', 'PII_LINKEDIN'],
])('redacts profile URL %s without supplied contact values', (url, marker) => {
  const empty = { name: '', email: '', contactNumber: '', location: '' };
  expect(redactPii(url, empty)).toBe(marker);
  expect(containsPii({ basics: { profiles: [{ url }] } }, empty)).toBe(true);
  expect(containsPii({ [url]: 'profile' }, empty)).toBe(true);
  expect(containsPii(marker, empty)).toBe(false);
  expect(redactPii(marker, empty)).toBe(marker);
});
it('preserves surrounding prose, punctuation, markup and unrelated domains', () => {
  const text =
    'Use GitHub Actions and LinkedIn for work. (github.com/synthetic-user), [profile](https://linkedin.com/in/synthetic-user). https://example.test/jobs github.com.evil.test/name notgithub.com/name';
  expect(redactPii(text, pii)).toBe(
    'Use GitHub Actions and LinkedIn for work. (PII_GITHUB), [profile](PII_LINKEDIN). https://example.test/jobs github.com.evil.test/name notgithub.com/name',
  );
  expect(
    redactPii('github.com/synthetic-user,linkedin.com/in/synthetic-user', pii),
  ).toBe('PII_GITHUB,PII_LINKEDIN');
});
it('redacts full links before overlapping names, preserves markers, and detects hosted email as email', () => {
  const contacts = { ...pii, name: 'GitHub', location: 'LinkedIn' };
  const text =
    'github.com/synthetic-user linkedin.com/in/synthetic-user PII_GITHUB PII_LINKEDIN';
  const redacted = 'PII_GITHUB PII_LINKEDIN PII_GITHUB PII_LINKEDIN';
  expect(redactPii(text, contacts)).toBe(redacted);
  expect(redactPii(redacted, contacts)).toBe(redacted);
  expect(redactPii('person@github.com', pii)).toBe('PII_EMAIL');
  expect(redactPii('Portfolio: synthetic-user.github.io.', pii)).toBe(
    'Portfolio: PII_GITHUB.',
  );
});
