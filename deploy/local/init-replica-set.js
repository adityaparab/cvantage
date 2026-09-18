// Executed by mongosh after mongod starts; never runs in the application.
const replicaSet = 'cvantage';
const member = 'mongodb:27017';
const uri =
  'mongodb://127.0.0.1:27017/admin?directConnection=true&serverSelectionTimeoutMS=2000';

function waitForServer() {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const admin = connect(uri);
      if (admin.runCommand({ ping: 1 }).ok === 1) return admin;
    } catch {
      // The Compose hook may run before mongod has opened its socket.
    }
    sleep(1000);
  }
  throw new Error('Local MongoDB did not become reachable within 60 seconds.');
}

const admin = waitForServer();
let result;
try {
  result = admin.runCommand({ replSetGetConfig: 1 });
} catch (error) {
  if (error.code !== 94)
    throw new Error('Cannot inspect the local replica-set configuration.');
  result = { code: 94 };
}
if (result.code === 94) {
  // NotYetInitialized: initialize only a new data volume.
  const initialized = admin.runCommand({
    replSetInitiate: { _id: replicaSet, members: [{ _id: 0, host: member }] },
  });
  if (initialized.ok !== 1)
    throw new Error('Local replica-set initialization failed.');
} else if (
  result.ok !== 1 ||
  result.config._id !== replicaSet ||
  result.config.members.length !== 1 ||
  result.config.members[0].host !== member
) {
  throw new Error(
    'Existing replica-set configuration differs; inspect the volume before changing it.',
  );
}

// Readiness is separate: Compose's health check waits for a writable primary.
print('Local MongoDB replica-set configuration is ready.');
