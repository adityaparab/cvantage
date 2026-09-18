import type {
  FieldSchema,
  ResumeData,
  ResumeSchema,
} from '../contracts/resume-schema';
import type { Pii } from '../documents/pii';
export interface Block {
  text: string;
  kind: 'title' | 'contact' | 'heading' | 'body';
  depth: number;
}
const label = (key: string) =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, (x) => x.toUpperCase());
export function presentResume(
  schema: ResumeSchema,
  data: ResumeData,
  pii: Pii,
): Block[] {
  const blocks: Block[] = [
    { text: pii.name || 'Resume', kind: 'title', depth: 0 },
  ];
  const contact = [pii.email, pii.contactNumber, pii.location]
    .filter(Boolean)
    .join(' · ');
  if (contact) blocks.push({ text: contact, kind: 'contact', depth: 0 });
  function add(
    field: FieldSchema,
    value: unknown,
    title: string,
    depth: number,
  ) {
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    )
      return;
    if (
      field.type === 'object' &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      const start = blocks.length;
      blocks.push({ text: title, kind: 'heading', depth });
      for (const [key, child] of Object.entries(field.properties ?? {}))
        add(
          child,
          (value as Record<string, unknown>)[key],
          child.title || label(key),
          depth + 1,
        );
      if (blocks.length === start + 1) blocks.pop();
      return;
    }
    if (field.type === 'array' && Array.isArray(value) && field.items) {
      blocks.push({ text: title, kind: 'heading', depth });
      value.forEach((item: unknown, index) =>
        add(
          field.items!,
          item,
          typeof item === 'object' ? `${title} ${index + 1}` : '',
          depth + 1,
        ),
      );
      return;
    }
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    )
      throw new Error('Invalid presentation value');
    blocks.push({
      text: `${title ? `${title}: ` : ''}${typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}`,
      kind: 'body',
      depth,
    });
  }
  for (const [key, field] of Object.entries(schema.properties ?? {}))
    add(field, data[key], field.title || label(key), 0);
  return blocks;
}
