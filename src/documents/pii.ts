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
  let result = text;
  for (const value of [pii.name, pii.contactNumber, pii.email, pii.location]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)) {
    result = result.replace(
      new RegExp(escape(value).replace(/\s+/g, '\\s+'), 'gi'),
      '[REDACTED]',
    );
  }
  return result
    .replace(emailPattern, '[REDACTED]')
    .replace(phonePattern, '[REDACTED]');
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
