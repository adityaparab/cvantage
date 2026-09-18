import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

export const MAX_UPLOAD_BYTES = 20_000_000;
export const STAGE_ITERATION_LIMITS = { schema: 1, mapping: 5 } as const;
export const REVIEW_RETENTION_DAYS = 30;
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type ResumeData = Record<string, JsonValue>;
export interface FieldSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'boolean';
  $ref?: string;
  $id?: string;
  $schema?: string;
  definitions?: Record<string, FieldSchema>;
  title?: string;
  description?: string;
  pattern?: string;
  format?: 'uri' | 'email';
  properties?: Record<string, FieldSchema>;
  required?: string[];
  additionalProperties?: boolean;
  additionalItems?: false;
  items?: FieldSchema;
}
export type ResumeSchema = FieldSchema & { $schema: string; type: 'object' };
export const PERSONAL_FIELDS = ['name', 'email', 'phone', 'location'];
const DATE_PATTERN =
  '^([1-2][0-9]{3}-[0-1][0-9]-[0-3][0-9]|[1-2][0-9]{3}-[0-1][0-9]|[1-2][0-9]{3})$';
const keySchema = z
  .string()
  .regex(/^(?:\$schema|[a-zA-Z][a-zA-Z0-9_]{0,63})$/)
  .refine(
    (key) => !['constructor', 'prototype', 'proto'].includes(key.toLowerCase()),
  );
const fieldSchema: z.ZodType<FieldSchema> = z.lazy(() =>
  z
    .object({
      type: z
        .enum(['object', 'array', 'string', 'number', 'boolean'])
        .optional(),
      $schema: z.literal('http://json-schema.org/draft-07/schema#').optional(),
      $id: z.string().max(500).optional(),
      $ref: z
        .string()
        .regex(/^#\/definitions\/[a-zA-Z][a-zA-Z0-9_]*$/)
        .optional(),
      definitions: z.record(keySchema, fieldSchema).optional(),
      title: z.string().max(100).optional(),
      description: z.string().max(2000).optional(),
      pattern: z.literal(DATE_PATTERN).optional(),
      format: z.enum(['uri', 'email']).optional(),
      properties: z.record(keySchema, fieldSchema).optional(),
      required: z.array(keySchema).optional(),
      additionalProperties: z.boolean().optional(),
      additionalItems: z.literal(false).optional(),
      items: fieldSchema.optional(),
    })
    .strict(),
);
// draft-07 permits additionalItems beside homogeneous items; the keyword is ignored.
// Our allowlist still rejects unknown/executable keywords before AJV compilation.
const ajv = new Ajv({
  strict: true,
  strictSchema: false,
  allErrors: true,
  addUsedSchema: false,
});
addFormats(ajv);

export function resolveField(
  root: FieldSchema,
  node: FieldSchema,
): FieldSchema {
  const seen = new Set<string>();
  while (node.$ref) {
    if (seen.has(node.$ref))
      throw new Error('Recursive schema references are unsupported');
    seen.add(node.$ref);
    const target = root.definitions?.[node.$ref.slice('#/definitions/'.length)];
    if (!target) throw new Error('Unknown local schema reference');
    node = target;
  }
  return node;
}
export function parseResumeSchema(input: unknown): ResumeSchema {
  const parsed = fieldSchema.parse(input);
  if (
    parsed.type !== 'object' ||
    parsed.$schema !== 'http://json-schema.org/draft-07/schema#'
  )
    throw new Error('Expected a draft-07 resume object');
  const schema: ResumeSchema = {
    ...parsed,
    type: 'object',
    $schema: parsed.$schema,
  };
  let fields = 0;
  function check(raw: FieldSchema, depth: number) {
    if (++fields > 500 || depth > 8)
      throw new Error('Schema exceeds supported complexity');
    if (raw.$ref && Object.keys(raw).some((key) => key !== '$ref'))
      throw new Error('References cannot override fields');
    const node = resolveField(schema, raw);
    if (node.type === 'object') {
      if (!node.properties || node.items)
        throw new Error('Objects require explicit properties');
      if (node.required?.some((key) => !Object.hasOwn(node.properties!, key)))
        throw new Error('Unknown required property');
      Object.values(node.properties).forEach((child) =>
        check(child, depth + 1),
      );
    } else if (node.type === 'array') {
      if (
        !node.items ||
        node.properties ||
        node.required ||
        node.additionalProperties !== undefined
      )
        throw new Error('Arrays require items');
      check(node.items, depth + 1);
    } else if (
      !node.type ||
      node.properties ||
      node.items ||
      node.required ||
      node.additionalProperties !== undefined ||
      node.additionalItems !== undefined
    )
      throw new Error('Invalid scalar definition');
  }
  check(schema, 0);
  for (const definition of Object.values(schema.definitions ?? {}))
    check(definition, 1);
  ajv.compile(schema);
  return schema;
}
export function validateResumeData(
  schema: ResumeSchema,
  data: unknown,
): data is ResumeData {
  const parsed = parseResumeSchema(schema);
  if (!ajv.compile(parsed)(data)) return false;
  function declared(raw: FieldSchema, value: unknown, path = ''): boolean {
    const node = resolveField(parsed, raw);
    if (node.type === 'array' && Array.isArray(value))
      return value.every((item) => declared(node.items!, item, path + '/*'));
    if (
      node.type !== 'object' ||
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    )
      return true;
    return Object.entries(value).every(([key, item]) => {
      // Contact values live exclusively in resumePii, even though their definitions
      // remain in the immutable source schema. Tooling metadata is not resume content.
      if (
        (path === '/basics' && PERSONAL_FIELDS.includes(key)) ||
        (path === '' && ['$schema', 'meta'].includes(key))
      )
        return false;
      const field = node.properties?.[key];
      return !!field && declared(field, item, `${path}/${key}`);
    });
  }
  return declared(parsed, data);
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  return JSON.stringify(value);
}
// Existing definitions, metadata, validation constraints and required lists are
// immutable. Only new properties, recursively within existing objects, may differ.
export function preservesFields(
  previous: FieldSchema,
  next: FieldSchema,
): boolean {
  const { properties: oldProperties, items: oldItems, ...oldRules } = previous;
  const { properties: newProperties, items: newItems, ...newRules } = next;
  if (canonical(oldRules) !== canonical(newRules)) return false;
  if (
    !!oldItems !== !!newItems ||
    (oldItems && !preservesFields(oldItems, newItems!))
  )
    return false;
  return Object.entries(oldProperties ?? {}).every(
    ([key, child]) =>
      !!newProperties?.[key] && preservesFields(child, newProperties[key]),
  );
}
export function editorSchema(schema: ResumeSchema): ResumeSchema {
  function view(raw: FieldSchema, path = ''): FieldSchema {
    const node = resolveField(schema, raw);
    const { $ref, definitions, ...copy } = node;
    void $ref;
    void definitions;
    if (copy.properties)
      copy.properties = Object.fromEntries(
        Object.entries(copy.properties)
          .filter(
            ([key]) =>
              !(path === '/basics' && PERSONAL_FIELDS.includes(key)) &&
              !(path === '' && ['$schema', 'meta'].includes(key)),
          )
          .map(([key, child]) => [key, view(child, `${path}/${key}`)]),
      );
    if (copy.items) copy.items = view(copy.items, path + '/*');
    if (path === '/basics/summary') copy.title = 'Professional Summary';
    return copy;
  }
  return { ...view(schema), type: 'object', $schema: schema.$schema };
}
function loadBase(): ResumeSchema {
  try {
    return parseResumeSchema(
      JSON.parse(
        readFileSync(resolve(__dirname, '../../schema/schema.json'), 'utf8'),
      ) as unknown,
    );
  } catch {
    throw new Error(
      'Cannot load schema/schema.json. Check that the supplied draft-07 schema is present and valid.',
    );
  }
}
export const BASE_RESUME_SCHEMA = loadBase();
