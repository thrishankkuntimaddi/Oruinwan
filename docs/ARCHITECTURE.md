# Oruinwan architecture

Oruinwan is self-hosted. Everything below runs on one Mac today, on a Linux
box reached over Tailscale next, and on any number of servers later, with the
same code and only `.env` changes. No hosted platform (Railway, Vercel, Google
Cloud) is involved.

## Units

One codebase, five deployable units. Each is the same `server/` started with a
different `PROCESS_ROLE`, except AI, which is its own package.

| Unit | How it starts | Owns | Scales by |
|---|---|---|---|
| API | `PROCESS_ROLE=api node server/server.js` | REST routes: auth, companies, workspaces, tasks, notes, files metadata | CPU |
| Realtime | `PROCESS_ROLE=realtime ...` | Socket.IO, presence, huddle signaling, typing, receipts | open connections |
| Worker | `PROCESS_ROLE=worker ...` | Scheduled jobs, outbox relay, event consumers (webhooks) | 1 to 2 replicas |
| Storage | `PROCESS_ROLE=storage ...` | `/api/v2/uploads`, `/api/upload`: large bodies, streaming downloads | bandwidth |
| AI | `cd ai && npm start` | Orchestrator, agents, model calls (Ollama now, vLLM on a GPU box later) | GPU |

`PROCESS_ROLE=all` (default) runs API, Realtime, Worker and Storage in one
process; that is what local development uses.

### Rules

- **Clients talk to the API only** (and the Realtime socket). Nobody calls
  Worker or AI directly. The API calls AI over HTTP (`AI_SERVICE_URL`) with a
  bearer token and streams answers back; AI calls tool actions back through
  `/api/internal/ai-actions/:name` with the same token.
- **Everything else is an event.** A producer writes its record, then publishes
  a catalogue event (`server/src/shared/events/catalog.js`). With PostgreSQL the
  event first lands in the `event_outbox` table, so it is never lost if the
  process dies mid-write; the Worker's relay copies it to the Redis Stream
  `oruinwan:events`; consumers read it with consumer groups and acknowledge.
  Swap to NATS JetStream later if replay for days or cross-site fan-out is needed.
- **Each unit verifies JWTs itself** with `ACCESS_TOKEN_SECRET`; no unit calls
  another to learn who the user is.
- **One contract.** `sdk/js` is the client contract for web, desktop, mobile and
  integrations.

## Data

| Data | Store | Where in code |
|---|---|---|
| Companies, users, emails, refresh tokens, workspaces, memberships, departments, teams, role and workspace permissions, invites | PostgreSQL | `server/src/identity` (migration 0006) |
| E2EE identity keys, crypto state, conversation keys | PostgreSQL, next to users | `server/src/identity/keys.repo.js` |
| Login and device sessions | PostgreSQL | `server/src/identity/sessions.repo.js` |
| Tasks, projects, sprints, milestones, task activity | PostgreSQL (`TASKS_STORE=pg`) | `server/src/features/tasks/*.repository.js` (migration 0005) |
| Audit, compliance, security logs | PostgreSQL (mirrored from MongoDB this release, reads move next) | `server/src/shared/logStore.js` (migration 0002) |
| AI knowledge embeddings | PostgreSQL + pgvector (HNSW, cosine) | `server/src/features/ai/ai.knowledge.service.js` (migration 0003) |
| Event outbox | PostgreSQL | migration 0004 |
| Messages, threads, reactions, DMs, channels | MongoDB | `server/src/modules/messages`, `features/channels` |
| Notes, knowledge pages, notifications, activity feed, huddle history, AI usage | MongoDB | their features |
| Presence, job locks, rate limits, socket fan-out, event stream | Redis | `server/src/shared/redis.js`, `jobs/`, `events/` |
| Uploaded files | S3-compatible object store (RustFS locally) | `server/src/modules/uploads/upload.service.js` |
| AI conversation memory | AI process memory | `ai/memory` |

Constraints:

- **No transaction spans two stores.** Anything that must be atomic lives in
  one store (identity writes use `withTransaction`); cross-store writes go
  identity first, documents second, and tolerate a retry.
- **Tenant first.** Every PostgreSQL table carries `company_id` or
  `workspace_id` as the first column of its indexes.
- **Cross-store references** are 24-hex string ids. MongoDB documents keep
  user/workspace ids; `server/src/identity/hydrate.js` replaces `populate()`.

## Migrations

SQL files in `server/db/migrations` run in order on boot (one transaction each,
advisory-locked so several processes can boot together). `node server/scripts/migrate.js --status`
shows what ran. Never edit an applied file; add the next number.

## Running it

```bash
docker compose up -d                 # postgres (pgvector), redis, s3 (RustFS)
cd server && npm run dev             # PROCESS_ROLE=all on :8080
cd ai && AI_STANDALONE=1 AI_SERVICE_TOKEN=... API_INTERNAL_URL=http://localhost:8080 npm start   # optional, :8090
```

Set `AI_SERVICE_URL=http://localhost:8090` and the same `AI_SERVICE_TOKEN` in
`server/.env` to route AI through the separate process.

## Moving to the brother's PC (Tailscale) later

1. Install Docker on that PC, copy `docker-compose.yml`, change the passwords, `docker compose up -d`.
2. On the Mac, point `DATABASE_URL`, `REDIS_URL` and `S3_ENDPOINT` at the PC's Tailscale name (`postgres://...@pc-name:5432/...`).
3. Optionally run the AI unit there too and set `AI_SERVICE_URL`.
4. MongoDB can move into the same compose file with `docker compose --profile mongo up -d` and a new `MONGO_URI`.

No code changes are involved in any of these steps.
