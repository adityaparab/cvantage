import { seedBaseSchema } from '../src/database/schema-storage';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { ModelGateway } from '../src/adapters/ports';
import { DatabaseService } from '../src/database/database.service';
import type {
  ParseJob,
  PiiRecord,
  ResumeRecord,
} from '../src/database/records';
import { AuthService } from '../src/auth/auth.service';
import { ActivityService } from '../src/activity/activity.service';
import { ParsingService } from '../src/parsing/parsing.service';
import { TailoringService } from '../src/tailoring/tailoring.service';
import { SchemaRepository } from '../src/database/schema.repository';
import { BASE_RESUME_SCHEMA } from '../src/contracts/resume-schema';
const data = {
  basics: { summary: 'Software engineer' },
  work: [],
  skills: [],
};
const assessment = {
  stage: 'mapping',
  verdict: 'accept',
  confidence: 0.95,
  checks: {
    structureValid: true,
    sourceCovered: true,
    sourceFaithful: true,
    piiAbsent: true,
  },
  issues: [],
};
describe('private streamed workflow activity', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let origin: string;
  const generate = jest.fn<
    Promise<unknown>,
    Parameters<ModelGateway['generate']>
  >();
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ModelGateway)
      .useValue({ generate })
      .compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
    database = app.get(DatabaseService);
  });
  async function clear() {
    for (const name of [
      'parseJobs',
      'schemaVersions',
      'resumes',
      'resumePii',
      'variants',
      'workflowActivities',
      'users',
      'sessions',
    ])
      await database.db.collection(name).deleteMany({});
    await database.db
      .collection<{ _id: string }>('schemaRegistry')
      .updateOne(
        { _id: 'global' },
        { $set: { version: 0 }, $unset: { seedHash: '' } },
      );
  }
  afterAll(async () => {
    await clear();
    await app.close();
  });
  beforeEach(async () => {
    await clear();
    await seedBaseSchema(database.client, database.db);
    generate.mockReset();
  });
  async function seed(ownerId = randomUUID()): Promise<ParseJob> {
    const job: ParseJob = {
      _id: randomUUID(),
      ownerId,
      resumeId: randomUUID(),
      source: 'Software engineer',
      stage: 'schema',
      status: 'queued',
      piiConfirmed: true,
      schemaIterations: 0,
      mappingIterations: 0,
      revision: 0,
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
    };
    await database.db.collection<ParseJob>('parseJobs').insertOne(job);
    await database.db.collection<PiiRecord>('resumePii').insertOne({
      _id: randomUUID(),
      ownerId,
      resumeId: job.resumeId,
      revision: 0,
      name: 'Synthetic Applicant',
      email: 'private@example.test',
      contactNumber: '',
      location: '',
    });
    return job;
  }
  it('scopes activity and SSE to the owner, hides internal content and closes a revoked session', async () => {
    const auth = app.get(AuthService);
    const user = await auth.register(
      `${randomUUID()}@example.test`,
      'synthetic-password-123',
    );
    const other = await auth.register(
      `${randomUUID()}@example.test`,
      'synthetic-password-123',
    );
    const job = await seed(user.session.ownerId);
    await database.db.collection<ParseJob>('parseJobs').updateOne(
      { _id: job._id },
      {
        $set: {
          candidate: { privateSchema: 'Do not expose' },
          activity: [
            {
              step: 'preparation_worker',
              attempt: 1,
              retries: 0,
              received: 20,
              status: 'success',
              output: 'Internal schema content',
              startedAt: new Date(),
            },
          ],
        },
      },
    );
    const headers = { Cookie: `cvantage_session=${user.token}` };
    expect((await fetch(`${origin}/workflows/${job._id}`)).status).toBe(401);
    expect(
      (
        await fetch(`${origin}/workflows/${job._id}/events`, {
          headers: { Cookie: `cvantage_session=${other.token}` },
        })
      ).status,
    ).toBe(404);
    const controller = new AbortController();
    const response = await fetch(`${origin}/workflows/${job._id}/events`, {
      headers,
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const reader = response.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    expect(first).toContain('preparation_worker');
    expect(first).not.toMatch(
      /Internal schema|privateSchema|Synthetic Applicant|leaseToken/,
    );
    await auth.logout(user.session._id);
    const closed = new TextDecoder().decode((await reader.read()).value);
    expect(closed).toContain('event: unavailable');
    controller.abort();
    await database.db
      .collection<ParseJob>('parseJobs')
      .deleteOne({ _id: job._id });
  });
  it('cancellation fences streaming updates without recreating the deleted job or retrying the model', async () => {
    const job = await seed();
    let release!: () => void;
    let started!: () => void;
    const pause = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    generate.mockImplementationOnce(
      async (_role, _instructions, _data, observe) => {
        await observe?.({ type: 'delta', text: '{"internal":"partial' });
        started();
        await pause;
        await observe?.({ type: 'retry', attempt: 1 });
        return BASE_RESUME_SCHEMA;
      },
    );
    const processing = app.get(ParsingService).runNext();
    await ready;
    await database.db
      .collection<ParseJob>('parseJobs')
      .deleteOne({ _id: job._id });
    release();
    await processing;
    expect(generate).toHaveBeenCalledTimes(1);
    expect(
      await database.db
        .collection<ParseJob>('parseJobs')
        .findOne({ _id: job._id }),
    ).toBeNull();
  });
  it('marks a reclaimed final attempt as interrupted without restarting its budget', async () => {
    const job = await seed();
    await database.db.collection<ParseJob>('parseJobs').updateOne(
      { _id: job._id },
      {
        $set: {
          status: 'schema',
          schemaIterations: 1,
          leaseUntil: new Date(0),
          activity: [
            {
              step: 'preparation_worker',
              attempt: 1,
              status: 'active',
              retries: 0,
              received: 10,
              output: '',
              startedAt: new Date(),
            },
          ],
        },
      },
    );
    await app.get(ParsingService).runNext();
    const activity = await app.get(ActivityService).get(job.ownerId, job._id);
    expect(activity.status).toBe('failed');
    expect(activity.steps[0]).toMatchObject({
      status: 'failure',
      outcome: 'interrupted',
      attempt: 1,
    });
    expect(generate).not.toHaveBeenCalled();
    await database.db
      .collection<ParseJob>('parseJobs')
      .deleteOne({ _id: job._id });
  });
  it('tracks asynchronous tailoring and deletes streamed drafts on approval', async () => {
    const job = await seed();
    await database.db
      .collection<ParseJob>('parseJobs')
      .deleteOne({ _id: job._id });
    const schemas = app.get(SchemaRepository);
    const latest = await schemas.latest();
    const schema = latest ?? (await schemas.publish(BASE_RESUME_SCHEMA, 0));
    await database.db.collection<ResumeRecord>('resumes').insertOne({
      _id: job.resumeId,
      ownerId: job.ownerId,
      schemaVersion: schema.version,
      data,
      revision: 0,
      acceptanceSource: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    generate
      .mockImplementationOnce(async (_role, _instructions, _data, observe) => {
        await observe?.({ type: 'delta', text: JSON.stringify(data) });
        return data;
      })
      .mockResolvedValueOnce(assessment);
    const tailoring = app.get(TailoringService);
    const started = await tailoring.start(job.ownerId, job.resumeId, {
      revision: 0,
      jobDescription: 'Seeking an experienced software engineer.',
      piiConfirmed: true,
    });
    const activities = app.get(ActivityService);
    let activity = await activities.get(job.ownerId, started.workflowId);
    for (let i = 0; i < 100 && activity.status === 'running'; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      activity = await activities.get(job.ownerId, started.workflowId);
    }
    expect(activity.status).toBe('review_required');
    expect(activity.steps[0]).toMatchObject({
      status: 'success',
      output: 'Software engineer',
    });
    await expect(
      activities.get('another-owner', started.workflowId),
    ).rejects.toThrow('deleted or expired');
    await tailoring.update(job.ownerId, job.resumeId, activity.variantId!, {
      revision: 0,
      data,
      approve: true,
    });
    expect(
      await database.db
        .collection('workflowActivities')
        .countDocuments({ ownerId: job.ownerId }),
    ).toBe(0);
    expect((await activities.get(job.ownerId, started.workflowId)).status).toBe(
      'completed',
    );
  });
});
