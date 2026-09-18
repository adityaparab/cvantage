import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BASE_RESUME_SCHEMA,
  editorSchema,
  parseResumeSchema,
  preservesFields,
  validateResumeData,
} from './resume-schema';
import { LEGACY_RESUME_SCHEMA } from '../../test/fixtures/legacy-schema';
import { applySchemaAdditions, includeBaseFields } from './schema-additions';
const pii = {
  name: 'Synthetic Applicant',
  email: '',
  contactNumber: '',
  location: '',
};
it('loads the exact supplied schema including references, formats and all base fields', () => {
  expect(BASE_RESUME_SCHEMA).toEqual(
    JSON.parse(
      readFileSync(resolve(__dirname, '../../schema/schema.json'), 'utf8'),
    ),
  );
  expect(
    validateResumeData(BASE_RESUME_SCHEMA, {
      basics: { summary: 'Engineer' },
      work: [{ name: 'Example Labs', startDate: '2020-06' }],
      skills: [{ name: 'Languages', keywords: ['TypeScript'] }],
    }),
  ).toBe(true);
  expect(
    validateResumeData(BASE_RESUME_SCHEMA, {
      work: [{ startDate: 'yesterday' }],
    }),
  ).toBe(false);
  expect(
    validateResumeData(BASE_RESUME_SCHEMA, {
      projects: [{ url: 'not a URL' }],
    }),
  ).toBe(false);
});
it('enforces separate contact storage and declared data fields despite additionalProperties in the base file', () => {
  for (const field of ['name', 'email', 'phone', 'location'])
    expect(
      validateResumeData(BASE_RESUME_SCHEMA, {
        basics: { [field]: field === 'location' ? {} : '' },
      }),
    ).toBe(false);
  expect(
    validateResumeData(BASE_RESUME_SCHEMA, { inventedField: 'value' }),
  ).toBe(false);
  expect(
    validateResumeData(BASE_RESUME_SCHEMA, { $schema: 'https://example.test' }),
  ).toBe(false);
  expect(
    validateResumeData(BASE_RESUME_SCHEMA, { basics: { summary: 'Engineer' } }),
  ).toBe(true);
});
it('resolves dates for editing and keeps contact/tooling fields out of the resume form', () => {
  const editor = editorSchema(BASE_RESUME_SCHEMA);
  expect(editor.properties!.basics.properties).not.toHaveProperty('name');
  expect(editor.properties!.basics.properties!.summary.title).toBe(
    'Professional Summary',
  );
  expect(editor.properties!.work.items!.properties!.startDate.type).toBe(
    'string',
  );
  expect(editor.properties).not.toHaveProperty('$schema');
  expect(BASE_RESUME_SCHEMA.properties!.basics.properties).toHaveProperty(
    'name',
  );
});
it('rejects remote and recursive references and unsupported schema keywords', () => {
  expect(() =>
    parseResumeSchema({
      ...BASE_RESUME_SCHEMA,
      $ref: 'https://example.test/schema',
    }),
  ).toThrow();
  expect(() =>
    parseResumeSchema({ ...BASE_RESUME_SCHEMA, default: 'source text' }),
  ).toThrow();
  expect(() =>
    parseResumeSchema({
      ...BASE_RESUME_SCHEMA,
      definitions: { iso8601: { $ref: '#/definitions/iso8601' } },
    }),
  ).toThrow();
});
it('preserves all existing fields, metadata and validation rules through extensions', () => {
  const next = applySchemaAdditions(
    BASE_RESUME_SCHEMA,
    {
      additions: [
        {
          parentPath: '/properties/work/items',
          name: 'teamSize',
          definition: { type: 'number' },
          evidence: 'Managed a team of 6',
        },
      ],
    },
    'Managed a team of 6 engineers.',
    pii,
  );
  expect(preservesFields(BASE_RESUME_SCHEMA, next)).toBe(true);
  expect(preservesFields(next, BASE_RESUME_SCHEMA)).toBe(false);
  for (const mutate of [
    (value: typeof next) => {
      delete value.properties!.education;
    },
    (value: typeof next) => {
      value.title = 'Changed';
    },
    (value: typeof next) => {
      value.additionalProperties = false;
    },
    (value: typeof next) => {
      value.required = ['work'];
    },
    (value: typeof next) => {
      value.definitions!.iso8601.pattern = '';
    },
  ]) {
    const changed = structuredClone(next);
    mutate(changed);
    expect(preservesFields(BASE_RESUME_SCHEMA, changed)).toBe(false);
  }
});
it('rejects replacements, ungrounded additions, PII and executable field definitions', () => {
  const addition = {
    parentPath: '',
    name: 'clearances',
    definition: { type: 'string' },
    evidence: 'Security clearance',
  };
  expect(
    applySchemaAdditions(
      BASE_RESUME_SCHEMA,
      { additions: [] },
      'Engineer',
      pii,
    ),
  ).toEqual(BASE_RESUME_SCHEMA);
  for (const candidate of [
    { ...addition, name: 'work' },
    { ...addition, evidence: 'Not in resume' },
    { ...addition, name: 'fullName' },
    {
      ...addition,
      definition: { type: 'string', title: 'Synthetic Applicant' },
    },
    { ...addition, definition: { $ref: 'https://example.test' } },
    { ...addition, parentPath: '/__proto__' },
  ])
    expect(() =>
      applySchemaAdditions(
        BASE_RESUME_SCHEMA,
        { additions: [candidate] },
        'Security clearance',
        pii,
      ),
    ).toThrow();
  expect(() =>
    applySchemaAdditions(
      BASE_RESUME_SCHEMA,
      BASE_RESUME_SCHEMA,
      'Engineer',
      pii,
    ),
  ).toThrow();
});
it('keeps historical layouts readable and includes baseline fields without removing legacy additions', () => {
  expect(
    validateResumeData(LEGACY_RESUME_SCHEMA, {
      basics: {},
      professionalSummary: 'Engineer',
      workExperience: [],
      skills: [],
    }),
  ).toBe(true);
  const combined = includeBaseFields(LEGACY_RESUME_SCHEMA, BASE_RESUME_SCHEMA);
  expect(combined.properties).toHaveProperty('workExperience');
  expect(combined.properties).toHaveProperty('projects');
  expect(combined.properties!.skills.items!.properties).toHaveProperty(
    'category',
  );
  expect(combined.properties!.skills.items!.properties).toHaveProperty(
    'keywords',
  );
  expect(LEGACY_RESUME_SCHEMA.properties).not.toHaveProperty('projects');
});
