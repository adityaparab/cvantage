import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';
import type { SchemaRecord } from './records';
import { publishSchema } from './schema-storage';
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
  publish(input: unknown, expectedVersion: number): Promise<SchemaRecord> {
    return publishSchema(
      this.database.client,
      this.database.db,
      input,
      expectedVersion,
    );
  }
}
