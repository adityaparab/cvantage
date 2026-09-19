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
  const rules = [
    // Match placeholders first so contact values such as "Name" cannot corrupt
    // existing tokens. One replacement pass never redacts its own output again.
    { pattern: '\\bPII_(?:NAME|EMAIL|PHONE|LOCATION)\\b', marker: null },
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
      return rules[rule].marker ?? String(matches[0]);
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
