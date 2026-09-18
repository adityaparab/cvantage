import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { DatabaseService } from '../database/database.service';
import { ResumeRepository } from '../database/resume.repository';
import { SchemaRepository } from '../database/schema.repository';
import type { ParseJob, PiiRecord, ResumeRecord } from '../database/records';
import { validateResumeData, editorSchema } from '../contracts/resume-schema';
import { reviewSchema } from '../contracts/workflow';
import { containsPii, piiSchema } from '../documents/pii';
import { publicJob } from '../parsing/job-view';
const editSchema = z
  .object({ revision: z.number().int().min(0), data: z.unknown() })
  .strict();
@Injectable()
export class EditingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly resumes: ResumeRepository,
    private readonly schemas: SchemaRepository,
  ) {}
  async update(ownerId: string, id: string, input: unknown) {
    const body = editSchema.safeParse(input);
    if (!body.success) throw new BadRequestException('Invalid edit');
    const record = await this.resumes.get(ownerId, id);
    const schema = await this.schemas.get(record.schemaVersion);
    const pii = await this.resumes.getPii(ownerId, id);
    if (
      !schema ||
      !pii ||
      !validateResumeData(schema.definition, body.data.data) ||
      containsPii(body.data.data, pii)
    )
      throw new BadRequestException(
        'Check field types and remove identifying details from resume fields',
      );
    return this.resumes.update(ownerId, id, body.data.revision, body.data.data);
  }
  async updatePii(ownerId: string, id: string, input: unknown) {
    const body = z
      .object({
        revision: z.number().int().min(0),
        resumeRevision: z.number().int().min(0),
        pii: piiSchema,
      })
      .strict()
      .safeParse(input);
    if (!body.success) throw new BadRequestException('Invalid contact details');
    const session = this.database.client.startSession();
    try {
      return await session.withTransaction(async () => {
        const resume = await this.database.db
          .collection<ResumeRecord>('resumes')
          .findOne({ _id: id, ownerId }, { session });
        if (!resume) throw new NotFoundException('Resume not found');
        if (resume.revision !== body.data.resumeRevision)
          throw new ConflictException(
            'Resume changed; reload before saving contact details',
          );
        if (containsPii(resume.data, body.data.pii))
          throw new BadRequestException(
            'Remove the new identifying details from resume fields before updating contact details',
          );
        const result = await this.database.db
          .collection<PiiRecord>('resumePii')
          .findOneAndUpdate(
            { ownerId, resumeId: id, revision: body.data.revision },
            { $set: body.data.pii, $inc: { revision: 1 } },
            { returnDocument: 'after', session },
          );
        if (!result)
          throw new ConflictException(
            'Contact details changed; reload before saving',
          );
        await this.database.db
          .collection<ResumeRecord>('resumes')
          .updateOne(
            { _id: id, ownerId, revision: resume.revision },
            { $inc: { revision: 1 }, $set: { updatedAt: new Date() } },
            { session },
          );
        return result;
      });
    } finally {
      await session.endSession();
    }
  }
  async review(ownerId: string, id: string) {
    const job = await this.database.db
      .collection<ParseJob>('parseJobs')
      .findOne(
        { _id: id, ownerId, expiresAt: { $gt: new Date() } },
        { projection: { leaseToken: 0, leaseUntil: 0 } },
      );
    if (!job) throw new NotFoundException('Review expired or not found');
    if (job.stage === 'schema') return { job: publicJob(job) };
    const schema = await this.schemas.get(job.schemaVersion ?? 0);
    if (!schema) throw new NotFoundException('Resume fields are unavailable');
    return { job: publicJob(job), schema: editorSchema(schema.definition) };
  }

  async approve(ownerId: string, id: string, input: unknown) {
    const body = reviewSchema.safeParse(input);
    if (!body.success || !body.data.approve)
      throw new BadRequestException('Review approval is required');
    const { job, schema } = await this.review(ownerId, id);
    if (
      job.revision !== body.data.revision ||
      job.stage !== body.data.stage ||
      !job.piiConfirmed ||
      !['review_required', 'failed'].includes(job.status)
    )
      throw new ConflictException(
        'Review changed or is still processing; reload',
      );
    const pii = await this.resumes.getPii(ownerId, job.resumeId);
    const candidate = body.data.candidate;
    if (!pii || containsPii(candidate, pii))
      throw new BadRequestException(
        'Remove identifying details before approval',
      );
    const pinned = await this.schemas.get(job.schemaVersion!);
    if (!schema || !pinned || !validateResumeData(pinned.definition, candidate))
      throw new BadRequestException('Check required fields and field types');
    await this.resumes.accept(
      {
        _id: job.resumeId,
        ownerId,
        schemaVersion: job.schemaVersion!,
        data: candidate,
        revision: 0,
        acceptanceSource: 'user',
        schemaAcceptanceSource: job.schemaApprovalSource ?? 'judge',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      id,
      job.revision,
    );
    return { resumeId: job.resumeId, status: 'accepted' };
  }
}
