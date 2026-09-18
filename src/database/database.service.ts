import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  MongoClient,
  Db,
  MongoServerError,
  MongoServerSelectionError,
} from 'mongodb';
import { AppConfig } from '../config/app-config';
import { StartupError } from '../startup-error';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly client: MongoClient;
  readonly db: Db;
  constructor(config: AppConfig) {
    try {
      this.client = new MongoClient(config.values.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
    } catch {
      throw new StartupError(
        'Invalid MongoDB connection configuration. Check MONGODB_URI and its options in .env.',
      );
    }
    this.db = this.client.db(config.values.MONGODB_DATABASE);
  }
  async onModuleInit() {
    try {
      await this.client.connect();
      const hello: { setName?: unknown; msg?: unknown } = await this.db
        .admin()
        .command({ hello: 1 });
      if (typeof hello.setName !== 'string' && hello.msg !== 'isdbgrid') {
        throw new StartupError(
          'MongoDB is running as a standalone server. CVantage requires a replica set for transactions. Follow the local MongoDB setup in docs/development.md.',
        );
      }
      await this.createIndexes();
    } catch (error) {
      await this.client.close();
      throw databaseStartupError(error);
    }
  }
  async createIndexes() {
    await Promise.all([
      this.db.collection('users').createIndex({ email: 1 }, { unique: true }),
      this.db
        .collection('sessions')
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.db
        .collection('resumePii')
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.db.collection('resumes').createIndex({ ownerId: 1, updatedAt: -1 }),
      this.db
        .collection('resumePii')
        .createIndex({ ownerId: 1, resumeId: 1 }, { unique: true }),
      this.db
        .collection('schemaVersions')
        .createIndex({ version: 1 }, { unique: true }),
      this.db
        .collection('parseJobs')
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.db.collection('parseJobs').createIndex({ ownerId: 1, status: 1 }),
      this.db.collection('variants').createIndex({ ownerId: 1, resumeId: 1 }),
    ]);
    await this.db
      .collection<{ _id: string; version: number }>('schemaRegistry')
      .updateOne(
        { _id: 'global' },
        { $setOnInsert: { version: 0 } },
        { upsert: true },
      );
  }
  async onModuleDestroy() {
    await this.client.close();
  }
}

function databaseStartupError(error: unknown): StartupError {
  if (error instanceof StartupError) return error;
  if (error instanceof MongoServerSelectionError)
    return new StartupError(
      'MongoDB connection failed. Check MONGODB_URI, server availability, and the replicaSet name. A standalone server cannot satisfy a replica-set connection; see docs/development.md.',
    );
  if (error instanceof MongoServerError && error.code === 18)
    return new StartupError(
      'MongoDB authentication failed. Check credentials and authSource in MONGODB_URI.',
    );
  if (error instanceof MongoServerError && error.code === 13)
    return new StartupError(
      'MongoDB access denied. The configured account needs read/write and index-creation permissions on MONGODB_DATABASE.',
    );
  return new StartupError(
    'MongoDB initialization failed while checking topology or creating indexes. Check database permissions and existing index definitions.',
  );
}
