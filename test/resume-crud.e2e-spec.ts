import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { z } from 'zod';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { ResumeRepository } from '../src/database/resume.repository';
import { TailoringService } from '../src/tailoring/tailoring.service';
import { ModelGateway } from '../src/adapters/ports';
import type { Variant } from '../src/tailoring/tailoring.service';
import type { ResumeRecord } from '../src/database/records';
const auth = z.object({ id: z.string(), csrfToken: z.string() });
describe('resume resource deletion', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  const generate = jest.fn<
    ReturnType<ModelGateway['generate']>,
    Parameters<ModelGateway['generate']>
  >();
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ModelGateway)
      .useValue({ generate })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    database = app.get(DatabaseService);
  });
  beforeEach(() => {
    generate.mockReset();
  });
  afterAll(async () => {
    await app.close();
  });
  async function seed(ownerId: string) {
    const record: ResumeRecord = {
      _id: randomUUID(),
      ownerId,
      revision: 0,
      schemaVersion: 1,
      acceptanceSource: 'user',
      data: { basics: { summary: 'Software engineer' } },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await database.db.collection<ResumeRecord>('resumes').insertOne(record);
    await database.db.collection('resumePii').insertOne({
      ownerId,
      resumeId: record._id,
      name: '',
      email: '',
      contactNumber: '',
      location: '',
      revision: 0,
    });
    return record;
  }
  it('requires ownership, CSRF and the current revision; deletes related records only', async () => {
    const agent = request.agent(app.getHttpServer());
    const account = auth.parse(
      (
        await agent
          .post('/api/auth/register')
          .set('X-Requested-With', 'CVantage')
          .send({
            email: `${randomUUID()}@example.test`,
            password: 'synthetic-password-123',
          })
          .expect(201)
      ).body,
    );
    const target = await seed(account.id);
    await agent
      .post(`/api/resumes/${target._id}/job-description`)
      .send({ url: 'https://example.com' })
      .expect(403);
    await agent
      .post(`/api/resumes/${target._id}/job-description`)
      .set('X-CSRF-Token', account.csrfToken)
      .send({ url: 'https://127.0.0.1/private' })
      .expect(400);
    expect(generate).not.toHaveBeenCalled();

    const sibling = await seed(account.id);
    const other = await seed('other-owner');
    for (const name of ['variants', 'workflowActivities', 'parseJobs']) {
      await database.db.collection(name).insertMany([
        { ownerId: account.id, resumeId: target._id },
        { ownerId: account.id, resumeId: sibling._id },
      ]);
    }
    await agent
      .delete(`/api/resumes/${target._id}`)
      .send({ revision: 0 })
      .expect(403);
    const remove = (id: string, revision: number) =>
      agent
        .delete(`/api/resumes/${id}`)
        .set('X-CSRF-Token', account.csrfToken)
        .send({ revision });
    await remove(other._id, 0).expect(404);
    await remove(target._id, 1).expect(409);
    await remove(target._id, 0).expect(200);
    await agent.get(`/api/resumes/${target._id}`).expect(404);
    await agent.get(`/api/resumes/${sibling._id}`).expect(200);
    for (const name of [
      'resumePii',
      'variants',
      'workflowActivities',
      'parseJobs',
    ]) {
      expect(
        await database.db
          .collection(name)
          .countDocuments({ ownerId: account.id, resumeId: target._id }),
      ).toBe(0);
      expect(
        await database.db
          .collection(name)
          .countDocuments({ ownerId: account.id, resumeId: sibling._id }),
      ).toBe(1);
    }
  });
  it('does not recreate variants when a resume is deleted during model generation', async () => {
    const resume = await seed(randomUUID());
    let release!: (result: unknown) => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    generate
      .mockResolvedValueOnce({ summary: 'Engineer experience', findings: [] })
      .mockResolvedValueOnce({ summary: 'Software role', findings: [] })
      .mockImplementationOnce(() => {
        started();
        return new Promise((resolve) => {
          release = resolve;
        });
      })
      .mockResolvedValueOnce({
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
      });
    const result = app
      .get(TailoringService)
      .create(resume.ownerId, resume._id, {
        revision: 0,
        jobDescription: 'Seeking a software engineer for internal tools.',
        piiConfirmed: true,
      });
    const rejected = expect(result).rejects.toThrow('deleted');
    await ready;
    await app.get(ResumeRepository).delete(resume.ownerId, resume._id, 0);
    release(resume.data);
    await rejected;
    expect(
      await database.db
        .collection('variants')
        .countDocuments({ resumeId: resume._id }),
    ).toBe(0);
  });
  it('rejects malformed or identifying analysis before generating a proposal', async () => {
    const resume = await seed(randomUUID());
    for (const result of [
      { summary: '', findings: [] },
      { summary: 'Contact private@example.test', findings: [] },
    ]) {
      generate.mockReset().mockResolvedValueOnce(result);
      await expect(
        app.get(TailoringService).create(resume.ownerId, resume._id, {
          revision: 0,
          jobDescription: 'Seeking a software engineer for internal tools.',
          piiConfirmed: true,
        }),
      ).rejects.toThrow('Analysis could not be validated');
      expect(generate).toHaveBeenCalledTimes(1);
      expect(
        await database.db
          .collection('variants')
          .countDocuments({ resumeId: resume._id }),
      ).toBe(0);
    }
  });
  it('persists a subset of suggestions, preserves proposals and rejects stale/foreign selections', async () => {
    const resume = await seed(randomUUID());
    const source = {
      basics: { summary: 'Engineer building tools' },
      work: [{ name: 'Example', highlights: ['Built internal tools'] }],
    };
    await database.db
      .collection<ResumeRecord>('resumes')
      .updateOne({ _id: resume._id }, { $set: { data: source } });
    const proposal = {
      ...source,
      basics: { summary: 'Software engineer focused on tools' },
      work: [{ name: 'Example', highlights: ['Delivered internal tools'] }],
    };
    const id = randomUUID();
    await database.db.collection<Variant>('variants').insertOne({
      _id: id,
      ownerId: resume.ownerId,
      resumeId: resume._id,
      sourceRevision: 0,
      schemaVersion: 1,
      sourceData: source,
      data: proposal,
      revision: 0,
      status: 'review_required',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const tailoring = app.get(TailoringService);
    await expect(
      tailoring.apply('another-owner', resume._id, id, {
        revision: 0,
        suggestionIds: [],
      }),
    ).rejects.toThrow();
    await expect(
      tailoring.apply(resume.ownerId, resume._id, id, {
        revision: 0,
        suggestionIds: ['/work/0/name'],
      }),
    ).rejects.toThrow('valid suggestions');
    const selected = await tailoring.apply(resume.ownerId, resume._id, id, {
      revision: 0,
      suggestionIds: ['/basics/summary'],
    });
    expect(selected.data).toEqual({ ...source, basics: proposal.basics });
    expect(selected.proposalData).toEqual(proposal);
    expect(
      (await tailoring.get(resume.ownerId, resume._id, id)).suggestions,
    ).toHaveLength(2);
    await expect(
      tailoring.apply(resume.ownerId, resume._id, id, {
        revision: 0,
        suggestionIds: [],
      }),
    ).rejects.toThrow('changed');
    const cleared = await tailoring.apply(resume.ownerId, resume._id, id, {
      revision: 1,
      suggestionIds: [],
    });
    expect(cleared.data).toEqual(source);
    expect(cleared.appliedSuggestionIds).toEqual([]);
    expect(cleared.status).toBe('review_required');
    expect(
      (await app.get(ResumeRepository).get(resume.ownerId, resume._id)).data,
    ).toEqual(source);
  });
});
