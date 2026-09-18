import type { ResumeSchema } from '../../src/contracts/resume-schema';
// Historical layout, retained for compatibility verification only.
const baseSections = [
  'basics',
  'professionalSummary',
  'workExperience',
  'skills',
];
export const LEGACY_RESUME_SCHEMA: ResumeSchema = {
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
