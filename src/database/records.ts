import type { StepRun } from '../activity/activity.types';
import type { ResumeData, ResumeSchema } from '../contracts/resume-schema';
import type { JobStatus, JudgeResult, Stage } from '../contracts/workflow';
export interface ResumeRecord {
  workflowWrites?: number;
  workflowId?: string;
  _id: string;
  ownerId: string;
  schemaVersion: number;
  data: ResumeData;
  revision: number;
  acceptanceSource: 'judge' | 'user';
  schemaAcceptanceSource?: 'judge' | 'user';
  createdAt: Date;
  updatedAt: Date;
}
export interface PiiRecord {
  expiresAt?: Date;
  _id: string;
  ownerId: string;
  resumeId: string;
  name: string;
  contactNumber: string;
  email: string;
  location: string;
  revision: number;
}
export interface SchemaRecord {
  _id: string;
  version: number;
  definition: ResumeSchema;
  hash: string;
  createdAt: Date;
}
export interface ParseJob {
  activity?: StepRun[];
  _id: string;
  ownerId: string;
  resumeId: string;
  status: JobStatus;
  stage: Stage;
  schemaIterations: number;
  mappingIterations: number;
  schemaVersion?: number;
  source: string;
  piiConfirmed?: boolean;
  failureCode?: string;
  schemaApprovalSource?: 'user';
  candidate?: unknown;
  judge?: JudgeResult;
  revision: number;
  expiresAt: Date;
  createdAt: Date;
  leaseToken?: string;
  leaseUntil?: Date;
}
