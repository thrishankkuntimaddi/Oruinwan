<div align="center">

<img src="client/public/icons/oruinwan-192.png" alt="Oruinwan logo" width="80" height="80" />

# Oruinwan

**An open-source, self-hosted workspace for teams: end-to-end encrypted messaging, tasks, notes, huddles and a built-in AI assistant, on web, desktop and mobile.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/thrishankkuntimaddi/Oruniwan/actions/workflows/ci.yml/badge.svg)](https://github.com/thrishankkuntimaddi/Oruniwan/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)

[Report a bug](https://github.com/thrishankkuntimaddi/Oruniwan/issues) · [Request a feature](https://github.com/thrishankkuntimaddi/Oruniwan/issues) · [Local development guide](docs/LOCAL_DEVELOPMENT.md)

</div>

---

## Contents

- [What is Oruinwan?](#what-is-oruinwan)
- [Features](#features)
- [Architecture](#architecture)
- [External services](#external-services)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Repository layout](#repository-layout)
- [API and real-time events](#api-and-real-time-events)
- [AI](#ai)
- [Security and encryption](#security-and-encryption)
- [Roles](#roles)
- [Clients: web, desktop, mobile, SDK](#clients-web-desktop-mobile-sdk)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project status](#project-status)
- [A note from the builder](#a-note-from-the-builder)
- [Contributing](#contributing)
- [License](#license)

---

## What is Oruinwan?

Oruinwan is a multi-tenant collaboration platform. A **company** owns one or more **workspaces**, and each workspace has channels, direct messages, tasks, notes, a knowledge base, files and huddles. Messages are end-to-end encrypted: the server stores ciphertext and the clients decrypt.

Everything is self-hostable. The default AI runs on your own model server (Ollama or vLLM), so no third-party AI service is needed unless you choose one. The same code runs on one laptop, on a single VPS, or split across many servers, with only `.env` changes.

---

## Features

### Messaging
- Public and private channels, invite links, channel roles
- 1:1 and group direct messages, threads, reactions, pins, edits and deletes
- Markdown, code blocks, link previews, polls, file and image attachments
- Broadcast channels and slash commands such as `/remind`, `/status` and `/task`
- Unread badges per conversation, typing indicators and read receipts over Socket.IO

### Encryption
- End-to-end encrypted channels and DMs with AES-256-GCM
- Per-user identity keys, X25519 or RSA-OAEP key wrapping, password-based unlock
- Server-side secrets sealed under a key-encryption key (`SERVER_KEK`, `CRYPTO_KEK_*`)

### Tasks and projects
- Personal task inbox, board, list, sprint, timeline and workload views
- Sprints, milestones, task templates and multi-assignee tasks
- Create tasks from a message, from the AI assistant or by hand

### Notes and knowledge
- Personal and shared notes with a rich editor
- Knowledge base with nested pages, a knowledge graph and live cursors
- Search across messages, notes, tasks and knowledge pages

### Huddles and meetings
- Voice and video huddles over WebRTC with shared notes
- Scheduled meetings linked to the workspace calendar
- STUN by default, plus Cloudflare TURN, self-hosted coturn or any static TURN provider

### Notifications
- In-app notification center for DMs, mentions, thread replies, tasks, meetings and reminders
- Browser and Electron native notifications, daily digests and email notifications
- Mobile push through Expo, with previews decrypted on the device only (server side; the Android app does not register for push yet)
- Per-workspace preferences enforced on the server

### Company administration
- Multiple workspaces per company, workspace templates and an onboarding wizard
- Departments, teams, org chart, employee directory and a role permission matrix
- Audit, compliance and security event logs with configurable retention
- Active session management, two-factor authentication and domain verification

### Automations and developer platform
- Trigger and action automations, such as "when a task is created, post to a channel"
- Developer portal with API keys, OAuth apps and outgoing webhooks
- GitHub, Jira and Zoom integrations behind a feature flag (see [docs/integrations.md](docs/integrations.md))
- A zero-dependency JavaScript SDK in [`sdk/js`](sdk/js)

Some areas are still being built and are hidden behind `FEATURES_ENABLED`: `billing`, `sso`, `integrations` and `community`.

---

## Architecture

```
            Web (React 19 + Vite)   Desktop (Electron)   Android (Capacitor)   SDK
                           \               |                 |           /
                            \______ HTTPS + WebSocket (one origin) _____/
                                               |
                 ┌─────────────────────────────▼─────────────────────────────┐
                 │  server/  Express 5 + Socket.IO 4                          │
                 │  PROCESS_ROLE = all | api | realtime | worker | storage     │
                 └───┬──────────────┬──────────────┬──────────────┬───────────┘
                     │              │              │              │  HTTP + token
          ┌──────────▼───┐ ┌────────▼─────┐ ┌──────▼──────┐ ┌─────▼──────────────┐
          │ PostgreSQL   │ │ MongoDB      │ │ Redis       │ │ ai/ (optional own  │
          │ + pgvector   │ │              │ │             │ │ process)           │
          │ identity,    │ │ messages,    │ │ presence,   │ │ agents, tools,     │
          │ tasks, logs, │ │ channels,    │ │ socket      │ │ memory  ──► Ollama │
          │ embeddings,  │ │ notes,       │ │ fan-out,    │ │ / vLLM / Gemini /  │
          │ event outbox │ │ notifications│ │ job locks,  │ │ OpenAI / Anthropic │
          └──────────────┘ └──────────────┘ │ event stream│ └────────────────────┘
                                            └─────────────┘
                     S3-compatible object storage for uploads (RustFS locally, AWS S3 or any S3 API in production)
```

Key design points:

- **One codebase, several shapes.** `PROCESS_ROLE=all` runs everything in one process. The same code can run as separate API, realtime, worker and storage units once `REDIS_URL` is set.
- **Two databases with a clear split.** PostgreSQL holds identity, tasks, logs, AI embeddings and the event outbox. MongoDB holds messages and other documents. No transaction spans both.
- **Events go through an outbox.** Producers write to PostgreSQL, a worker relays to a Redis Stream, and consumers acknowledge. Without Redis, events stay in-process.
- **Migrations run on boot.** SQL files in `server/db/migrations` run in order under an advisory lock.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SCALING.md](docs/SCALING.md).

---

## External services

| Service | Used for | Required? |
|---|---|---|
| **PostgreSQL 16 + pgvector** | Users, companies, workspaces, keys, sessions, tasks, logs, AI embeddings, event outbox | Yes |
| **MongoDB 7** | Messages, channels, notes, knowledge, notifications, huddle history | Yes |
| **Redis 7** | Socket.IO adapter, shared presence, job locks, event stream | Only for more than one server process |
| **S3-compatible storage** | File, image and voice uploads | Yes in production. Local disk works for development |
| **AI model server** | Ollama or vLLM serving `qwen2.5:3b` and `nomic-embed-text` | Optional. AI features are off without it |
| **Gemini, OpenAI or Anthropic** | Alternative AI providers, chosen globally or per workspace | Optional |
| **Brevo or any SMTP server** | Sign-up verification, invites, password resets, digests | Needed for email flows |
| **Google OAuth** | Google sign-in. `GOOGLE_CLIENT_ID` must be set at boot | Yes, can be a placeholder if unused |
| **GitHub and LinkedIn OAuth** | Extra sign-in options | Optional |
| **Twilio** | SMS one-time passwords | Optional |
| **TURN server** | Huddles behind strict NATs and firewalls | Optional |
| **Expo push service** | Mobile push notifications | Optional |

`docker compose up -d` starts PostgreSQL, Redis and RustFS locally. `docker compose --profile mongo up -d` adds MongoDB.

---

## Quick start

### Prerequisites

- Node.js 20 or newer and [Yarn 1](https://classic.yarnpkg.com) (`npm install -g yarn`)
- Docker with Compose (Docker Desktop, Colima or Docker Engine)
- Optional: [Ollama](https://ollama.com) for the AI assistant

### 1. Clone and install

```bash
git clone https://github.com/thrishankkuntimaddi/Oruniwan.git
cd Oruniwan
yarn install          # one install for the client, server and e2e workspaces
```

### 2. Start the infrastructure

```bash
docker compose --profile mongo up -d   # PostgreSQL, Redis, S3 storage and MongoDB
```

Skip `--profile mongo` if you use MongoDB Atlas.

### 3. Configure

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

At minimum, set these in `server/.env`:

```bash
MONGO_URI=mongodb://127.0.0.1:27017/oruinwan
DATABASE_URL=postgres://oruinwan:oruinwan-dev@localhost:5432/oruinwan
ACCESS_TOKEN_SECRET=$(openssl rand -hex 32)
REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)
SERVER_KEK=$(openssl rand -hex 32)
CRYPTO_KEK_V1=$(openssl rand -hex 32)    # exactly 64 hex characters
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8080
GOOGLE_CLIENT_ID=placeholder             # or a real client id for Google sign-in
```

The S3, Redis and AI defaults in `.env.example` already match `docker-compose.yml` and a local Ollama.

### 4. Optional: start the AI engine

```bash
ollama serve &
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
```

### 5. Run

```bash
yarn build           # build the web app once; `yarn dev` serves the build
yarn dev             # API on :8080 and web app on :3000
yarn dev:all         # also starts Ollama and a local MongoDB first
yarn dev:status      # shows what is running
```

For hot reload while working on the UI, run the API with `yarn server` and the web app with `yarn workspace client start`.

Open http://localhost:3000. The web app proxies `/api` and `/uploads` to the API on `localhost:8080`. To reach an API on another machine, set `API_PROXY_TARGET` in `client/.env` and add the web app's address to `CORS_EXTRA_ORIGINS` in `server/.env`.

The full guide, including stopping services and troubleshooting, is in [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).

---

## Configuration

`server/.env.example` documents every variable. The important groups:

| Group | Variables | Notes |
|---|---|---|
| Required at boot | `MONGO_URI`, `DATABASE_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, `SERVER_KEK` | The server exits if any is missing |
| Encryption | `CRYPTO_KEK_ACTIVE_VERSION`, `CRYPTO_KEK_V1`, `CRYPTO_KEK_V2` | Each key is exactly 64 hex characters |
| Object storage | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE` | The bucket is created on boot. `STORAGE_DRIVER=local` forces local disk |
| Scaling | `REDIS_URL`, `PROCESS_ROLE` | Any role other than `all` needs Redis |
| CORS | `CORS_EXTRA_ORIGINS` | Comma-separated origins allowed besides `FRONTEND_URL` and localhost |
| AI | `AI_PROVIDER`, `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_MODEL`, `LOCAL_EMBED_MODEL`, `AI_SERVICE_URL`, `AI_SERVICE_TOKEN` | Default provider is `local_llm` |
| Email | `BREVO_API_KEY`, `EMAIL_FROM`, `SMTP_*`, `SMTP_FALLBACK_*` | Tried in that order |
| OAuth | `GOOGLE_*`, `GITHUB_*`, `LINKEDIN_*` | Only Google's client id is required |
| Huddles | `CLOUDFLARE_TURN_*` or `TURN_URLS` with `TURN_SECRET` or static credentials | Configure one TURN source |
| Retention | `AUDIT_LOG_RETENTION_DAYS`, `HISTORY_LOG_RETENTION_DAYS`, `ACTIVITY_RETENTION_DAYS`, `SECURITY_AUDIT_RETENTION_DAYS` | `0` keeps logs forever |
| Feature flags | `FEATURES_ENABLED` | Comma list of `billing`, `sso`, `integrations`, `community`, or `all` |

The client only needs `VITE_API_URL`, `VITE_BACKEND_URL` and `VITE_GOOGLE_CLIENT_ID`. Never put secrets in `client/.env`, because Vite bundles every `VITE_` variable into the browser build. Production examples for both sides are in `server/.env.production.template` and `client/.env.production.template`.

Generate secrets with:

```bash
openssl rand -hex 32
```

---

## Repository layout

```
Oruniwan/
├── client/            React 19 + Vite web app (also served by the API in production)
├── server/            Express + Socket.IO API
│   ├── server.js      Entry point: env validation, migrations, boot
│   ├── db/migrations/ PostgreSQL migrations, applied on boot
│   ├── models/        Mongoose models
│   └── src/
│       ├── identity/  PostgreSQL repositories for users, companies, workspaces, keys, sessions
│       ├── features/  Feature modules (auth, channels, tasks, notes, knowledge, automations, ...)
│       ├── modules/   Self-contained domains (messages, threads, notifications, huddles, uploads, ...)
│       ├── shared/    Database clients, Redis, event bus, jobs, feature flags, middleware
│       └── socket/    Socket.IO setup and handlers
├── ai/                AI orchestrator, agents, tools, memory and providers (see ai/README.md)
├── desktop/           Electron app (see desktop/README.md)
├── mobile/            Android app: phone-first React UI in a Capacitor shell (see mobile/README.md)
├── sdk/js/            @oruinwan/sdk JavaScript client (see sdk/js/README.md)
├── platform/          Code shared by web, server and mobile: API client, socket client, E2EE helpers
├── e2e/               Playwright browser tests
├── scripts/           Local development helpers
├── docs/              Architecture, scaling, local development, integrations
└── docker-compose.yml PostgreSQL, Redis, S3 storage and optional MongoDB
```

---

## API and real-time events

The REST API lives under `/api`. Newer endpoints are versioned under `/api/v2`. Protected routes take `Authorization: Bearer <accessToken>`, and the refresh token travels in an httpOnly cookie on the web.

| Area | Base paths |
|---|---|
| Auth and accounts | `/api/auth`, `/api/auth/2fa`, `/api/auth/sso`, `/api/otp`, `/api/users` |
| Companies and workspaces | `/api/companies`, `/api/company`, `/api/departments`, `/api/teams`, `/api/permissions`, `/api/workspace-os` |
| Messaging | `/api/channels`, `/api/messages`, `/api/v2/messages`, `/api/threads`, `/api/v2/dm`, `/api/v2/conversations`, `/api/polls` |
| Encryption | `/api/v2/crypto`, `/api/v2/encryption`, `/api/v2/identity`, `/api/v2/devices` |
| Work | `/api/v2/tasks`, `/api/sprints`, `/api/milestones`, `/api/task-templates`, `/api/v2/notes`, `/api/v2/knowledge` |
| Files | `/api/v2/uploads`, `/api/v2/files`, `/api/upload` |
| Meetings | `/api/v2/huddles`, `/api/v2/meetings`, `/api/scheduled-meetings` |
| AI | `/api/ai` |
| Notifications | `/api/notifications`, `/api/push` |
| Admin and compliance | `/api/admin`, `/api/v2/audit`, `/api/compliance`, `/api/security`, `/api/analytics` |
| Developer platform | `/api/developer`, `/api/v2/integrations`, `/api/v2/automations` |
| Health | `GET /api/health` reports database, Redis, process role and scheduled jobs |

The route definitions in `server/src` are the source of truth.

**Socket.IO events** use the same JWT. The client joins rooms with `join-workspace`, `join-channel` and `join-dm`, and sends `send-message`, `typing`, `add-reaction`, `message-read` and `mark-chat-read`. Huddles use `huddle:start`, `huddle:join`, `huddle:offer`, `huddle:answer` and `huddle:ice-candidate`. Knowledge pages use `knowledge:join` and `knowledge:cursor`. With `REDIS_URL` set, events reach clients connected to any server instance.

---

## AI

Oruinwan AI lives in `ai/` and every feature calls it through one gateway. It runs inside the API process by default, or as its own service when `AI_SERVICE_URL` is set.

| Provider | How to select |
|---|---|
| `local_llm` (default) | Any OpenAI-compatible server: Ollama locally, vLLM on a GPU host |
| `gemini`, `openai`, `anthropic` | `AI_PROVIDER` globally, or per workspace in Settings → Oruinwan AI |
| `mock` | Used automatically under `NODE_ENV=test` |

What it does:

- **Assistant** (Cmd/Ctrl + Shift + A) with tools that read the open conversation, note or task, then summarize, draft replies, and create tasks, notes and meetings
- **Smart replies** under the message composer
- **Translate** messages and **summarize** threads
- **Note assist**: summarize, rewrite, expand, proofread, extract action items
- **Task assist**: descriptions, subtasks, acceptance criteria, estimates
- **Knowledge search** over pgvector embeddings. The embedding model must produce 768-dimension vectors, such as `nomic-embed-text`

Messages are end-to-end encrypted, so the client sends only text the user can already read. The server never feeds stored ciphertext to a model. See [ai/README.md](ai/README.md) for agents, tools, memory and adding providers.

---

## Security and encryption

- **Authentication.** Short-lived access tokens (15 minutes) and refresh tokens (7 days) in an httpOnly cookie. Native apps receive the refresh token in the response body and keep it in secure storage. Two-factor authentication uses TOTP.
- **Message encryption.** Each user has an identity key pair, unlocked with their password through PBKDF2. Conversation keys are wrapped per member with X25519 or RSA-OAEP. Messages use AES-256-GCM, and thread keys are derived with HKDF. The server stores only ciphertext and wrapped keys.
- **Server secrets.** Integration credentials, 2FA secrets and similar values are sealed under `SERVER_KEK` and versioned `CRYPTO_KEK_*` keys.
- **Hardening.** Helmet headers, a strict CORS allow-list, per-IP and per-user rate limits, `express-validator` on inputs, and membership checks on every workspace route.
- **Audit.** Sensitive actions go to audit, compliance and security logs in MongoDB, mirrored to PostgreSQL.

Found a vulnerability? Please report it privately through [GitHub security advisories](https://github.com/thrishankkuntimaddi/Oruniwan/security/advisories/new) rather than a public issue.

---

## Roles

| Level | Roles |
|---|---|
| Platform | `user`, platform admin |
| Company | `owner`, `admin`, `manager`, `member`, `guest` |
| Workspace | `owner`, `admin`, `member` |
| Department | `manager`, `member` |
| Team | `lead`, `member` |

The company permission matrix maps each company role to capabilities such as creating channels, inviting members, viewing analytics and exporting data.

---

## Clients: web, desktop, mobile, SDK

**Web.** The React app in `client/` is responsive. Below 768 px wide it switches to a mobile layout with a bottom tab bar.

**Desktop.** `desktop/` wraps the web app in a sandboxed Electron shell with native notifications, a tray icon, unread badges, `oruinwan://` deep links and auto-update.

```bash
cd desktop && npm install --workspaces=false
npm start              # loads http://localhost:3000; override with CHTTRIX_WEB_URL
npm run build:mac      # or build:win / build:linux
```

**Android.** `mobile/` is a phone-first React app in a Capacitor shell: a 1.4 MB APK that signs in to any Oruinwan server (or runs a built-in demo), keeps messages end-to-end encrypted with the web client's scheme, and updates itself from GitHub Releases. Details, release steps and configuration are in [mobile/README.md](mobile/README.md).

```bash
cd mobile && npm install
npm run dev              # browser preview at http://localhost:5174
npm run android:debug    # debug APK in android/app/build/outputs/apk/debug/
```

**SDK.** `sdk/js` is a zero-dependency client for Node 18+ and browsers.

```js
const { OruinwanSDK } = require('@oruinwan/sdk');

const oruinwan = new OruinwanSDK({ baseUrl: 'https://your-host', apiKey: 'chx_...' });
await oruinwan.tasks.create({ title: 'Rotate credentials', priority: 'high' });
```

---

## Testing

```bash
yarn lint          # ESLint for server, client, ai/ and sdk/
yarn test          # Jest for server, ai/ and sdk/; Vitest for the client
yarn build         # Production web build into dist/
yarn test:e2e      # Playwright: sign in, encrypted DM and thread, tasks, huddle, webhooks
```

The end-to-end suite needs MongoDB and PostgreSQL running, for example from `docker compose --profile mongo up -d`. It starts its own API on port 8095 and web app on port 3095, against a throwaway `chttrix_e2e` MongoDB database and `oruinwan_e2e` PostgreSQL database. Both are dropped and re-seeded on every run, and the runner refuses any database whose name does not end in `_e2e`. Point it elsewhere with `E2E_MONGO_URI` and `E2E_DATABASE_URL`. Run `yarn playwright install chromium` inside `e2e/` once if you don't have Chrome installed.

GitHub Actions runs lint, tests, the build and the end-to-end suite on every push and pull request.

---

## Deployment

The smallest production setup is one server running everything:

1. Run PostgreSQL, Redis and MongoDB, either from `docker-compose.yml` with changed passwords or as managed services.
2. Create an S3 bucket, or any S3-compatible bucket, and set the `S3_*` variables.
3. Build and run the server image. It applies migrations, creates the bucket if needed and serves the built web app from the same origin.

```bash
docker build -f server/Dockerfile -t oruinwan-server .
docker run -p 8080:8080 --env-file server/.env oruinwan-server
```

4. Put a TLS-terminating reverse proxy in front, such as Caddy, Nginx or a cloud load balancer, with WebSocket upgrades enabled.

To scale out, set `REDIS_URL` and run more instances, or split them with `PROCESS_ROLE`. Sticky sessions are not required. See [docs/SCALING.md](docs/SCALING.md).

**Pre-deploy checklist**

- [ ] `NODE_ENV=production`
- [ ] All secrets freshly generated, and the development passwords in `docker-compose.yml` changed
- [ ] `FRONTEND_URL` matches the public web origin exactly
- [ ] `DATABASE_URL`, `MONGO_URI` and `REDIS_URL` reachable from every process
- [ ] `S3_*` set, so uploads are shared by every process
- [ ] Email configured and sender domain authenticated with SPF and DKIM
- [ ] AI endpoint reachable, or AI left disabled
- [ ] A TURN server configured if users sit behind corporate firewalls
- [ ] Log retention chosen to match your compliance needs

---

## Project status

Oruinwan is under active development and is not yet production-hardened. Known gaps:

- Billing, SSO, integrations and the community page are incomplete and hidden behind feature flags.
- Huddles are peer-to-peer mesh calls, capped at six participants until a media server is added.
- Data is moving from MongoDB to PostgreSQL. Identity, tasks and logs have moved, and messages have not.
- The Android app shows attachments and polls as labels (open them on the web) and has no push notifications yet.

Issues and pull requests on any of these are welcome.

---

## A note from the builder

> *Before you fork, star, or scroll past, I want to be honest with you.*

I built Oruinwan **alone, for 5 months straight.**

No co-founder. No team. No one to rubber-duck debug with at 2am. Just me, a blank editor, and an idea that felt enormous every single morning and impossible every single night.

Somewhere along the way, I lost patience with it. Then I lost hope. I genuinely don't know if this project is something great that I couldn't see clearly anymore, or if I built in the wrong direction, or if I just burned out too hard to tell the difference. Maybe all three. Maybe none. I honestly don't know what went wrong, or if anything went wrong at all.

What I do know is this: **I can't keep carrying it alone.**

So I'm making it public. Not because it's finished. Not because it's perfect. But because maybe the right eyes will see something I've stopped being able to see: a gap worth filling, a feature worth building, an architecture worth extending, or a bug worth fixing.

If that's you, **let's build it together.**

And if you think it's a waste of time, tell me that too. Honest feedback from strangers beats quiet doubt from a solo dev every single time.

Rate it. Break it. Improve it. Fork it. Whatever you do, **do it with me, not without me.**

— *Thrishank*

---

## Contributing

1. Fork the repository and create a branch: `git checkout -b feat/your-feature`.
2. Make your change and run `yarn lint && yarn test`.
3. Commit with [Conventional Commits](https://www.conventionalcommits.org), for example `feat(tasks): add recurring tasks` or `fix(mobile): show navbar on settings`.
4. Open a pull request describing what changed and how you tested it.

**Code conventions**

- Backend code follows the feature-module pattern in `server/src/features` and `server/src/modules`.
- Every route checks workspace or company membership, not just authentication, and validates input with `express-validator`.
- Logging goes through the logger in `utils/logger`, never `console.*`.
- The UI uses the design tokens in `client/src/index.css` and Tailwind utilities, with no hard-coded colors.
- Icons come from Lucide React.
- API calls go through the service layer in `client/src/services`.
- Check every UI change at widths below 768 px.
- New PostgreSQL changes get a new numbered migration. Never edit an applied one.

---

## License

Released under the [MIT License](LICENSE).

<div align="center">

Built by [Thrishank Kuntimaddi](https://github.com/thrishankkuntimaddi)

</div>
