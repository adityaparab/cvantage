import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppConfig } from '../src/config/app-config';
import { DatabaseService } from '../src/database/database.service';
import { SchemaRepository } from '../src/database/schema.repository';
import { seedBaseSchema } from '../src/database/schema-storage';
import { BASE_RESUME_SCHEMA } from '../src/contracts/resume-schema';
import { LEGACY_RESUME_SCHEMA } from './fixtures/legacy-schema';
import type { ResumeRecord } from '../src/database/records';

describe('repository resume-schema seeding', () => {
  let database: DatabaseService;
  let schemas: SchemaRepository;
  beforeEach(async () => {
    const config = new AppConfig(
      new ConfigService({
        ...process.env,
        MONGODB_DATABASE: `cvantage_seed_${randomUUID().replaceAll('-', '')}`,
      }),
    );
    database = new DatabaseService(config);
    schemas = new SchemaRepository(database);
    await database.onModuleInit();
  });
  afterEach(async () => {
    await database.db.dropDatabase();
    await database.onModuleDestroy();
  });
  it('seeds the exact file on startup and repeated/concurrent startup creates no duplicate version', async () => {
    expect((await schemas.latest())?.definition).toEqual(
      JSON.parse(
        readFileSync(resolve(__dirname, '../schema/schema.json'), 'utf8'),
      ),
    );
    await Promise.all([
      seedBaseSchema(database.client, database.db),
      seedBaseSchema(database.client, database.db),
    ]);
    expect(
      await database.db.collection('schemaVersions').countDocuments(),
    ).toBe(1);
    await database.db.collection('schemaVersions').deleteMany({});
    await database.db
      .collection<{ _id: string }>('schemaRegistry')
      .updateOne(
        { _id: 'global' },
        { $set: { version: 0 }, $unset: { seedHash: '' } },
      );
    const results = await Promise.all([
      seedBaseSchema(database.client, database.db),
      seedBaseSchema(database.client, database.db),
    ]);
    expect(results.map((record) => record.version)).toEqual([1, 1]);
    expect(
      await database.db.collection('schemaVersions').countDocuments(),
    ).toBe(1);
  });
  it('retains approved additions on later startups and rejects removed or changed baseline fields', async () => {
    const added = structuredClone(BASE_RESUME_SCHEMA);
    added.properties!.work.items!.properties!.teamSize = { type: 'number' };
    await schemas.publish(added, 1);
    await seedBaseSchema(database.client, database.db);
    expect((await schemas.latest())?.version).toBe(2);
    expect((await schemas.latest())?.definition).toEqual(added);
    await expect(schemas.publish(BASE_RESUME_SCHEMA, 2)).rejects.toThrow(
      'preserved',
    );
    const changed = structuredClone(added);
    changed.properties!.work.items!.properties!.startDate = { type: 'number' };
    await expect(schemas.publish(changed, 2)).rejects.toThrow('preserved');
    expect((await schemas.get(1))?.definition).toEqual(BASE_RESUME_SCHEMA);
  });
  it('adds baseline fields to a pre-existing registry without rewriting old resumes or removing older fields', async () => {
    await database.db.collection('schemaVersions').deleteMany({});
    await database.db
      .collection<{ _id: string }>('schemaRegistry')
      .updateOne(
        { _id: 'global' },
        { $set: { version: 0 }, $unset: { seedHash: '' } },
      );
    const historical = await schemas.publish(LEGACY_RESUME_SCHEMA, 0);
    const record: ResumeRecord = {
      _id: randomUUID(),
      ownerId: 'synthetic-owner',
      schemaVersion: historical.version,
      revision: 4,
      data: {
        basics: {},
        professionalSummary: 'User correction',
        workExperience: [],
        skills: [],
      },
      acceptanceSource: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await database.db.collection<ResumeRecord>('resumes').insertOne(record);
    const seeded = await seedBaseSchema(database.client, database.db);
    expect(seeded.version).toBe(2);
    expect(seeded.definition.properties).toHaveProperty('projects');
    expect(seeded.definition.properties).toHaveProperty('workExperience');
    expect((await schemas.get(1))?.definition).toEqual(LEGACY_RESUME_SCHEMA);
    expect(
      await database.db
        .collection<ResumeRecord>('resumes')
        .findOne({ _id: record._id }),
    ).toEqual(record);
  });
  it('fails safely on incompatible legacy field types without changing the registry', async () => {
    await database.db.collection('schemaVersions').deleteMany({});
    await database.db
      .collection<{ _id: string }>('schemaRegistry')
      .updateOne(
        { _id: 'global' },
        { $set: { version: 0 }, $unset: { seedHash: '' } },
      );
    const incompatible = structuredClone(LEGACY_RESUME_SCHEMA);
    incompatible.properties!.education = { type: 'string' };
    await schemas.publish(incompatible, 0);
    await expect(seedBaseSchema(database.client, database.db)).rejects.toThrow(
      'compatibility',
    );
    expect((await schemas.latest())?.definition).toEqual(incompatible);
    expect(
      await database.db.collection('schemaVersions').countDocuments(),
    ).toBe(1);
  });
});
