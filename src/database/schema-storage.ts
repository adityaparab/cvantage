import { ConflictException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Db, MongoClient } from 'mongodb';
import type { SchemaRecord } from './records';
import {
  BASE_RESUME_SCHEMA,
  canonical,
  parseResumeSchema,
  preservesFields,
} from '../contracts/resume-schema';
import type { ResumeSchema } from '../contracts/resume-schema';
import { includeBaseFields } from '../contracts/schema-additions';
import { StartupError } from '../startup-error';
const hashOf = (schema: ResumeSchema) =>
  createHash('sha256').update(canonical(schema)).digest('hex');

export async function writeSchema(
  client: MongoClient,
  db: Db,
  change:
    { definition: ResumeSchema; expectedVersion: number } | { seed: true },
): Promise<SchemaRecord> {
  const session = client.startSession();
  try {
    return await session.withTransaction(async () => {
      const registry = db.collection<{
        _id: string;
        version: number;
        seedHash?: string;
      }>('schemaRegistry');
      const versions = db.collection<SchemaRecord>('schemaVersions');
      const current = await registry.findOne({ _id: 'global' }, { session });
      if (!current) throw new Error('Schema registry unavailable');
      const previous = current.version
        ? await versions.findOne({ version: current.version }, { session })
        : null;
      if (current.version && !previous)
        throw new Error('Schema registry points to a missing version');
      const seeded = 'seed' in change;
      const seedHash = hashOf(BASE_RESUME_SCHEMA);
      if (seeded && previous && current.seedHash === seedHash) return previous;
      if (!seeded && current.version !== change.expectedVersion)
        throw new ConflictException(
          'Schema version changed; revalidate additions',
        );
      const definition = seeded
        ? previous
          ? includeBaseFields(previous.definition, BASE_RESUME_SCHEMA)
          : structuredClone(BASE_RESUME_SCHEMA)
        : change.definition;
      if (
        !seeded &&
        previous &&
        !preservesFields(previous.definition, definition)
      )
        throw new ConflictException(
          'Existing schema fields and constraints must be preserved',
        );
      const hash = hashOf(definition);
      const record: SchemaRecord =
        previous?.hash === hash
          ? previous
          : {
              _id: randomUUID(),
              version: current.version + 1,
              definition,
              hash,
              createdAt: new Date(),
            };
      if (record !== previous) await versions.insertOne(record, { session });
      await registry.updateOne(
        { _id: 'global', version: current.version },
        {
          $set: { version: record.version, ...(seeded ? { seedHash } : {}) },
        },
        { session },
      );
      return record;
    });
  } finally {
    await session.endSession();
  }
}
export async function seedBaseSchema(client: MongoClient, db: Db) {
  try {
    return await writeSchema(client, db, { seed: true });
  } catch {
    throw new StartupError(
      'Resume schema initialization failed. Check schema/schema.json and compatibility with the existing schema registry; existing resume versions were preserved.',
    );
  }
}
export function publishSchema(
  client: MongoClient,
  db: Db,
  input: unknown,
  expectedVersion: number,
) {
  return writeSchema(client, db, {
    definition: parseResumeSchema(input),
    expectedVersion,
  });
}
