import type { ParseJob } from '../database/records';

// Schema proposals and evaluations are internal, including failed/legacy jobs.
export function publicJob(job: ParseJob) {
  const { leaseToken, leaseUntil, candidate, judge, ...details } = job;
  void leaseToken;
  void leaseUntil;
  return {
    ...details,
    ...(job.stage === 'mapping' ? { candidate, judge } : {}),
  };
}
