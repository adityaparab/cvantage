import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { randomUUID } from 'node:crypto';
import { ModelGateway } from '../adapters/ports';
import { AppConfig } from '../config/app-config';
import { DatabaseService } from '../database/database.service';
import { SchemaRepository } from '../database/schema.repository';
import { ResumeRepository } from '../database/resume.repository';
import type { ParseJob, PiiRecord } from '../database/records';
import {
  BASE_RESUME_SCHEMA,
  MAX_STAGE_ITERATIONS,
  parseResumeSchema,
  preservesFields,
  validateResumeData,
} from '../contracts/resume-schema';
import type { ResumeSchema } from '../contracts/resume-schema';
import { acceptsJudge, judgeSchema } from '../contracts/workflow';
import { containsPii } from '../documents/pii';
import { JUDGE_PROMPT, MAPPING_PROMPT, SCHEMA_PROMPT } from '../ai/prompts';

const State = Annotation.Root({
  candidate: Annotation<unknown>(),
  judge: Annotation<unknown>(),
  valid: Annotation<boolean>(),
});

@Injectable()
export class ParsingService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running?: Promise<boolean>;
  private readonly logger = new Logger(ParsingService.name);
  constructor(
    private readonly database: DatabaseService,
    private readonly schemas: SchemaRepository,
    private readonly resumes: ResumeRepository,
    private readonly models: ModelGateway,
    private readonly config: AppConfig,
  ) {}
  private get jobs() {
    return this.database.db.collection<ParseJob>('parseJobs');
  }
  onModuleInit() {
    if (this.config.values.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      if (!this.running)
        this.running = this.runNext()
          .catch(() => {
            this.logger.error('PARSING_STORAGE_FAILURE');
            return false;
          })
          .finally(() => {
            this.running = undefined;
          });
    }, 1000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.running;
  }
  async runNext(): Promise<boolean> {
    const now = new Date();
    const job = await this.jobs.findOneAndUpdate(
      {
        piiConfirmed: true,
        status: { $in: ['queued', 'schema', 'mapping'] },
        expiresAt: { $gt: now },
        $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now } }],
      },
      {
        $set: {
          leaseToken: randomUUID(),
          leaseUntil: new Date(Date.now() + 180_000),
        },
        $inc: { revision: 1 },
      },
      { returnDocument: 'after', sort: { createdAt: 1 } },
    );
    if (!job) return false;
    try {
      await this.runAttempt(job);
    } catch {
      await this.jobs.updateOne(
        {
          _id: job._id,
          leaseToken: job.leaseToken,
          revision: job.revision,
          expiresAt: { $gt: new Date() },
        },
        {
          $set: {
            status: 'failed',
            failureCode: 'MODEL_OR_PROCESSING_FAILED',
            leaseUntil: new Date(0),
          },
          $inc: { revision: 1 },
        },
      );
    }
    return true;
  }
  private async patch(job: ParseJob, changes: Partial<ParseJob>) {
    const result = await this.jobs.findOneAndUpdate(
      {
        _id: job._id,
        leaseToken: job.leaseToken,
        revision: job.revision,
        expiresAt: { $gt: new Date() },
      },
      { $set: changes, $inc: { revision: 1 } },
      { returnDocument: 'after' },
    );
    if (!result) throw new ConflictException('Job changed or expired');
    Object.assign(job, result);
    return result;
  }
  private async checkpoint(job: ParseJob, changes: Partial<ParseJob>) {
    await this.patch(job, { ...changes, leaseUntil: new Date(0) });
  }
  private async runAttempt(job: ParseJob) {
    const counter =
      job.stage === 'schema' ? 'schemaIterations' : 'mappingIterations';
    if (job[counter] >= MAX_STAGE_ITERATIONS) {
      await this.checkpoint(job, {
        status: 'review_required',
        failureCode: 'ITERATIONS_EXHAUSTED',
      });
      return;
    }
    const pii = await this.resumes.getPii(job.ownerId, job.resumeId);
    if (!pii || containsPii(job.source, pii)) throw new Error('PII_BOUNDARY');
    const current =
      job.stage === 'schema'
        ? await this.schemas.latest()
        : await this.schemas.get(job.schemaVersion ?? 0);
    const schema = current?.definition ?? BASE_RESUME_SCHEMA;
    await this.patch(job, {
      [counter]: job[counter] + 1,
      status: job.stage,
      failureCode: undefined,
    });
    // MongoDB reserves each attempt BEFORE calls. Interrupted attempts are consumed,
    // never replayed; this snapshot is the durable recovery boundary for the graph.
    const graph = new StateGraph(State)
      .addNode('worker', async () => {
        const candidate = await this.models.generate(
          'worker',
          job.stage === 'schema' ? SCHEMA_PROMPT : MAPPING_PROMPT,
          {
            source: job.source,
            latestSchema: schema,
            schema,
            feedback: job.judge ?? job.failureCode ?? null,
          },
        );
        if (containsPii(candidate, pii))
          return { candidate: null, valid: false };
        const valid = this.validCandidate(job, candidate, schema);
        await this.patch(job, { candidate });
        return { candidate, valid };
      })
      .addNode('evaluate', async (state) => {
        if (state.candidate === null) return { judge: null };
        const judge = await this.models.generate('judge', JUDGE_PROMPT, {
          stage: job.stage,
          source: job.source,
          schema,
          latestSchema: schema,
          candidate: state.candidate,
        });
        const parsed = judgeSchema.safeParse(judge);
        if (!parsed.success || containsPii(judge, pii)) return { judge: null };
        await this.patch(job, { judge: parsed.data });
        return { judge: parsed.data };
      })
      .addNode('decide', async (state) => {
        if (
          acceptsJudge(state.judge, job.stage, {
            structureValid: state.valid,
            piiAbsent: state.candidate !== null,
          })
        ) {
          await this.accept(job, state.candidate, current?.version ?? 0, pii);
        } else {
          await this.checkpoint(job, {
            status:
              job[counter] >= MAX_STAGE_ITERATIONS
                ? 'review_required'
                : 'queued',
            failureCode: state.valid
              ? 'JUDGE_REVISION_REQUIRED'
              : 'INVALID_OR_PERSONAL_OUTPUT',
            candidate: state.candidate ?? undefined,
            judge: judgeSchema.safeParse(state.judge).data,
          });
        }
        return {};
      })
      .addEdge(START, 'worker')
      .addEdge('worker', 'evaluate')
      .addEdge('evaluate', 'decide')
      .addEdge('decide', END)
      .compile();
    await graph.invoke({}, { recursionLimit: 5, callbacks: [] });
  }
  private validCandidate(
    job: ParseJob,
    candidate: unknown,
    schema: ResumeSchema,
  ): boolean {
    try {
      return job.stage === 'schema'
        ? preservesFields(schema, parseResumeSchema(candidate))
        : validateResumeData(schema, candidate);
    } catch {
      return false;
    }
  }
  private async accept(
    job: ParseJob,
    candidate: unknown,
    baseVersion: number,
    pii: PiiRecord,
  ) {
    if (containsPii(candidate, pii)) throw new Error('PII_BOUNDARY');
    if (job.stage === 'schema') {
      try {
        const schema = await this.schemas.publish(candidate, baseVersion);
        await this.checkpoint(job, {
          stage: 'mapping',
          schemaVersion: schema.version,
          status: 'queued',
          candidate: undefined,
          judge: undefined,
        });
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
        await this.checkpoint(job, {
          status:
            job.schemaIterations >= MAX_STAGE_ITERATIONS
              ? 'review_required'
              : 'queued',
          failureCode: 'SCHEMA_CHANGED_REBASE_REQUIRED',
        });
      }
      return;
    }
    const schema = await this.schemas.get(job.schemaVersion!);
    if (!schema || !validateResumeData(schema.definition, candidate))
      throw new Error('INVALID_MAPPING');
    await this.resumes.accept(
      {
        _id: job.resumeId,
        ownerId: job.ownerId,
        schemaVersion: schema.version,
        data: candidate,
        revision: 0,
        acceptanceSource: 'judge',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      job._id,
      job.revision,
    );
  }
}
