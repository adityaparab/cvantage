import { Document, Packer, Paragraph } from 'docx';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { z } from 'zod';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { join } from 'node:path';
import { ModelGateway } from '../src/adapters/ports';
import { ParsingService } from '../src/parsing/parsing.service';
import { normalizeRedactionMarkers } from '../src/documents/redaction-markers';
import { redactPii } from '../src/documents/pii';
const pii = {
  name: 'Synthetic Applicant',
  email: 'applicant@example.test',
  contactNumber: '+1 555 123 4567',
  location: 'Warsaw, Poland',
};
describe('resume uploads', () => {
  let app: INestApplication<App>;
  const generate = jest.fn<
    Promise<unknown>,
    Parameters<ModelGateway['generate']>
  >();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ModelGateway)
      .useValue({ generate })
      .compile();
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
    for (const marker of ['PII_NAME', 'PII_EMAIL', 'PII_PHONE', 'PII_LOCATION'])
      expect(result.source).toContain(marker);
    expect(await app.get(ParsingService).runNext()).toBe(false);
    expect(generate).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .get(`/api/parsing-jobs/${result.jobId}`)
      .expect(401);
    await agent
      .post(`/api/parsing-jobs/${result.jobId}/prepare`)
      .set('X-CSRF-Token', csrfToken)
      .send({ source: result.source, revision: 0, confirmed: false })
      .expect(400);
    const edited =
      result.source +
      '\n[NAME REMOVED] [email removed] PHONE_REDACTED {address hidden} applicant@example.test github.com/edited-private-user linkedin.com/in/edited-private-user [GitHub URL removed] [LinkedIn link removed]';
    await agent
      .post(`/api/parsing-jobs/${result.jobId}/prepare`)
      .set('X-CSRF-Token', csrfToken)
      .send({ source: edited, revision: 0, confirmed: true })
      .expect(201);
    const db = app.get(DatabaseService).db;
    const job = await db
      .collection<{ _id: string }>('parseJobs')
      .findOne({ _id: result.jobId });
    const normalized = redactPii(normalizeRedactionMarkers(edited), pii);
    expect(job).toMatchObject({
      source: normalized,
      piiConfirmed: true,
      status: 'queued',
    });
    expect(generate).not.toHaveBeenCalled();
    await agent
      .post(`/api/parsing-jobs/${result.jobId}/prepare`)
      .set('X-CSRF-Token', csrfToken)
      .send({ source: 'stale edit', revision: 0, confirmed: true })
      .expect(409);
    generate.mockResolvedValueOnce({ additions: [] }).mockResolvedValueOnce({
      stage: 'schema',
      verdict: 'accept',
      confidence: 0.95,
      checks: {
        structureValid: true,
        sourceCovered: true,
        sourceFaithful: true,
        piiAbsent: true,
      },
      issues: [],
    });
    await app.get(ParsingService).runNext();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[0][2]).toMatchObject({ source: normalized });
    expect(JSON.stringify(generate.mock.calls)).not.toMatch(
      /Synthetic Applicant|applicant@example.test|555 123 4567|Warsaw, Poland|edited-private-user|github\.com|linkedin\.com/,
    );
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
  it('redacts profile links on first upload before storing or displaying review text', async () => {
    const agent = request.agent(app.getHttpServer());
    const account = await agent
      .post('/api/auth/register')
      .set('X-Requested-With', 'CVantage')
      .send({
        email: 'profile-uploader@example.test',
        password: 'synthetic-password-123',
      })
      .expect(201);
    const { csrfToken } = z
      .object({ csrfToken: z.string() })
      .parse(account.body);
    const document = await Packer.toBuffer(
      new Document({
        sections: [
          {
            children: [
              new Paragraph('Software engineer using GitHub Actions.'),
              new Paragraph('https://github.com/upload-private-user'),
              new Paragraph(
                'www.linkedin.com/in/upload-private-user?trk=profile',
              ),
            ],
          },
        ],
      }),
    );
    const response = await agent
      .post('/api/resumes/upload')
      .set('X-CSRF-Token', csrfToken)
      .field('pii', JSON.stringify(pii))
      .attach('file', document, 'synthetic-profile-resume.docx')
      .expect(201);
    const result = z
      .object({ jobId: z.string(), source: z.string() })
      .parse(response.body);
    expect(result.source).toContain('PII_GITHUB');
    expect(result.source).toContain('PII_LINKEDIN');
    expect(result.source).toContain('GitHub Actions');
    expect(result.source).not.toMatch(
      /upload-private-user|github\.com|linkedin\.com/,
    );
    const stored = await app
      .get(DatabaseService)
      .db.collection<{ _id: string; source: string }>('parseJobs')
      .findOne({ _id: result.jobId });
    expect(stored?.source).toBe(result.source);
    await agent
      .post(`/api/parsing-jobs/${result.jobId}/cancel`)
      .set('X-CSRF-Token', csrfToken)
      .send({})
      .expect(201);
  });
});
