import { z } from 'zod';
const sessionResponse = z.object({
  id: z.string(),
  email: z.string(),
  csrfToken: z.string(),
});
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';

describe('authentication and ownership', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('registers, restores, revokes sessions and rejects forged mutations', async () => {
    const agent = request.agent(app.getHttpServer());
    const body = {
      email: 'account@example.test',
      password: 'synthetic-password-123',
    };
    await agent.post('/api/auth/register').send(body).expect(403);
    const register = await agent
      .post('/api/auth/register')
      .set('X-Requested-With', 'CVantage')
      .send(body)
      .expect(201);
    expect(register.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(register.headers['set-cookie'][0]).toMatch(/SameSite=Strict/);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(sessionResponse.parse(me.body).email).toBe(body.email);
    await agent.get('/api/resumes').expect(200);
    await agent.post('/api/auth/logout').send({}).expect(403);
    await agent
      .post('/api/auth/logout')
      .set('X-CSRF-Token', sessionResponse.parse(me.body).csrfToken)
      .send({})
      .expect(201);
    await agent.get('/api/auth/me').expect(401);
    await agent
      .post('/api/auth/login')
      .set('X-Requested-With', 'CVantage')
      .send({ ...body, password: 'wrong-password-123' })
      .expect(401);
    await agent
      .post('/api/auth/login')
      .set('X-Requested-With', 'CVantage')
      .send(body)
      .expect(201);
  });
  it('isolates resume and PII reads between users', async () => {
    const alice = request.agent(app.getHttpServer());
    const bob = request.agent(app.getHttpServer());
    const first = await alice
      .post('/api/auth/register')
      .set('X-Requested-With', 'CVantage')
      .send({ email: 'alice@example.test', password: 'synthetic-password-123' })
      .expect(201);
    await bob
      .post('/api/auth/register')
      .set('X-Requested-With', 'CVantage')
      .send({ email: 'bob@example.test', password: 'synthetic-password-123' })
      .expect(201);
    const db = app.get(DatabaseService).db;
    const id = randomUUID();
    await db.collection<{ _id: string }>('resumes').insertOne({
      _id: id,
      ownerId: sessionResponse.parse(first.body).id,
      data: {},
      revision: 0,
    } as {
      _id: string;
    });
    await db.collection('resumePii').insertOne({
      ownerId: sessionResponse.parse(first.body).id,
      resumeId: id,
      name: 'Synthetic Alice',
    });
    await alice.get(`/api/resumes/${id}/pii`).expect(200);
    await bob.get(`/api/resumes/${id}`).expect(404);
    await bob.get(`/api/resumes/${id}/pii`).expect(404);
    await request(app.getHttpServer()).get('/api/resumes').expect(401);
    const user = await db
      .collection('users')
      .findOne({ email: 'alice@example.test' });
    expect(user?.passwordHash).not.toBe('synthetic-password-123');
    expect(user).not.toHaveProperty('password');
  });
  it('rejects expired sessions without waiting for TTL cleanup', async () => {
    const agent = request.agent(app.getHttpServer());
    const registered = await agent
      .post('/api/auth/register')
      .set('X-Requested-With', 'CVantage')
      .send({
        email: 'expiry@example.test',
        password: 'synthetic-password-123',
      })
      .expect(201);
    await app
      .get(DatabaseService)
      .db.collection('sessions')
      .updateMany(
        { ownerId: sessionResponse.parse(registered.body).id },
        { $set: { expiresAt: new Date(0) } },
      );
    await agent.get('/api/auth/me').expect(401);
  });
});
