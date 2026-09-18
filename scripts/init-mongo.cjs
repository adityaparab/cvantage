const { MongoClient } = require('mongodb');
async function main() {
  const port = process.argv[2] || '27017';
  const name = process.argv[3] || 'cvantage';
  if (!/^\d+$/.test(port) || !/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid arguments');
  const client = new MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`);
  try {
    await client.connect();
    try { await client.db('admin').command({ replSetInitiate: { _id: name, members: [{ _id: 0, host: `127.0.0.1:${port}` }] } }); }
    catch (error) { if (error.code !== 23) throw error; }
    console.log(`Replica set ${name} initialized on port ${port}`);
  } finally { await client.close(); }
}
main().catch(() => { console.error('Replica set initialization failed'); process.exitCode = 1; });
