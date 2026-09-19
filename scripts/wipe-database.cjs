const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { createInterface } = require('node:readline/promises');
const { MongoClient } = require('mongodb');

class CommandError extends Error {}

function configuration() {
  const envFile = resolve(__dirname, '../.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const { MONGODB_URI: uri, MONGODB_DATABASE: database } = process.env;
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri))
    throw new CommandError(
      'Set MONGODB_URI in .env or the environment before wiping.',
    );
  if (!database || !/^[a-zA-Z0-9_-]{1,63}$/.test(database))
    throw new CommandError(
      'Set an explicit MONGODB_DATABASE before wiping; no database name is assumed.',
    );
  if (['admin', 'config', 'local'].includes(database.toLowerCase()))
    throw new CommandError('Refusing to wipe a MongoDB system database.');
  return { uri, database };
}

async function confirm(database) {
  const args = process.argv.slice(2);
  if (args.length) {
    if (args.length === 2 && args[0] === '--confirm' && args[1] === database)
      return;
    throw new CommandError(
      `Confirmation must match the target: yarn db:wipe --confirm ${database}`,
    );
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new CommandError(
      `Confirmation required: yarn db:wipe --confirm ${database}`,
    );
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await terminal.question(
      `Type "${database}" to permanently wipe this database: `,
    );
    if (answer !== database)
      throw new CommandError(
        'Database wipe cancelled; confirmation did not match.',
      );
  } finally {
    terminal.close();
  }
}

async function main() {
  const { uri, database } = configuration();
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  // Display the target without printing credentials or connection-string options.
  const server =
    client.options.srvHost ??
    client.options.hosts.map((host) => host.toString()).join(', ');
  console.log(`Database: ${database}\nServer: ${server}`);
  console.log(
    'Deletes all accounts, resumes, PII, drafts, sessions and schema versions in this database. Stop the application before continuing.',
  );
  try {
    await confirm(database);
    await client.connect();
    await client.db(database).dropDatabase();
    console.log(
      `Wiped database "${database}". Restart the application to recreate indexes and seed schema/schema.json.`,
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(
    error instanceof CommandError
      ? error.message
      : 'Database wipe failed. Check .env, MongoDB availability and dropDatabase permissions.',
  );
  process.exitCode = 1;
});
