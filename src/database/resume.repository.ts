import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ResumeData } from '../contracts/resume-schema';
import { DatabaseService } from './database.service';
import type { PiiRecord, ResumeRecord } from './records';

@Injectable()
export class ResumeRepository {
  constructor(private readonly database: DatabaseService) {}
  list(ownerId: string) {
    return this.database.db
      .collection<ResumeRecord>('resumes')
      .find({ ownerId })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();
  }
  async get(ownerId: string, id: string) {
    const record = await this.database.db
      .collection<ResumeRecord>('resumes')
      .findOne({ _id: id, ownerId });
    if (!record) throw new NotFoundException('Resume not found');
    return record;
  }
  getPii(ownerId: string, resumeId: string) {
    return this.database.db
      .collection<PiiRecord>('resumePii')
      .findOne({ ownerId, resumeId });
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
          .insertOne(record, { session });
      });
    } finally {
      await session.endSession();
    }
  }
}
