# Local MongoDB with Docker Compose

Requires Docker with Compose **2.30+** (or Compose 5). The setup uses a [post-start hook](https://docs.docker.com/compose/how-tos/lifecycle/) to initialize MongoDB independently of the application, and a read-only health check to wait for a writable primary.

From the repository root:

```sh
yarn db:up
```

This starts the official MongoDB 8.0.32 image as a single-member replica set named `cvantage`, bound on the host to **127.0.0.1:27018**. It starts with its own empty database; an existing MongoDB on port 27017 is untouched. The container advertises `mongodb:27017` to its Compose network. Set only the following database settings in the application's root `.env`, preserving your other settings:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27018/?replicaSet=cvantage&directConnection=true
MONGODB_DATABASE=cvantage
```

The host application needs `directConnection=true` because Docker's `mongodb` hostname is internal to the Compose network. [MongoDB documents this option for development environments exposing a single replica-set endpoint](https://www.mongodb.com/docs/manual/reference/connection-string-options/). It does not disable transactions. Then run `yarn dev` or `yarn start:prod` after building the application.

## Lifecycle and data

```sh
yarn db:logs    # Follow MongoDB logs
yarn db:down    # Stop/remove containers and network; retain database volumes
yarn db:up      # Recreate containers and reuse the same data
```

Named Docker volumes preserve data across restarts and container recreation. Initialization is idempotent: it creates a replica-set configuration only on a fresh volume and rejects a conflicting existing configuration. The Compose project name is `cvantage-local`; it has its own network and volumes. There are no host data-directory mounts. Do not add `--volumes` to `down` unless you intend to delete this local database.

`deploy/local/compose.env` contains only non-secret deployment settings. The commands explicitly select it, so application `.env` secrets are not loaded into Compose or passed into MongoDB. To use a different host port:

```sh
LOCAL_MONGODB_PORT=27028 yarn db:up
```

Update the port in the application's `MONGODB_URI` to match. Internal port and replica-set member naming remain unchanged. You can use the Compose file directly:

```sh
docker compose --env-file deploy/local/compose.env -f deploy/local/compose.yaml up -d --wait --wait-timeout 120
docker compose --env-file deploy/local/compose.env -f deploy/local/compose.yaml ps
```

If startup fails, inspect `yarn db:logs` and container health with `ps`. A port conflict requires a different host port; a conflicting stored replica-set configuration requires inspecting the existing volume, not automatic reconfiguration or deletion. `yarn db:up` must finish successfully before starting the application. For an isolated test run, use a distinct Compose project and host port, then pass that URI as `TEST_MONGODB_URI` to `yarn test:e2e`; the test runner creates and removes only its own random database.

## Scope

### Docker kernel compatibility

MongoDB 8.0 has a [known allocator incompatibility with Linux kernels 6.19 through 7.0.13](https://www.mongodb.com/docs/manual/administration/production-notes/). This host's Docker VM uses `7.0.12-linuxkit`. The local service overrides the image's `GLIBC_TUNABLES` with `glibc.pthread.rseq=1`, letting glibc own restartable sequences and avoiding MongoDB's affected per-CPU allocator path. MongoDB's [startup compatibility guard](https://github.com/mongodb/mongo/blob/r8.0.32/src/mongo/db/startup_check_rseq.cpp) remains enabled. This is a local compatibility setting; revisit it when upgrading Docker's kernel to 7.0.14+ rather than copying it into future Railway configuration.

### Deployment boundary

This database is unauthenticated and intended for trusted local development, with host access restricted to loopback. Application credentials, original uploads, and exports are not mounted into it. Railway will use separate deployment configuration, authenticated networking and storage; see [deployment boundaries](../README.md). No data is migrated from another MongoDB instance.
