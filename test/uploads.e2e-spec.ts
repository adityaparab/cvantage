import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { z } from 'zod';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { join } from 'node:path';
const pii = {
  name: 'Synthetic Applicant',
  email: 'applicant@example.test',
  contactNumber: '+1 555 123 4567',
  location: 'Warsaw, Poland',
};
describe('resume uploads', () => {
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
  it('extracts in memory, separates PII, and requires review before queuing', async () => {
    const agent = request.agent(app.getHttpServer());
    const auth = await agent
      .post('/api/auth/register')
      .set('X-Requested-With', 'CVantage')
      .send({
        email: 'uploader@example.test',
        password: 'synthetic-password-123',
      })
      .expect(201);
    const { csrfToken } = z.object({ csrfToken: z.string() }).parse(auth.body);
    const upload = await agent
      .post('/api/resumes/upload')
      .set('X-CSRF-Token', csrfToken)
      .field('pii', JSON.stringify(pii))
      .attach(
        'file',
        join(__dirname, 'fixtures/cvantage-synthetic-resume.docx'),
      )
      .expect(201);
    const result = z
      .object({
        jobId: z.string(),
        resumeId: z.string(),
        source: z.string(),
        revision: z.number(),
      })
      .parse(upload.body);
    expect(result.source).not.toContain(pii.name);
    expect(result.source).not.toContain(pii.email);
    expect(result.source).toContain('TypeScript');
    await request(app.getHttpServer())
      .get(`/api/parsing-jobs/${result.jobId}`)
      .expect(401);
    await agent
      .post(`/api/parsing-jobs/${result.jobId}/prepare`)
      .set('X-CSRF-Token', csrfToken)
      .send({ source: result.source, revision: 0, confirmed: false })
      .expect(400);
    await agent
      .post(`/api/parsing-jobs/${result.jobId}/prepare`)
      .set('X-CSRF-Token', csrfToken)
      .send({ source: result.source, revision: 0, confirmed: true })
      .expect(201);
    const db = app.get(DatabaseService).db;
    const job = await db
      .collection<{ _id: string }>('parseJobs')
      .findOne({ _id: result.jobId });
    expect(job).not.toHaveProperty('file');
    expect(job).not.toHaveProperty('buffer');
    const savedPii = await db
      .collection('resumePii')
      .findOne({ resumeId: result.resumeId });
    expect(savedPii?.name).toBe(pii.name);
    expect(savedPii?.expiresAt).toBeInstanceOf(Date);
    await db
      .collection<{ _id: string }>('parseJobs')
      .updateOne({ _id: result.jobId }, { $set: { expiresAt: new Date(0) } });
    await agent.get(`/api/parsing-jobs/${result.jobId}`).expect(404);
    await agent
      .post(`/api/parsing-jobs/${result.jobId}/cancel`)
      .set('X-CSRF-Token', csrfToken)
      .send({})
      .expect(201);
    expect(
      await db
        .collection('resumePii')
        .countDocuments({ resumeId: result.resumeId }),
    ).toBe(0);
  });
});
