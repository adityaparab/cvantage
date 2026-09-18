import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { ParseJob, ResumeRecord } from '../database/records';
import type { Variant } from '../tailoring/tailoring.service';
import type { StepRun, TailoringActivity } from './activity.types';

export interface ActivityView {
  id: string;
  resumeId: string;
  kind: 'parsing' | 'tailoring';
  status: string;
  steps: StepRun[];
  createdAt: Date;
  piiConfirmed?: boolean;
  stage?: 'preparation' | 'mapping';
  preparationAttempts?: number;
  mappingAttempts?: number;
  variantId?: string;
}
@Injectable()
export class ActivityService {
  constructor(private readonly database: DatabaseService) {}
  private parsing(job: ParseJob): ActivityView {
    return {
      id: job._id,
      resumeId: job.resumeId,
      kind: 'parsing',
      status: job.status,
      createdAt: job.createdAt,
      piiConfirmed: job.piiConfirmed === true,
      stage: job.stage === 'schema' ? 'preparation' : 'mapping',
      preparationAttempts: job.schemaIterations,
      mappingAttempts: job.mappingIterations,
      // Defense in depth: no schema output, source, candidate, or judge payload here.
      steps: (job.activity ?? []).map((step) => ({
        ...step,
        output: step.step.startsWith('preparation_') ? '' : step.output,
      })),
    };
  }
  private tailoring(record: TailoringActivity): ActivityView {
    const interrupted =
      record.status === 'running' &&
      record.updatedAt.getTime() < Date.now() - 180_000;
    return {
      id: record._id,
      resumeId: record.resumeId,
      kind: 'tailoring',
      status: interrupted ? 'failed' : record.status,
      createdAt: record.createdAt,
      variantId: record.variantId,
      steps: record.steps.map((step) =>
        interrupted && step.status === 'active'
          ? { ...step, status: 'failure', outcome: 'interrupted' }
          : step,
      ),
    };
  }
  async list(ownerId: string) {
    const [jobs, tailoring] = await Promise.all([
      this.database.db
        .collection<ParseJob>('parseJobs')
        .find(
          { ownerId, expiresAt: { $gt: new Date() } },
          {
            projection: {
              source: 0,
              candidate: 0,
              judge: 0,
              leaseToken: 0,
              leaseUntil: 0,
              'activity.output': 0,
              'steps.output': 0,
            },
          },
        )
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray(),
      this.database.db
        .collection<TailoringActivity>('workflowActivities')
        .find(
          { ownerId, expiresAt: { $gt: new Date() } },
          {
            projection: {
              source: 0,
              candidate: 0,
              judge: 0,
              leaseToken: 0,
              leaseUntil: 0,
              'activity.output': 0,
              'steps.output': 0,
            },
          },
        )
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray(),
    ]);
    return [
      ...jobs.map((job) => this.parsing(job)),
      ...tailoring.map((record) => this.tailoring(record)),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((activity) => ({
        ...activity,
        steps: activity.steps.map((step) => ({ ...step, output: '' })),
      }));
  }
  async get(ownerId: string, id: string): Promise<ActivityView> {
    const job = await this.database.db
      .collection<ParseJob>('parseJobs')
      .findOne({ _id: id, ownerId, expiresAt: { $gt: new Date() } });
    if (job) return this.parsing(job);
    const resume = await this.database.db
      .collection<ResumeRecord>('resumes')
      .findOne({ workflowId: id, ownerId });
    if (resume)
      return {
        id,
        resumeId: resume._id,
        kind: 'parsing',
        status: 'completed',
        steps: [],
        createdAt: resume.createdAt,
      };
    const variant = await this.database.db
      .collection<Variant>('variants')
      .findOne({ workflowId: id, ownerId });
    if (variant?.status === 'reviewed')
      return {
        id,
        resumeId: variant.resumeId,
        variantId: variant._id,
        kind: 'tailoring',
        status: 'completed',
        steps: [],
        createdAt: variant.createdAt,
      };
    const activity = await this.database.db
      .collection<TailoringActivity>('workflowActivities')
      .findOne({ _id: id, ownerId, expiresAt: { $gt: new Date() } });
    if (activity) return this.tailoring(activity);
    throw new NotFoundException(
      'This workflow was deleted or expired. Return to your workspace.',
    );
  }
}
