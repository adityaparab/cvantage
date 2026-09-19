import { analysisPath, variantPath } from './tailoring';
export interface StepRun {
  step: string;
  attempt: number;
  status: 'active' | 'success' | 'failure';
  retries: number;
  received: number;
  output: string;
  outcome?: 'revision_requested' | 'interrupted';
}
export interface Activity {
  id: string;
  resumeId: string;
  kind: 'parsing' | 'tailoring';
  status: string;
  steps: StepRun[];
  createdAt: string;
  piiConfirmed?: boolean;
  stage?: string;
  preparationAttempts?: number;
  mappingAttempts?: number;
  variantId?: string;
}
export function activityStatus(activity: Activity) {
  if (activity.status === 'completed') return 'Completed';
  if (activity.status === 'failed') return 'Needs attention';
  if (activity.kind === 'parsing' && !activity.piiConfirmed)
    return 'Redaction review required';
  if (activity.status === 'review_required') return 'Ready for your review';
  if (
    activity.steps.some((step) => step.status === 'active') ||
    (activity.status === 'running' && activity.steps.length > 0)
  )
    return 'In progress';
  return 'Queued';
}
export function activityTitle(activity: Activity) {
  if (
    activity.kind === 'parsing' &&
    !activity.piiConfirmed &&
    activity.status !== 'completed'
  )
    return 'Upload review';
  return activity.kind === 'parsing' ? 'Resume parsing' : 'Resume tailoring';
}

export function activityHref(activity: Activity) {
  return activity.kind === 'parsing' &&
    !activity.piiConfirmed &&
    activity.status !== 'completed'
    ? `/resumes/uploads/${activity.id}/review`
    : activity.kind === 'tailoring'
      ? activity.variantId
        ? `${variantPath(activity.resumeId, activity.variantId)}/${activity.status === 'completed' ? 'resume' : 'suggestions'}`
        : analysisPath(activity.id)
      : `/resumes/activity/${activity.id}`;
}
