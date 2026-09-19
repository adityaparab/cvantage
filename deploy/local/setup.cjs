const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');
const options = [
  'compose',
  '--env-file',
  'deploy/local/compose.env',
  '-f',
  'deploy/local/compose.yaml',
];

function compose(args, capture = false) {
  const result = spawnSync('docker', [...options, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'],
  });
  if (result.error) {
    console.error(
      'Cannot run Docker. Install Docker with Compose and start its daemon.',
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(
      'Local MongoDB setup failed. Resolve the Docker error above and retry.',
    );
    process.exit(result.status ?? 1);
  }
  return result.stdout ?? '';
}

const running = compose(
  ['ps', '--status', 'running', '--quiet', 'mongodb'],
  true,
).trim();
if (running) {
  console.log('Stopping running local MongoDB before startup…');
  compose(['stop', 'mongodb']);
}
console.log('Starting local MongoDB and waiting for a healthy replica set…');
compose(['up', '-d', '--wait', '--wait-timeout', '120', 'mongodb']);
console.log('Local MongoDB is ready.');
