# Scaling Oruinwan

The service and data layout these stages produce is described in [ARCHITECTURE.md](ARCHITECTURE.md).

How the one server and one database grow from a single box to a fleet, in
stages. Each stage is already implemented in code; what changes between stages
is configuration and infrastructure, not a rewrite. Nothing here affects the
web, desktop or mobile clients: they all talk to the same API and socket URL.

| Stage | Shape | Turn it on with |
|---|---|---|
| 0 | One server, one MongoDB | nothing (today) |
| 1 | N identical servers behind a load balancer | `REDIS_URL` |
| 2 | Replica reads, log retention, pgvector search | `MONGO_READ_REPLICAS`, `*_RETENTION_DAYS` |
| 3 | Sharded cluster or dedicated tenant databases | `scripts/shardCollections.js`, `TENANT_DB_MAP` |
| 4 | Separate api / realtime / worker / storage processes, AI service | `PROCESS_ROLE`, `AI_SERVICE_URL` |

---

## Stage 1: run more than one server

Set `REDIS_URL` on every instance. That single variable switches on:

- **Socket.IO Redis adapter**: an event emitted on one instance reaches sockets on all of them.
- **Shared presence** (`src/features/presence/presence.service.js`): each instance keeps its own socket map and mirrors it to Redis (`presence:sockets:<user>`, `presence:user:<user>`, 90 s TTL refreshed every 30 s). A user is "offline" only when no instance holds a socket for them. User cards and `@here` read the shared view.
- **Replicated huddles** (`src/modules/huddles/huddleReplication.js`): every registry change is published on `huddles:ops` and applied by the other instances; a snapshot in `huddles:live` seeds a freshly started instance. Signaling to a participant on another instance works because `io.to(socketId)` is routed by the adapter.
- **One run per interval for background jobs** (`src/shared/jobs/scheduler.js`): reminders, recurring tasks, retention, automations, notification digests and the audit digest each take a Redis lock (`job:<name>`, `SET NX PX`) before running. Without Redis there is no lock, which is correct for a single instance.
- **Graceful shutdown** releases this instance's presence and stops its jobs before closing sockets, so a deploy does not leave ghosts online for 90 s.

Also for stage 1:

- **Uploads must be in object storage.** Set `S3_ENDPOINT`, `S3_BUCKET` and the S3 keys (the `s3` service in `docker-compose.yml`, or any S3-compatible store) so every instance reads the same files. The local-disk driver is for development only; the server warns loudly in production. Company verification documents go through the same driver and are served to platform admins only via `/api/v2/uploads/file`.
- **Health check**: `GET /api/health` reports `redis`, `role`, `instance` and the jobs scheduled on that process.

Deploy: two or more processes (on one box or several) with the same `.env`, one Redis, one PostgreSQL and one object store. Sticky sessions are **not** required.

---

## Stage 2: the database gets busy

- **Connection pool** (`src/shared/db.js`): `MONGO_POOL_SIZE` (default 20) per process. Keep `instances × pool` under your Atlas tier's connection limit.
- **Indexes from a deploy step**: set `MONGO_AUTO_INDEX=false` and run `node scripts/syncIndexes.js` (add `--prune` to drop indexes no schema declares) so 40+ `ensureIndex` calls stop running on every boot.
- **Replica reads**: on a replica set, `MONGO_READ_REPLICAS=true` sends audit-log lists, dashboards and AI knowledge rows to secondaries through `replicaRead()` in `src/shared/db.js`. Wrap other heavy, lag-tolerant list queries the same way; never wrap a read that follows the user's own write.
- **Retention for logs** (`src/shared/retentionIndexes.js`): `AUDIT_LOG_RETENTION_DAYS`, `HISTORY_LOG_RETENTION_DAYS`, `ACTIVITY_RETENTION_DAYS`, `SECURITY_AUDIT_RETENTION_DAYS`. Zero (default) keeps everything. A positive number creates or updates a TTL index named `retention_ttl` at boot; back to zero drops it. Security events, AI usage and notifications already expire (90 / 90 / 60 days) from their schemas.
- **Vector search**: knowledge search runs on PostgreSQL + pgvector with an HNSW index (migration 0003). Nothing to configure beyond `DATABASE_URL`.

---

## Stage 3: one tenant is too big

Two independent options.

**Sharded cluster.** `node scripts/shardReadiness.js` (no DB needed) prints which models carry a tenant field and whether it is indexed first; `node scripts/shardCollections.js --plan` prints the shard keys (`{ company|workspace: 1, _id: 1 }` on messages, tasks, notes, notifications, logs, embeddings, files, huddle sessions). Against an Atlas sharded cluster, run it without `--plan` to apply. Models the readiness report lists as `NO TENANT FIELD` (Broadcast, FileVersion, MessageReminder, SecurityAuditEvent, TaskActivity) are children of tenant documents or per-user; give them a tenant field before sharding them, or leave them unsharded.

**Dedicated database for a company.** `TENANT_DB_MAP={"<companyId>":"<mongo uri>"}` plus `modelFor(Model, companyId)` from `src/shared/tenantDb.js` binds a schema to that company's connection. Opt in one code path at a time (messages and tasks first); platform-wide reports keep using the default connection until they are taught to fan out. Moving an existing company is a data copy you run with `mongodump`/`mongorestore` filtered by company, then flipping the map.

---

## Stage 4: split the process, not the code

`PROCESS_ROLE` (see `src/shared/processRole.js`) runs the same `server/` in one of four shapes:

| Role | HTTP API | Sockets | Jobs | Use for |
|---|---|---|---|---|
| `all` | yes | yes | yes | today's single server |
| `api` | yes | refused | no | stateless request handling, scale by CPU |
| `realtime` | yes | yes | no | long-lived socket connections, scale by connection count |
| `worker` | `/api/health` only | refused | yes | crons, digests, retention; one or two replicas |

Every role except `all` needs `REDIS_URL`. Route `/socket.io` to realtime nodes and everything else to api nodes at the load balancer; workers need no public route. This is the whole "microservices" step this codebase needs: the domain boundaries already exist as `src/modules/*` and `src/features/*`, so a later extraction of, say, the AI module into its own deployable is a matter of mounting fewer routes, not of rewriting them.

---

## Quick checklist

- [ ] `REDIS_URL` set on every instance (TLS `rediss://` in production)
- [ ] `S3_ENDPOINT` / `S3_BUCKET` / keys set (object storage)
- [ ] `MONGO_POOL_SIZE` × instances under the Atlas connection limit
- [ ] `MONGO_AUTO_INDEX=false` and `scripts/syncIndexes.js` in the deploy pipeline
- [ ] Retention days chosen with your compliance owner
- [ ] `/api/health` on each instance shows `redis: ready` and the expected `role`
