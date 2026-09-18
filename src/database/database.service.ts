import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';
import { AppConfig } from '../config/app-config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly client: MongoClient;
  readonly db: Db;
  constructor(config: AppConfig) {
    this.client = new MongoClient(config.values.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    this.db = this.client.db(config.values.MONGODB_DATABASE);
  }
  async onModuleInit() {
    try {
      await this.client.connect();
      await this.db.command({ ping: 1 });
      await this.createIndexes();
    } catch {
      await this.client.close();
      throw new Error(
        'MongoDB initialization failed; check database connectivity and permissions',
      );
    }
  }
  async createIndexes() {
    await Promise.all([
      this.db.collection('users').createIndex({ email: 1 }, { unique: true }),
      this.db
        .collection('sessions')
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
