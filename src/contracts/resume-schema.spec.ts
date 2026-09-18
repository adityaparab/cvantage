import {
  BASE_RESUME_SCHEMA,
  parseResumeSchema,
  preservesFields,
  validateResumeData,
} from './resume-schema';
it('validates dynamic resume values and rejects unknown fields', () => {
  const data = {
    basics: {},
    professionalSummary: '',
    workExperience: [],
    skills: [],
  };
  expect(validateResumeData(BASE_RESUME_SCHEMA, data)).toBe(true);
  expect(
    validateResumeData(BASE_RESUME_SCHEMA, {
      ...data,
      email: 'a@example.test',
    }),
  ).toBe(false);
});
it('rejects unsupported schemas and identifying fields', () => {
  expect(() =>
    parseResumeSchema({
      ...BASE_RESUME_SCHEMA,
      $ref: 'https://example.test/schema',
    }),
  ).toThrow();
  expect(() =>
    parseResumeSchema({
      ...BASE_RESUME_SCHEMA,
      properties: {
        ...BASE_RESUME_SCHEMA.properties,
        name: { type: 'string' },
      },
    }),
  ).toThrow();
  expect(() =>
    parseResumeSchema({ ...BASE_RESUME_SCHEMA, required: [] }),
  ).toThrow();
});
it('preserves prior fields and types during extension', () => {
  const extended = structuredClone(BASE_RESUME_SCHEMA);
  extended.properties!.education = { type: 'array', items: { type: 'string' } };
  expect(preservesFields(BASE_RESUME_SCHEMA, extended)).toBe(true);
  expect(preservesFields(extended, BASE_RESUME_SCHEMA)).toBe(false);
});
