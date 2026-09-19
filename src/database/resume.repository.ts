import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ResumeData } from '../contracts/resume-schema';
import { DatabaseService } from './database.service';
import type { PiiRecord, ResumeRecord } from './records';
import type { ClientSession } from 'mongodb';

@Injectable()
export class ResumeRepository {
  constructor(private readonly database: DatabaseService) {}
  list(ownerId: string) {
    return this.database.db
      .collection<ResumeRecord>('resumes')
      .find({ ownerId }, { projection: { workflowWrites: 0 } })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();
  }
  async get(ownerId: string, id: string) {
    const record = await this.database.db
      .collection<ResumeRecord>('resumes')
      .findOne({ _id: id, ownerId }, { projection: { workflowWrites: 0 } });
    if (!record) throw new NotFoundException('Resume not found');
    return record;
  }
  getPii(ownerId: string, resumeId: string) {
    return this.database.db
      .collection<PiiRecord>('resumePii')
      .findOne({ ownerId, resumeId });
  }
  // Serialize workflow inserts with deletion without changing the content revision.
  async fenceWorkflow(
    ownerId: string,
    id: string,
    revision: number,
    session: ClientSession,
  ) {
    const result = await this.database.db
      .collection<ResumeRecord>('resumes')
      .updateOne(
        { _id: id, ownerId, revision },
        { $inc: { workflowWrites: 1 } },
        { session },
      );
    if (!result.matchedCount)
      throw new ConflictException(
        'Resume changed or was deleted; reload before tailoring',
      );
  }
  async delete(ownerId: string, id: string, revision: number) {
    const session = this.database.client.startSession();
    try {
      await session.withTransaction(async () => {
        const record = await this.database.db
          .collection<ResumeRecord>('resumes')
          .findOne({ _id: id, ownerId }, { session });
        if (!record) throw new NotFoundException('Resume not found');
        if (record.revision !== revision)
          throw new ConflictException('Resume changed; reload before deleting');
        await this.database.db
          .collection<ResumeRecord>('resumes')
          .deleteOne({ _id: id, ownerId, revision }, { session });
        for (const name of [
          'resumePii',
          'variants',
          'workflowActivities',
          'parseJobs',
        ]) {
          await this.database.db
            .collection(name)
            .deleteMany({ ownerId, resumeId: id }, { session });
        }
      });
      return { deleted: true };
    } finally {
      await session.endSession();
    }
  }
  async update(
    ownerId: string,
    id: string,
    revision: number,
    data: ResumeData,
  ) {
    const record = await this.database.db
      .collection<ResumeRecord>('resumes')
      .findOneAndUpdate(
        { _id: id, ownerId, revision },
        { $set: { data, updatedAt: new Date() }, $inc: { revision: 1 } },
        { returnDocument: 'after' },
      );
    if (!record) {
      await this.get(ownerId, id);
      throw new ConflictException('Resume changed; reload before saving');
    }
    return record;
  }
  // Caller validates schema and PII before entering this atomic acceptance boundary.
  async accept(record: ResumeRecord, jobId: string, jobRevision: number) {
    const session = this.database.client.startSession();
    try {
      await session.withTransaction(async () => {
        const existing = await this.database.db
          .collection<ResumeRecord>('resumes')
          .findOne({ _id: record._id, ownerId: record.ownerId }, { session });
        if (existing) return; // Duplicate completion never overwrites user edits.
        const deleted = await this.database.db
          .collection<{
            _id: string;
            ownerId: string;
            revision: number;
            expiresAt: Date;
          }>('parseJobs')
          .deleteOne(
            {
              _id: jobId,
              ownerId: record.ownerId,
              revision: jobRevision,
              expiresAt: { $gt: new Date() },
            },
            { session },
          );
        if (deleted.deletedCount !== 1)
          throw new ConflictException('Parsing job changed or expired');
        await this.database.db
          .collection<PiiRecord>('resumePii')
          .updateOne(
            { ownerId: record.ownerId, resumeId: record._id },
            { $unset: { expiresAt: '' } },
            { session },
          );
        await this.database.db
          .collection<ResumeRecord>('resumes')
          .insertOne({ ...record, workflowId: jobId }, { session });
      });
    } finally {
      await session.endSession();
    }
  }
}
