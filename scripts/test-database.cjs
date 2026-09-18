// Owns only its randomly named test database; never drops an existing application DB.
const { MongoClient } = require('mongodb');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
async function main() {
  const uri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27118/?replicaSet=cvantage-test';
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const name = `cvantage_test_${randomUUID().replaceAll('-', '')}`;
  try {
    const result = spawnSync(process.execPath, ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--config', 'test/jest-e2e.json', '--runInBand'], {
      stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: uri, MONGODB_DATABASE: name,
        SESSION_SECRET: 'synthetic-test-secret-with-32-characters', LITELLM_API_KEY: 'synthetic-key', LITELLM_WORKER_MODEL: 'test-worker', LITELLM_JUDGE_MODEL: 'test-judge' },
    });
    process.exitCode = result.status ?? 1;
  } finally { await client.db(name).dropDatabase(); await client.close(); }
}
main().catch(() => { console.error('Test MongoDB unavailable. Start the documented test replica set.'); process.exitCode = 1; });
