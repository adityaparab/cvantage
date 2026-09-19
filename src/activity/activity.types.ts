export type StepId =
  | 'preparation_worker'
  | 'preparation_judge'
  | 'mapping_worker'
  | 'mapping_judge'
  | 'resume_analysis'
  | 'job_analysis'
  | 'tailoring_worker'
  | 'tailoring_judge';
export interface StepRun {
  step: StepId;
  attempt: number;
  status: 'active' | 'success' | 'failure';
  retries: number;
  received: number;
  output: string;
  startedAt: Date;
  finishedAt?: Date;
  outcome?: 'revision_requested' | 'interrupted';
}
export interface TailoringActivity {
  _id: string;
  ownerId: string;
  resumeId: string;
  status: 'running' | 'review_required' | 'failed';
  steps: StepRun[];
  variantId?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}
