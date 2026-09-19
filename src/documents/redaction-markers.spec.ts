import { normalizeRedactionMarkers } from './redaction-markers';
import { containsPii, redactPii } from './pii';

it('normalizes explicit equivalent placeholders without a model call', () => {
  const source =
    '[FULL NAME] <email removed> PHONE_REDACTED {address hidden} (mobile number) pii-e_mail [NameRemoved]';
  expect(normalizeRedactionMarkers(source)).toBe(
    'PII_NAME PII_EMAIL PII_PHONE PII_LOCATION PII_PHONE PII_EMAIL PII_NAME',
  );
});
it('keeps professional prose and ambiguous placeholders intact and is idempotent', () => {
  const source =
    'Name matching, email marketing and mobile development in cloud platforms. [REDACTED] [employer hidden] [TypeScript] PII_EMAIL';
  expect(normalizeRedactionMarkers(source)).toBe(source);
  const once = normalizeRedactionMarkers('[phone number masked]');
  expect(normalizeRedactionMarkers(once)).toBe(once);
});
it('keeps marker normalization separate from PII detection', () => {
  const pii = { name: '', email: '', contactNumber: '', location: '' };
  expect(containsPii('[EMAIL REMOVED]', pii)).toBe(false);
  expect(redactPii('extra.person@example.test +1 555 987 6543', pii)).toBe(
    'PII_EMAIL PII_PHONE',
  );
});
