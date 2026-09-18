import { execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

function failedStartup(environment: Record<string, string>) {
  return new Promise<{ code: number | string | undefined; output: string }>(
    (resolveResult) => {
      execFile(
        process.execPath,
        ['-r', 'ts-node/register/transpile-only', 'src/main.ts'],
        {
          cwd: resolve(__dirname, '..'),
          env: { ...process.env, NODE_ENV: 'test', ...environment },
          timeout: 15000,
        },
        (error, stdout, stderr) => {
          resolveResult({ code: error?.code, output: stdout + stderr });
        },
      );
    },
  );
}

it('reports invalid configuration through the real entry point without printing secrets', async () => {
  const result = await failedStartup({
    SESSION_SECRET: 'private-invalid-secret',
  });
  expect(result.code).toBe(1);
  expect(result.output).toContain(
    'Application startup failed. Invalid environment configuration: SESSION_SECRET',
  );
  expect(result.output).not.toContain('private-invalid-secret');
  expect(result.output).not.toContain('ExceptionHandler');
});

it('reports malformed MongoDB options without leaking URI credentials', async () => {
  const result = await failedStartup({
    MONGODB_URI:
      'mongodb://user:private-password@localhost/?directConnection=invalid',
  });
  expect(result.code).toBe(1);
  expect(result.output).toContain('Invalid MongoDB connection configuration');
  expect(result.output).not.toContain('private-password');
});

it('exits after a port conflict and closes database resources', async () => {
  const server = createServer();
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready));
  try {
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Missing test port');
    const result = await failedStartup({ PORT: String(address.port) });
    expect(result.code).toBe(1);
    expect(result.output).toContain('PORT is already in use');
  } finally {
    await new Promise<void>((closed) => server.close(() => closed()));
  }
});
