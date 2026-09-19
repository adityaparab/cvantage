import { z } from 'zod';
export const piiSchema = z
  .object({
    name: z.string().trim().max(200),
    contactNumber: z.string().trim().max(80),
    email: z.union([z.literal(''), z.string().email()]),
    location: z.string().trim().max(200),
  })
  .strict();
export type Pii = z.infer<typeof piiSchema>;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phonePattern =
  /(?<!\w)(?:\+\d[\d ()-]{7,}\d|\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4})(?!\w)/g;
// Include bare/shortened links, regional subdomains, repositories and GitHub
// Pages: each can identify the resume owner. Stop at text/markup delimiters.
function profileLinkPattern(domains: string): string {
  return String.raw`(?<![\w@.-])(?:https?:\/\/|\/\/)?(?:[a-z0-9-]+\.)*(?:${domains})\.?(?![a-z0-9_.-])(?::\d{1,5})?(?:[/?#][^\s<>"'\[\]{}(),;]*)?`;
}
function escape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function redactPii(text: string, pii: Pii): string {
  const known = [
    { value: pii.name, marker: 'PII_NAME' },
    { value: pii.contactNumber, marker: 'PII_PHONE' },
    { value: pii.email, marker: 'PII_EMAIL' },
    { value: pii.location, marker: 'PII_LOCATION' },
  ]
    .filter(({ value }) => value)
    .sort((a, b) => b.value.length - a.value.length);
  const rules: { pattern: string; marker: string | null; url?: boolean }[] = [
    // Match placeholders first so contact values such as "Name" cannot corrupt
    // existing tokens. One replacement pass never redacts its own output again.
    {
      pattern: '\\bPII_(?:NAME|EMAIL|PHONE|LOCATION|GITHUB|LINKEDIN)\\b',
      marker: null,
    },
    {
      pattern: profileLinkPattern(String.raw`github\.com|github\.io`),
      marker: 'PII_GITHUB',
      url: true,
    },
    {
      pattern: profileLinkPattern(String.raw`linkedin\.com|lnkd\.in`),
      marker: 'PII_LINKEDIN',
      url: true,
    },
    ...known.map(({ value, marker }) => ({
      pattern: escape(value).replace(/\s+/g, '\\s+'),
      marker,
    })),
    { pattern: emailPattern.source, marker: 'PII_EMAIL' },
    { pattern: phonePattern.source, marker: 'PII_PHONE' },
  ];
  return text.replace(
    new RegExp(rules.map(({ pattern }) => `(${pattern})`).join('|'), 'gi'),
    (...matches: unknown[]) => {
      const rule = rules.findIndex(
        (_, index) => matches[index + 1] !== undefined,
      );
      const matched = String(matches[0]);
      const replacement = rules[rule].marker;
      if (!replacement) return matched;
      // Keep surrounding sentence punctuation outside the opaque URL marker.
      const suffix = rules[rule].url
        ? (matched.match(/[.!?:]+$/)?.[0] ?? '')
        : '';
      return replacement + suffix;
    },
  );
}
export function containsPii(value: unknown, pii: Pii): boolean {
  if (typeof value === 'string') return value !== redactPii(value, pii);
  if (Array.isArray(value))
    return value.some((item: unknown) => containsPii(item, pii));
  if (value && typeof value === 'object')
    return Object.entries(value).some(
      ([key, item]: [string, unknown]) =>
        containsPii(key, pii) || containsPii(item, pii),
    );
  return false;
}
