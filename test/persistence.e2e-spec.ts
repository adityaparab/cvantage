import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AppConfig } from '../src/config/app-config';
import { DatabaseService } from '../src/database/database.service';
import { SchemaRepository } from '../src/database/schema.repository';
import { ResumeRepository } from '../src/database/resume.repository';
import { BASE_RESUME_SCHEMA } from '../src/contracts/resume-schema';
import type { ResumeRecord } from '../src/database/records';

describe('MongoDB persistence boundaries', () => {
  let database: DatabaseService;
  let schemas: SchemaRepository;
  let resumes: ResumeRepository;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ConfigService,
        AppConfig,
        DatabaseService,
        SchemaRepository,
        ResumeRepository,
      ],
    }).compile();
    database = module.get(DatabaseService);
    schemas = module.get(SchemaRepository);
    resumes = module.get(ResumeRepository);
    await database.onModuleInit();
  });
  afterAll(async () => {
    await database?.onModuleDestroy();
  });
  it('enforces unique users', async () => {
    await database.db
      .collection('users')
      .insertOne({ email: 'synthetic@example.test' });
    await expect(
      database.db
        .collection('users')
        .insertOne({ email: 'synthetic@example.test' }),
    ).rejects.toMatchObject({ code: 11000 });
  });
  it('publishes immutable schema versions and resolves concurrent writes atomically', async () => {
    const first = await schemas.publish(BASE_RESUME_SCHEMA, 0);
    expect(first.version).toBe(1);
    expect((await schemas.publish(BASE_RESUME_SCHEMA, 1)).version).toBe(1);
    const next = structuredClone(BASE_RESUME_SCHEMA);
    next.properties!.education = { type: 'array', items: { type: 'string' } };
    const race = await Promise.allSettled([
      schemas.publish(next, 1),
      schemas.publish(next, 1),
    ]);
    expect(race.filter((result) => result.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect((await schemas.latest())?.version).toBe(2);
    expect((await schemas.get(1))?.definition).toEqual(BASE_RESUME_SCHEMA);
  });
  it('isolates owners, prevents lost edits, and atomically deletes temporary parsing data on acceptance', async () => {
    const ownerId = randomUUID();
    const jobId = randomUUID();
    const record: ResumeRecord = {
      _id: randomUUID(),
      ownerId,
      schemaVersion: 1,
      revision: 0,
      acceptanceSource: 'judge',
      data: {
        basics: {},
        professionalSummary: '',
        workExperience: [],
        skills: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await database.db.collection<{ _id: string }>('parseJobs').insertOne({
      _id: jobId,
      ownerId,
      revision: 0,
      expiresAt: new Date(Date.now() + 60000),
      source: 'synthetic redacted source',
    } as { _id: string });
    await resumes.accept(record, jobId, 0);
    expect(
      await database.db
        .collection<{ _id: string }>('parseJobs')
        .findOne({ _id: jobId }),
    ).toBeNull();
    await expect(resumes.get('another-owner', record._id)).rejects.toThrow(
      'Resume not found',
    );
    await resumes.update(ownerId, record._id, 0, {
      ...record.data,
      professionalSummary: 'User correction',
    });
    await expect(
      resumes.update(ownerId, record._id, 0, record.data),
    ).rejects.toThrow('Resume changed');
    await resumes.accept(record, jobId, 0);
    expect(
      (await resumes.get(ownerId, record._id)).data.professionalSummary,
    ).toBe('User correction');
    expect((await resumes.get(ownerId, record._id)).schemaVersion).toBe(1);
  });
});
