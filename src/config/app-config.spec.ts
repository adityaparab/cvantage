import { validateEnvironment } from './app-config';
const valid = {
  MONGODB_URI: 'mongodb://127.0.0.1',
  SESSION_SECRET: 'x'.repeat(32),
  LITELLM_API_KEY: 'test-key',
  LITELLM_WORKER_MODEL: 'worker',
  LITELLM_JUDGE_MODEL: 'judge',
};
it('validates configuration and fills stable defaults', () => {
  expect(validateEnvironment(valid).PORT).toBe(3000);
});
it('reports only invalid field names, not secrets', () => {
  expect(() =>
    validateEnvironment({ ...valid, SESSION_SECRET: 'private-value' }),
  ).toThrow('SESSION_SECRET');
  try {
    validateEnvironment({ ...valid, SESSION_SECRET: 'private-value' });
  } catch (error) {
    expect(String(error)).not.toContain('private-value');
  }
});
it('rejects unsafe provider URLs and invalid ports', () => {
  expect(() =>
    validateEnvironment({ ...valid, LITELLM_BASE_URL: 'file:///tmp/model' }),
  ).toThrow();
  expect(() => validateEnvironment({ ...valid, PORT: 70000 })).toThrow();
});
