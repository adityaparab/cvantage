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
