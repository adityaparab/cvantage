import { z } from 'zod';
import { containsPii } from '../documents/pii';
import type { Pii } from '../documents/pii';
import { parseResumeSchema, resolveField } from './resume-schema';
import type { FieldSchema, ResumeSchema } from './resume-schema';
const proposalSchema = z
  .object({
    additions: z
      .array(
        z
          .object({
            parentPath: z.string().max(500),
            name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/),
            definition: z.unknown(),
            evidence: z.string().trim().min(3).max(1000),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();
const identifying =
  /^(?:name|first_?name|last_?name|full_?name|email(?:address)?|phone(?:number)?|contactnumber|location)$/i;
const normalize = (text: string) =>
  text.replace(/\s+/g, ' ').trim().toLowerCase();
function checkAddition(field: FieldSchema) {
  if (
    field.$ref ||
    field.definitions ||
    field.$id ||
    field.$schema ||
    field.description ||
    field.pattern ||
    field.format ||
    field.additionalItems !== undefined
  )
    throw new Error('Use simple field definitions for additions');
  for (const [key, child] of Object.entries(field.properties ?? {})) {
    if (identifying.test(key))
      throw new Error('Identifying additions are unsupported');
    checkAddition(child);
  }
  if (field.items) checkAddition(field.items);
}
export function applySchemaAdditions(
  base: ResumeSchema,
  input: unknown,
  source: string,
  pii: Pii,
): ResumeSchema {
  if (containsPii(input, pii))
    throw new Error('Personal values in schema proposal');
  const proposal = proposalSchema.parse(input);
  const next = structuredClone(base);
  for (const addition of proposal.additions) {
    if (!normalize(source).includes(normalize(addition.evidence)))
      throw new Error('Addition lacks source evidence');
    if (identifying.test(addition.name))
      throw new Error('Identifying additions are unsupported');
    const segments =
      addition.parentPath === '' ? [] : addition.parentPath.slice(1).split('/');
    if (addition.parentPath && !addition.parentPath.startsWith('/'))
      throw new Error('Invalid parent path');
    let node: FieldSchema = next;
    for (let i = 0; i < segments.length; i++) {
      if (segments[i] === 'properties') {
        const key = segments[++i];
        if (!key || !Object.hasOwn(node.properties ?? {}, key))
          throw new Error('Unknown parent field');
        node = node.properties![key];
      } else if (segments[i] === 'items' && node.items) node = node.items;
      else throw new Error('Only object property paths can be extended');
      if (node.$ref) throw new Error('Reference definitions are immutable');
    }
    if (
      node.type !== 'object' ||
      !node.properties ||
      Object.hasOwn(node.properties, addition.name)
    )
      throw new Error('Only absent fields may be added');
    if (
      addition.parentPath === '/properties/basics/properties/location' ||
      addition.parentPath.startsWith('/properties/meta')
    )
      throw new Error('No private or tooling additions');
    const wrapper = parseResumeSchema({
      $schema: base.$schema,
      type: 'object',
      properties: { [addition.name]: addition.definition },
    });
    const field = wrapper.properties![addition.name];
    checkAddition(field);
    node.properties[addition.name] = field;
  }
  return parseResumeSchema(next);
}
// Installing the baseline into an existing registry preserves existing fields and
// constraints. Incompatible shared types fail instead of corrupting old definitions.
export function includeBaseFields(
  current: ResumeSchema,
  base: ResumeSchema,
): ResumeSchema {
  function merge(existing: FieldSchema, seed: FieldSchema): FieldSchema {
    if (resolveField(current, existing).type !== resolveField(base, seed).type)
      throw new Error('Seed field type conflicts with the existing registry');
    const result = structuredClone(existing);
    if (seed.properties) {
      result.properties ??= {};
      for (const [key, field] of Object.entries(seed.properties))
        result.properties[key] = result.properties[key]
          ? merge(result.properties[key], field)
          : structuredClone(field);
    }
    if (seed.items && result.items)
      result.items = merge(result.items, seed.items);
    return result;
  }
  const merged = merge(current, base);
  merged.definitions = { ...base.definitions, ...current.definitions };
  return parseResumeSchema({ ...merged, $schema: current.$schema });
}
