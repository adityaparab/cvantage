# Deployment boundaries

- [`local/`](local/README.md) owns developer-only Docker Compose infrastructure. It runs MongoDB; Node/Vite continue to run on the host.
- Application configuration remains in environment variables (`.env.example` documents the contract). Application startup never provisions infrastructure.
- A future Railway deployment should have its own configuration under `deploy/railway/`, added when that deployment is implemented. Do not inherit the local Compose file, local port mappings, unauthenticated database, or development volumes.

Railway must provide a transaction-capable MongoDB connection through `MONGODB_URI`, persistent database storage, production credentials, and the parser/font dependencies documented in [`docs/development.md`](../docs/development.md). Set `NODE_ENV=production` and supply the remaining application settings through the deployment environment. The local single-member replica set and `directConnection=true` are development choices, not defaults for a cloud topology. Railway deployment is not implemented by this local setup.
