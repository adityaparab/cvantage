import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { MongoClient } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../src/config/app-config';
import { DatabaseService } from '../src/database/database.service';
import { BASE_RESUME_SCHEMA } from '../src/contracts/resume-schema';

describe('explicit database wipe command', () => {
  const name = `cvantage_wipe_${randomUUID().replaceAll('-', '')}`;
  const sibling = `${name}_other`;
  const client = new MongoClient(process.env.MONGODB_URI!);
  const script = resolve(__dirname, '../scripts/wipe-database.cjs');
  beforeAll(async () => {
    await client.connect();
  });
  beforeEach(async () => {
    for (const database of [name, sibling]) {
      await client.db(database).dropDatabase();
      await client.db(database).collection('marker').insertOne({ keep: true });
    }
  });
  afterAll(async () => {
    await client.db(name).dropDatabase();
    await client.db(sibling).dropDatabase();
    await client.close();
  });
  function wipe(args: string[], env: Record<string, string> = {}) {
    return new Promise<{
      code: string | number;
      stdout: string;
      stderr: string;
    }>((done) => {
      execFile(
        process.execPath,
        [script, ...args],
        {
          cwd: tmpdir(),
          env: { ...process.env, MONGODB_DATABASE: name, ...env },
          timeout: 15_000,
        },
        (error, stdout, stderr) =>
          done({ code: error?.code ?? 0, stdout, stderr }),
      );
    });
  }
  it('requires exact confirmation and leaves data intact when missing or mismatched', async () => {
    expect((await wipe([])).code).not.toBe(0);
    expect((await wipe(['--confirm', sibling])).code).not.toBe(0);
    expect(await client.db(name).collection('marker').countDocuments()).toBe(1);
    expect(await client.db(sibling).collection('marker').countDocuments()).toBe(
      1,
    );
  });
  it.each(['admin', 'config', 'local'])(
    'refuses the %s system database even with confirmation',
    async (database) => {
      const result = await wipe(['--confirm', database], {
        MONGODB_DATABASE: database,
      });
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain('system database');
      expect(await client.db(name).collection('marker').countDocuments()).toBe(
        1,
      );
    },
  );
  it.each(['', 'invalid/name'])(
    'rejects missing or invalid database name %j without a default',
    async (database) => {
      const result = await wipe(['--confirm', database], {
        MONGODB_DATABASE: database,
      });
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain('explicit MONGODB_DATABASE');
      expect(await client.db(name).collection('marker').countDocuments()).toBe(
        1,
      );
    },
  );
  it('does not expose URI credentials on a connection configuration error', async () => {
    const result = await wipe(['--confirm', name], {
      MONGODB_URI: 'mongodb://synthetic-user:synthetic-private-secret@',
    });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('Database wipe failed');
    expect(result.stdout + result.stderr).not.toMatch(
      /synthetic-user|synthetic-private-secret/,
    );
    expect(await client.db(name).collection('marker').countDocuments()).toBe(1);
  });
  it('wipes only the explicit database and the next server startup restores the baseline and indexes', async () => {
    const result = await wipe(['--confirm', name]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain(`Wiped database "${name}"`);
    expect(await client.db(name).listCollections().toArray()).toEqual([]);
    expect(await client.db(sibling).collection('marker').countDocuments()).toBe(
      1,
    );
    const database = new DatabaseService(
      new AppConfig(
        new ConfigService({ ...process.env, MONGODB_DATABASE: name }),
      ),
    );
    try {
      await database.onModuleInit();
      const version = await database.db
        .collection('schemaVersions')
        .findOne({ version: 1 });
      expect(version?.definition).toEqual(BASE_RESUME_SCHEMA);
      expect(await database.db.collection('users').indexes()).toContainEqual(
        expect.objectContaining({ key: { email: 1 }, unique: true }),
      );
      expect(await database.db.collection('users').countDocuments()).toBe(0);
      expect(
        await database.db.collection('schemaVersions').countDocuments(),
      ).toBe(1);
    } finally {
      await database.onModuleDestroy();
    }
  });
});
