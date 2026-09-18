import { z } from 'zod';
export const judgeSchema = z
  .object({
    stage: z.enum(['schema', 'mapping']),
    verdict: z.enum(['accept', 'revise']),
    confidence: z.number().min(0).max(1),
    checks: z
      .object({
        structureValid: z.boolean(),
        sourceCovered: z.boolean(),
        sourceFaithful: z.boolean(),
        piiAbsent: z.boolean(),
      })
      .strict(),
    issues: z.array(
      z
        .object({
          code: z.string().min(1),
          path: z.string().regex(/^(?:\/(?:[^~]|~[01])*)*$/),
          message: z.string().min(1),
          suggestedFix: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();
export type JudgeResult = z.infer<typeof judgeSchema>;
export type Stage = JudgeResult['stage'];
export const jobStatusSchema = z.enum([
  'queued',
  'schema',
  'mapping',
  'review_required',
  'accepted',
  'failed',
  'cancelled',
  'expired',
]);
export type JobStatus = z.infer<typeof jobStatusSchema>;
export const reviewSchema = z
  .object({
    revision: z.number().int().min(0),
    stage: z.literal('mapping'),
    candidate: z.unknown(),
    approve: z.boolean(),
  })
  .strict();
export const exportSchema = z
  .object({
    format: z.enum(['pdf', 'docx']),
    variantId: z.string().uuid().optional(),
  })
  .strict();
export const uploadSchema = z
  .object({
    extension: z.enum(['pdf', 'docx', 'doc']),
    size: z.number().int().min(1).max(20_000_000),
  })
  .strict();

export function acceptsJudge(
  input: unknown,
  stage: Stage,
  validation: { structureValid: boolean; piiAbsent: boolean },
): boolean {
  const result = judgeSchema.safeParse(input);
  if (!result.success) return false;
  const value = result.data;
  return (
    value.stage === stage &&
    value.verdict === 'accept' &&
    value.confidence >= 0.9 &&
    Object.values(value.checks).every(Boolean) &&
    value.issues.length === 0 &&
    validation.structureValid &&
    validation.piiAbsent
  );
}
