const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const { join } = require('node:path');
const { mkdir, readFile } = require('node:fs/promises');
const { MongoClient } = require('mongodb');
const { chromium } = require('playwright');
const { BASE_RESUME_SCHEMA } = require('../dist/contracts/resume-schema');
const source = {
  basics: {},
  professionalSummary: 'Software engineer building reliable tools.',
  workExperience: [
    {
      employer: 'Example Labs',
      role: 'Software Engineer',
      startDate: '2020',
      endDate: '2024',
      highlights: ['Built reliable internal tools.'],
    },
  ],
  skills: [
    { category: 'Engineering', items: ['TypeScript', 'React', 'MongoDB'] },
  ],
};
const received = [];
let mappingJudgments = 0;
const proxy = http.createServer(async (request, response) => {
  try {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    const instructions = body.messages[0].content;
    const input = JSON.parse(body.messages[1].content);
    received.push(body.messages);
    let result;
    if (instructions.startsWith('Design a reusable'))
      result = BASE_RESUME_SCHEMA;
    else if (instructions.startsWith('Map ALL')) result = source;
    else if (instructions.startsWith('Tailor sourceResume')) {
      assert.equal(
        input.sourceResume.professionalSummary,
        'User corrected experience with internal tools.',
      );
      result = {
        ...input.sourceResume,
        professionalSummary: 'Software engineer focused on internal tools.',
      };
    } else {
      const accept = input.stage === 'schema' || ++mappingJudgments > 5;
      result = {
        stage: input.stage,
        verdict: accept ? 'accept' : 'revise',
        confidence: accept ? 0.95 : 0.8,
        checks: {
          structureValid: true,
          sourceCovered: accept,
          sourceFaithful: true,
          piiAbsent: true,
        },
        issues: accept
          ? []
          : [
              {
                code: 'REVIEW',
                path: '/professionalSummary',
                message: 'Check summary coverage',
                suggestedFix: 'Review the summary against your source',
              },
            ],
      };
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify({
        id: randomUUID(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: JSON.stringify(result) },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );
  } catch {
    response.writeHead(500);
    response.end('{}');
  }
});
async function port() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const number = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return number;
}
async function main() {
  const dbName = `cvantage_browser_${randomUUID().replaceAll('-', '')}`;
  const client = new MongoClient(
    process.env.TEST_MONGODB_URI ||
      'mongodb://127.0.0.1:27118/?replicaSet=cvantage-test',
  );
  let server, browser, page;
  let logs = '';
  const output =
    process.env.BROWSER_ARTIFACT_DIR || '/tmp/cvantage-browser-verification';
  try {
    await client.connect();
    await mkdir(output, { recursive: true });
    proxy.listen(0, '127.0.0.1');
    await once(proxy, 'listening');
    const appPort = await port();
    const origin = `http://127.0.0.1:${appPort}`;
    server = spawn(process.execPath, ['dist/main.js'], {
      cwd: join(__dirname, '..'),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: String(appPort),
        MONGODB_URI:
          process.env.TEST_MONGODB_URI ||
          'mongodb://127.0.0.1:27118/?replicaSet=cvantage-test',
        MONGODB_DATABASE: dbName,
        SESSION_SECRET: 'browser-test-session-secret-32-characters',
        LITELLM_BASE_URL: `http://127.0.0.1:${proxy.address().port}/v1`,
        LITELLM_API_KEY: 'synthetic-browser-key',
        LITELLM_WORKER_MODEL: 'worker',
        LITELLM_JUDGE_MODEL: 'judge',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', (chunk) => {
      logs += chunk;
    });
    server.stderr.on('data', (chunk) => {
      logs += chunk;
    });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error('Test server exited');
      try {
        if ((await fetch(`${origin}/api/health`)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert(ready, 'Server readiness');
    browser = await chromium.launch({
      headless: true,
      ...(process.env.BROWSER_EXECUTABLE
        ? { executablePath: process.env.BROWSER_EXECUTABLE }
        : {}),
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      acceptDownloads: true,
    });
    page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin);
    await page
      .getByRole('button', { name: 'New here? Create an account' })
      .click();
    await page
      .getByLabel('Email', { exact: true })
      .fill('browser-user@example.test');
    await page
      .getByLabel('Password', { exact: true })
      .fill('synthetic-password-123');
    await page
      .getByRole('button', { name: 'Create account', exact: true })
      .click();
    await page
      .getByLabel('Full name', { exact: true })
      .fill('Synthetic Applicant');
    await page.getByLabel('Location', { exact: true }).fill('Warsaw, Poland');
    await page
      .getByLabel('Contact email', { exact: true })
      .fill('applicant@example.test');
    await page
      .getByLabel('Contact number', { exact: true })
      .fill('+1 555 123 4567');
    await page
      .getByLabel('Resume file')
      .setInputFiles(
        join(__dirname, '../test/fixtures/cvantage-synthetic-resume.docx'),
      );
    await page
      .getByRole('button', { name: 'Upload resume', exact: true })
      .click();
    const redacted = await page.getByLabel('Redacted resume text').inputValue();
    assert(!/Synthetic Applicant|applicant@example.test|Warsaw/.test(redacted));
    await page
      .getByLabel('I checked the text and removed identifying details.')
      .check();
    await page.getByRole('button', { name: 'Confirm redacted text' }).click();
    await page.getByRole('button', { name: '← Back to uploads' }).click();
    await page.getByRole('button', { name: /Resume upload ·/ }).click();
    await page
      .getByRole('heading', { name: 'Review your parsed resume' })
      .waitFor();
    assert.equal(mappingJudgments, 5);
    await page
      .getByLabel('Professional Summary', { exact: true })
      .fill('Reviewed software engineer.');
    await page
      .getByLabel(
        'I reviewed these fields for accuracy and removed identifying details.',
      )
      .check();
    await page.getByRole('button', { name: 'Approve parsed resume' }).click();
    await page.getByRole('button', { name: /Open and edit/ }).click();
    const editor = page
      .locator('form')
      .filter({
        has: page.getByRole('button', {
          name: 'Save resume changes',
          exact: true,
        }),
      });
    await editor
      .getByLabel('Professional Summary', { exact: true })
      .fill('User corrected experience with internal tools.');
    await page
      .getByRole('button', { name: 'Save resume changes', exact: true })
      .click();
    await page.getByText('Changes saved.', { exact: true }).waitFor();
    await page
      .getByLabel('Job description')
      .fill(
        'Seeking a software engineer to build reliable internal tools with TypeScript and React.',
      );
    await page
      .getByLabel(
        'I removed names, contact information, and locations from this description.',
      )
      .check();
    await page.getByRole('button', { name: 'Create tailored version' }).click();
    await page
      .getByRole('heading', { name: 'Review your tailored version' })
      .waitFor();
    await page
      .getByLabel(
        'I checked these changes against my experience and approve this version.',
      )
      .check();
    await page
      .getByRole('button', { name: 'Approve tailored version', exact: true })
      .click();
    await page.getByText('This saved version is approved.').waitFor();
    const exports = page
      .locator('section.exports')
      .filter({
        has: page.getByRole('heading', {
          name: 'Download this tailored version',
        }),
      });
    for (const format of ['PDF', 'DOCX']) {
      const downloading = page.waitForEvent('download');
      await exports
        .getByRole('button', { name: `Download ${format}`, exact: true })
        .click();
      const download = await downloading;
      assert.equal(await download.failure(), null);
      const file = join(output, `resume.${format.toLowerCase()}`);
      await download.saveAs(file);
      const bytes = await readFile(file);
      assert(bytes.length > 1000);
      assert.equal(
        bytes.subarray(0, format === 'PDF' ? 5 : 2).toString(),
        format === 'PDF' ? '%PDF-' : 'PK',
      );
    }
    await exports.getByRole('button', { name: 'Preview PDF' }).click();
    await page.getByTitle('Resume PDF preview').waitFor();
    await page.getByRole('button', { name: 'Close preview' }).click();
    await page.getByRole('button', { name: '← Back to workspace' }).click();
    await page.screenshot({
      path: join(output, 'desktop.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(output, 'mobile.png'), fullPage: true });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      'No horizontal mobile overflow',
    );
    await page.reload();
    await page.getByRole('button', { name: 'Sign out' }).waitFor();
    await page.getByLabel('Full name', { exact: true }).focus();
    await page.keyboard.press('Tab');
    assert(
      await page
        .getByLabel('Location', { exact: true })
        .evaluate((element) => element === document.activeElement),
      'Keyboard field navigation',
    );
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
    assert.deepEqual(errors, []);
    assert(
      !/Synthetic Applicant|applicant@example\.test|Warsaw, Poland|555 123 4567/.test(
        JSON.stringify(received),
      ),
      'No known PII in model calls',
    );
    assert(
      !logs.includes('synthetic-browser-key') &&
        !logs.includes('Synthetic Applicant') &&
        !logs.includes('User corrected experience'),
      'Logs exclude secrets and resume values',
    );
    const db = client.db(dbName);
    assert.equal(await db.collection('parseJobs').countDocuments(), 0);
    assert.equal(
      await db
        .collection('resumePii')
        .countDocuments({ expiresAt: { $exists: true } }),
      0,
    );
    assert.equal(
      await db.collection('variants').countDocuments({ status: 'reviewed' }),
      1,
    );
    console.log(
      `PASS: registration → upload → five-attempt review → editing → tailoring → PDF/DOCX; ${received.length} redacted calls; desktop/mobile and session checks. Artifacts: ${output}`,
    );
  } catch (error) {
    if (page)
      await page
        .screenshot({ path: join(output, 'failure.png'), fullPage: true })
        .catch(() => {});
    throw error;
  } finally {
    await browser?.close();
    if (server && server.exitCode === null) {
      server.kill('SIGTERM');
      await once(server, 'exit');
    }
    await new Promise((resolve) => proxy.close(resolve));
    await client.db(dbName).dropDatabase();
    await client.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
