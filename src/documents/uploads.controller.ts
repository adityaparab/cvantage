import { z } from 'zod';
import { ConflictException } from '@nestjs/common';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { SessionGuard } from '../auth/session.guard';
import type { AuthRequest } from '../auth/session.guard';
import { DatabaseService } from '../database/database.service';
import {
  documentExtension,
  LocalDocumentExtractor,
} from './document-extractor';
import { piiSchema, redactPii } from './pii';
import {
  MAX_UPLOAD_BYTES,
  REVIEW_RETENTION_DAYS,
} from '../contracts/resume-schema';
import type { PiiRecord, ParseJob } from '../database/records';
import { NotFoundException } from '@nestjs/common';
@Controller()
@UseGuards(SessionGuard)
export class UploadsController {
  constructor(
    private readonly extractor: LocalDocumentExtractor,
    private readonly database: DatabaseService,
  ) {}
  @Post('resumes/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_UPLOAD_BYTES + 1,
        files: 1,
        fields: 1,
        fieldSize: 4096,
        parts: 3,
      },
    }),
  )
  async upload(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('pii') rawPii: string,
  ) {
    if (!file) throw new BadRequestException('Choose a resume file');
    let input: unknown;
    try {
      input = JSON.parse(rawPii) as unknown;
    } catch {
      throw new BadRequestException('Provide your contact details');
    }
    const parsed = piiSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException('Contact details are invalid');
    const extension = documentExtension(file.originalname, file.buffer);
    const abort = new AbortController();
    const onClose = () => abort.abort();
    response.once('close', onClose);
    let source: string;
    try {
      source = redactPii(
        await this.extractor.extract(file.buffer, extension, abort.signal),
        parsed.data,
      );
    } finally {
      file.buffer.fill(0);
      response.removeListener('close', onClose);
    }
    const resumeId = randomUUID();
    const jobId = randomUUID();
    const ownerId = request.session.ownerId;
    const pii: PiiRecord = {
      _id: randomUUID(),
      ownerId,
      resumeId,
      ...parsed.data,
      revision: 0,
    };
    const job: ParseJob = {
      _id: jobId,
      ownerId,
      resumeId,
      source,
      status: 'review_required',
      stage: 'schema',
      schemaIterations: 0,
      mappingIterations: 0,
      revision: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + REVIEW_RETENTION_DAYS * 86400000),
    };
    const session = this.database.client.startSession();
    try {
      await session.withTransaction(async () => {
        await this.database.db
          .collection<PiiRecord>('resumePii')
          .insertOne(pii, { session });
        await this.database.db
          .collection<ParseJob>('parseJobs')
          .insertOne(job, { session });
      });
    } finally {
      await session.endSession();
    }
    return { jobId, resumeId, source, status: job.status, revision: 0 };
  }
  @Post('parsing-jobs/:id/prepare')
  async prepare(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({
        source: z.string().trim().min(1).max(1_000_000),
        revision: z.number().int().min(0),
        confirmed: z.literal(true),
      })
      .strict()
      .safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Confirm the redacted text before continuing',
      );
    const job = await this.job(request, id);
    if (
      job.schemaIterations !== 0 ||
      job.mappingIterations !== 0 ||
      job.piiConfirmed
    )
      throw new ConflictException('Parsing has already started');
    const pii = await this.database.db
      .collection<PiiRecord>('resumePii')
      .findOne({ ownerId: request.session.ownerId, resumeId: job.resumeId });
    if (!pii) throw new BadRequestException('Contact details missing');
    const result = await this.database.db
      .collection<ParseJob>('parseJobs')
      .findOneAndUpdate(
        {
          _id: id,
          ownerId: request.session.ownerId,
          revision: parsed.data.revision,
          piiConfirmed: { $ne: true },
          expiresAt: { $gt: new Date() },
        },
        {
          $set: {
            source: redactPii(
              parsed.data.source,
              piiSchema.parse({
                name: pii.name,
                contactNumber: pii.contactNumber,
                email: pii.email,
                location: pii.location,
              }),
            ),
            piiConfirmed: true,
            status: 'queued',
          },
          $inc: { revision: 1 },
        },
        { returnDocument: 'after' },
      );
    if (!result)
      throw new ConflictException('Review changed; reload before confirming');
    return result;
  }
  @Post('parsing-jobs/:id/cancel')
  async cancel(@Req() request: AuthRequest, @Param('id') id: string) {
    const deleted = await this.database.db
      .collection<ParseJob>('parseJobs')
      .deleteOne({ _id: id, ownerId: request.session.ownerId });
    if (!deleted.deletedCount)
      throw new NotFoundException('Parsing job not found');
    return { cancelled: true };
  }
  @Get('parsing-jobs') list(@Req() request: AuthRequest) {
    return this.database.db
      .collection<ParseJob>('parseJobs')
      .find(
        { ownerId: request.session.ownerId, expiresAt: { $gt: new Date() } },
        {
          projection: {
            source: 0,
            candidate: 0,
            judge: 0,
            leaseToken: 0,
            leaseUntil: 0,
          },
        },
      )
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
  }
  @Get('parsing-jobs/:id') async job(
    @Req() request: AuthRequest,
    @Param('id') id: string,
  ) {
    const job = await this.database.db
      .collection<ParseJob>('parseJobs')
      .findOne({
        _id: id,
        ownerId: request.session.ownerId,
        expiresAt: { $gt: new Date() },
      });
    if (!job)
      throw new NotFoundException(
        'Parsing job expired or not found; upload again',
      );
    return job;
  }
}
