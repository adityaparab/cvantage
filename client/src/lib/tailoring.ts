export interface Suggestion {
  id: string;
  label: string;
  before: string;
  after: string;
}
export interface Variant {
  _id: string;
  resumeId: string;
  workflowId?: string;
  revision: number;
  schemaVersion: number;
  data: unknown;
  sourceData: unknown;
  sourceRevision: number;
  status: 'review_required' | 'reviewed';
  stale?: boolean;
  suggestions: Suggestion[];
  appliedSuggestionIds?: string[];
  analyses?: {
    resume: { summary: string; findings: string[] };
    job: { summary: string; findings: string[] };
  };
  judge?: {
    confidence: number;
    issues: { message: string; suggestedFix: string }[];
  };
}
export function variantPath(resumeId: string, variantId: string) {
  return `/tailoring/resumes/${resumeId}/versions/${variantId}`;
}
export function analysisPath(workflowId: string) {
  return `/tailoring/analysis/${workflowId}`;
}
