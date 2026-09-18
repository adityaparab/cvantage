import { ConflictException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseService } from './database.service';
import type { SchemaRecord } from './records';
import { parseResumeSchema, preservesFields } from '../contracts/resume-schema';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  return JSON.stringify(value);
}
@Injectable()
export class SchemaRepository {
  constructor(private readonly database: DatabaseService) {}
  get(version: number) {
    return this.database.db
      .collection<SchemaRecord>('schemaVersions')
      .findOne({ version });
  }
  async latest() {
    const registry = await this.database.db
      .collection<{ _id: string; version: number }>('schemaRegistry')
      .findOne({ _id: 'global' });
    return registry?.version ? this.get(registry.version) : null;
  }
  async publish(
    input: unknown,
    expectedVersion: number,
  ): Promise<SchemaRecord> {
    const definition = parseResumeSchema(input);
    const hash = createHash('sha256')
      .update(canonical(definition))
      .digest('hex');
    const session = this.database.client.startSession();
    try {
      return await session.withTransaction(async () => {
        const versions =
          this.database.db.collection<SchemaRecord>('schemaVersions');
        const registry = this.database.db.collection<{
          _id: string;
          version: number;
        }>('schemaRegistry');
        const current = await registry.findOne({ _id: 'global' }, { session });
        if (current?.version !== expectedVersion)
          throw new ConflictException(
            'Schema version changed; revalidate additions',
          );
        const previous = expectedVersion
          ? await versions.findOne({ version: expectedVersion }, { session })
          : null;
        if (previous?.hash === hash) return previous;
        if (previous && !preservesFields(previous.definition, definition))
          throw new ConflictException(
            'Existing schema fields must be preserved',
          );
        const record: SchemaRecord = {
          _id: randomUUID(),
          version: expectedVersion + 1,
          definition,
          hash,
          createdAt: new Date(),
        };
        await versions.insertOne(record, { session });
        const update = await registry.updateOne(
          { _id: 'global', version: expectedVersion },
          { $set: { version: record.version } },
          { session },
        );
        if (update.modifiedCount !== 1)
          throw new ConflictException('Schema publication conflict');
        return record;
      });
    } finally {
      await session.endSession();
    }
  }
}
