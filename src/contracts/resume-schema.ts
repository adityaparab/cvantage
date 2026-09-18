import Ajv from 'ajv';
import { z } from 'zod';

export const MAX_UPLOAD_BYTES = 20_000_000;
export const MAX_STAGE_ITERATIONS = 5;
export const REVIEW_RETENTION_DAYS = 30;
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type ResumeData = Record<string, JsonValue>;
export interface FieldSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  title?: string;
  properties?: Record<string, FieldSchema>;
  required?: string[];
  additionalProperties?: false;
  items?: FieldSchema;
}
export type ResumeSchema = FieldSchema & { $schema: string };
const fieldSchema: z.ZodType<FieldSchema> = z.lazy(() =>
  z
    .object({
      type: z.enum(['object', 'array', 'string', 'number', 'boolean']),
      title: z.string().max(100).optional(),
      properties: z
        .record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/), fieldSchema)
        .optional(),
      required: z.array(z.string()).optional(),
      additionalProperties: z.literal(false).optional(),
      items: fieldSchema.optional(),
    })
    .strict(),
);
const ajv = new Ajv({ strict: true, allErrors: true });
const baseSections = [
  'basics',
  'professionalSummary',
  'workExperience',
  'skills',
];
export const BASE_RESUME_SCHEMA: ResumeSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  required: baseSections,
  properties: {
    basics: { type: 'object', additionalProperties: false, properties: {} },
    professionalSummary: { type: 'string' },
    workExperience: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          employer: { type: 'string' },
          role: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          highlights: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'items'],
        properties: {
          category: { type: 'string' },
          items: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

export function parseResumeSchema(input: unknown): ResumeSchema {
  const envelope = z
    .object({ $schema: z.literal('http://json-schema.org/draft-07/schema#') })
    .passthrough()
    .parse(input);
  const { $schema, ...definition } = envelope;
  const schema = { ...fieldSchema.parse(definition), $schema };
  let fields = 0;
  function check(node: FieldSchema, depth: number) {
    if (++fields > 300 || depth > 8)
      throw new Error('Schema exceeds supported complexity');
    if (node.type === 'object') {
      if (!node.properties || node.additionalProperties !== false || node.items)
        throw new Error('Objects require explicit properties');
      if (node.required?.some((key) => !Object.hasOwn(node.properties!, key)))
        throw new Error('Unknown required property');
      for (const [key, child] of Object.entries(node.properties)) {
        if (
          [
            '__proto__',
            'constructor',
            'prototype',
            'email',
            'phone',
            'contactNumber',
            'location',
            'fullName',
            'name',
          ].includes(key)
        )
          throw new Error('Unsupported or identifying property');
        check(child, depth + 1);
      }
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
      node.properties ||
      node.items ||
      node.required ||
      node.additionalProperties !== undefined
    )
      throw new Error('Invalid scalar definition');
  }
  check(schema, 0);
  if (
    schema.type !== 'object' ||
    baseSections.some((key) => !schema.required?.includes(key))
  )
    throw new Error('Missing required resume sections');
  for (const key of baseSections) {
    if (
      schema.properties?.[key]?.type !==
      BASE_RESUME_SCHEMA.properties![key].type
    )
      throw new Error('Invalid base section type');
  }
  ajv.compile(schema);
  return schema;
}

export function validateResumeData(
  schema: ResumeSchema,
  data: unknown,
): data is ResumeData {
  return ajv.compile(parseResumeSchema(schema))(data) === true;
}

export function preservesFields(
  previous: FieldSchema,
  next: FieldSchema,
): boolean {
  if (previous.type !== next.type) return false;
  if (
    previous.items &&
    (!next.items || !preservesFields(previous.items, next.items))
  )
    return false;
  return Object.entries(previous.properties ?? {}).every(
    ([key, value]) =>
      !!next.properties?.[key] && preservesFields(value, next.properties[key]),
  );
}
