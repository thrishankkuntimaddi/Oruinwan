<div align="center">

<img src="client/public/icons/oruinwan-192.png" alt="Oruinwan logo" width="80" height="80" />

# Oruinwan

**An open-source, self-hosted workspace for teams: encrypted messaging, tasks, notes, huddles and a built-in AI assistant, on web, desktop, Android and iOS.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/thrishankkuntimaddi/Oruniwan/actions/workflows/ci.yml/badge.svg)](https://github.com/thrishankkuntimaddi/Oruniwan/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/thrishankkuntimaddi/Oruniwan)](https://github.com/thrishankkuntimaddi/Oruniwan/releases/latest)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)

[Website](https://thrishankkuntimaddi.github.io/Oruniwan/) · [Download the apps](https://github.com/thrishankkuntimaddi/Oruniwan/releases/latest) · [Report a bug](https://github.com/thrishankkuntimaddi/Oruniwan/issues) · [Local development guide](docs/LOCAL_DEVELOPMENT.md)

</div>

---

## Contents

- [What is Oruinwan?](#what-is-oruinwan)
- [At a glance](#at-a-glance)
- [Features](#features)
- [Architecture](#architecture)
- [How a message travels](#how-a-message-travels)
- [Security model](#security-model)
- [AI](#ai)
- [Clients: web, desktop, mobile, SDK](#clients-web-desktop-mobile-sdk)
- [External services](#external-services)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Repository layout](#repository-layout)
- [API and real-time events](#api-and-real-time-events)
- [Roles](#roles)
- [Testing](#testing)
- [Releases](#releases)
- [Deployment](#deployment)
- [Project status and known limitations](#project-status-and-known-limitations)
- [Contributors](#contributors)
- [A note from the builder](#a-note-from-the-builder)
- [Contributing](#contributing)
- [License](#license)

---

## What is Oruinwan?

Oruinwan (formerly Chttrix) is a multi-tenant collaboration platform. A **company** owns one or more **workspaces**. Each workspace has channels, direct messages, tasks, notes, a knowledge base, files and huddles.

Message text is encrypted in the client with AES-256-GCM before it is sent, and the database stores only the ciphertext. Keys are managed with help from the server: it creates each conversation key and keeps a sealed copy, so it can add members and post bot messages while users are offline. Whoever runs the server, with its key-encryption key, can therefore decrypt conversations. This is server-assisted encryption, not zero-knowledge end-to-end encryption. See [Security model](#security-model) for exactly what is and isn't protected.

Everything is self-hostable. The default AI runs on your own model server (Ollama or vLLM), so no third-party AI service is needed unless you choose one. The same code runs on one laptop, on a single VPS, or split across many servers, with only `.env` changes.

---

## At a glance

| | |
|---|---|
| **Code** | About 213,000 lines of JavaScript: web client (~112k), server (~84k), mobile app (~11k), plus the AI package, SDK, end-to-end tests and desktop shell |
| **Backend** | One Express 5 + Socket.IO codebase with 56 feature modules and 11 core modules, PostgreSQL (8 migrations), MongoDB and Redis |
| **Clients** | Web (React 19 + Vite), desktop (Electron for macOS, Windows and Linux), Android and iOS (Capacitor 8), and a JavaScript SDK |
| **Tests** | 87 server, 4 AI and 1 SDK Jest files; 27 web and 7 mobile Vitest files; 18 Playwright end-to-end specs. All run in CI |
| **Releases** | Latest v1.2.1 (October 2026): signed Android APK and desktop installers from one GitHub Release; iOS builds in CI |
| **History** | 734 commits, August 2025 to October 2026 |

---

## Features

### Messaging
- Public and private channels, invite links, channel roles, and announcement channels with a posting policy
- Direct messages, threads, reactions, pins, edits with history, and deletes
- Markdown, code blocks, link previews, polls, file, image and voice attachments, and message reminders
- Slash commands: `/call`, `/video`, `/meet`, `/poll`, `/code`, `/ai`, `/task`, `/github`, `/review` and `/shrug`, plus `/jira` and `/zoom` when the `integrations` flag is on
- Unread badges, typing indicators and read receipts over Socket.IO

### Encryption
- Message text encrypted and decrypted in the client with AES-256-GCM, using a fresh 96-bit IV for every message
- One key per channel or DM, wrapped for each member with their RSA-OAEP (2048-bit) identity key
- Identity private keys stored encrypted under a key derived from the user's password (PBKDF2-SHA256, 100,000 iterations), and cached on each device as a non-extractable WebCrypto key
- Server-side secrets (integration credentials, 2FA secrets, escrowed conversation keys) sealed with AES-256-GCM under `SERVER_KEK` and versioned `CRYPTO_KEK_*` keys

### Tasks and projects
- A seven-state workflow (backlog, todo, in progress, review, blocked, done, cancelled) with transitions enforced on the server
- Per-workspace issue keys such as `ACME-12`, minted atomically
- Board, table, sprint, timeline and workload views
- Sprints, milestones, task templates, multiple assignees and dependencies
- Trash with restore (subtasks included), permanent delete, and an activity history on every task
- Create tasks from a message, from the AI assistant, with `/task`, or by hand

### Notes and knowledge
- Personal and shared notes with a rich editor
- Knowledge base with nested pages and a knowledge graph
- Search across messages, notes, tasks and knowledge pages. Encrypted messages are searched in the browser, over the messages it has decrypted

### Huddles and meetings
- Voice and video huddles over WebRTC with shared notes, peer to peer and capped at six participants (`HUDDLE_MAX_PARTICIPANTS`)
- Scheduled meetings linked to the workspace calendar
- STUN by default, plus Cloudflare TURN, self-hosted coturn or any static TURN provider

### Notifications
- In-app notification center for DMs, mentions, thread replies, tasks, meetings and reminders
- Browser notifications, notification digests and email notifications
- Mobile push through Expo from the server. Push text never contains message content. The Android and iOS apps don't register for push yet
- Per-workspace preferences enforced on the server

### Company administration
- Multiple workspaces per company, workspace templates and an onboarding wizard
- Departments, teams, org chart, employee directory, and a permission matrix of 22 permissions across 5 company roles
- SCIM 2.0 user provisioning, and OIDC single sign-on with Google, Microsoft and Okta (behind the `sso` flag)
- GDPR tools: personal and workspace data export, account erasure, legal hold and message retention
- Audit, compliance and security event logs with configurable retention
- Session management, two-factor authentication and domain verification

### Automations and developer platform
- Trigger-and-action automations with a run log. Scheduled triggers and incoming integration webhooks (for example, a merged GitHub pull request) run today; in-app event triggers are not wired up yet
- Developer portal with scoped API keys (stored hashed), a public API at `/api/public` (100 requests per minute per key) and HMAC-signed outgoing webhooks
- GitHub (personal access token, signed webhooks, pull request cards, AI review), Jira and Zoom integrations behind the `integrations` flag (see [docs/integrations.md](docs/integrations.md))
- A zero-dependency JavaScript SDK in [`sdk/js`](sdk/js)

Areas still being built are hidden behind `FEATURES_ENABLED`: `billing`, `sso`, `integrations` and `community`. A hidden feature can't be reached by URL either.

---

## Architecture

```
            Web (React 19 + Vite)   Desktop (Electron)   Android/iOS (Capacitor)   SDK
                           \               |                 |               /
                            \______ HTTPS + WebSocket (one origin) _________/
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
          │ keys, tasks, │ │ channels,    │ │ socket      │ │ memory  ──► Ollama │
          │ logs, vectors│ │ notes,       │ │ fan-out,    │ │ / vLLM / Gemini /  │
          │ event outbox │ │ notifications│ │ job locks,  │ │ OpenAI / Anthropic │
          └──────────────┘ └──────────────┘ │ event stream│ └────────────────────┘
                                            └─────────────┘
                     S3-compatible object storage for uploads (RustFS locally, AWS S3 or any S3 API in production)
```

One codebase runs in five shapes, chosen by `PROCESS_ROLE` (`server/src/shared/processRole.js`):

| Role | What it runs | Scales with |
|---|---|---|
| `all` (default) | Everything below, in one process | One machine |
| `api` | REST routes | CPU |
| `realtime` | Socket.IO, presence, typing, huddle signalling | Open connections |
| `worker` | Scheduled jobs, the outbox relay, webhook delivery | One or two replicas |
| `storage` | Uploads and downloads | Bandwidth |

Key design points:

- **Split by configuration, not by rewrite.** Every role except `all` needs `REDIS_URL`. The domain boundaries already exist as `server/src/features/*` and `server/src/modules/*`, so splitting a role out means mounting fewer routes.
- **Two databases with a clear split.** PostgreSQL holds identity, encryption keys, tasks, logs, AI embeddings and the event outbox. MongoDB holds messages and other documents. No transaction spans both: writes go to identity first, then documents, and are safe to retry.
- **Events go through an outbox.** Producers write an `event_outbox` row. A worker relays rows to the Redis Stream `oruinwan:events` using `FOR UPDATE SKIP LOCKED`, and consumers acknowledge through consumer groups (at-least-once). Without Redis, events stay in-process.
- **One run per job tick.** Each scheduled job takes a Redis lock (`SET job:<name> NX PX`) before it runs, so several instances never run the same job twice.
- **Migrations run on boot.** The SQL files in `server/db/migrations` run in order, one transaction each, under an advisory lock.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SCALING.md](docs/SCALING.md).

---

## How a message travels

1. The sender's client encrypts the text with the conversation key, using AES-256-GCM and a fresh IV (`client/src/services/messageEncryptionService.js`).
2. It sends `POST /api/v2/messages/channel` or `/direct` with the ciphertext and IV. The plaintext `@mention` handles and any link preview travel alongside, so the server can notify people and show the preview.
3. The server verifies the JWT, rejects text without ciphertext, checks membership, and stores the message in MongoDB (`server/src/modules/messages/messages.service.js`).
4. It emits `new-message` to the `channel:<id>` or `dm:<id>` room. With `REDIS_URL` set, the Socket.IO Redis adapter delivers it from every server instance.
5. The sender gets `201 Created`. Without holding up that response, the server then updates unread badges, resolves mentions, creates notifications and push messages, and publishes `message.sent` for webhooks through the outbox.
6. Each recipient's client decrypts and renders the message. Read receipts go back over the socket (`mark-chat-read`).
7. A client that was offline loads history with cursor pagination on the message id. After reconnecting, it fetches everything newer than the latest message it has.

---

## Security model

### Authentication
- Access tokens are 15-minute JWTs. Refresh tokens last 7 days, rotate on every use, and are stored only as SHA-256 hashes. The previous refresh token stays valid for 30 seconds so parallel tabs don't sign each other out.
- On the web, the refresh token lives in an httpOnly cookie. The desktop and mobile apps send `x-client-platform`, get the token in the response body, and keep it in secure storage.
- Passwords are hashed with bcrypt (cost 12). Five failed attempts lock the account for 15 minutes. TOTP two-factor authentication is available.
- Sign-in with Google, GitHub and LinkedIn. Companies can also use OIDC single sign-on (behind the `sso` flag) and SCIM 2.0 provisioning.
- Roles carried in the access token are not trusted for decisions. Company and workspace permissions are re-read from PostgreSQL on each request, so a role change takes effect immediately.

### Message encryption
How the keys fit together:

1. Password → PBKDF2-SHA256 (100,000 iterations) → the user's master key (UMEK). Users who sign up with OAuth get a random UMEK instead.
2. The UMEK encrypts the user's RSA-2048 identity private key. The encrypted key is stored on the server; once unlocked, it is cached on each device in IndexedDB as a non-extractable key.
3. The server generates one AES-256 key per channel or DM. It wraps a copy for each member with that member's RSA-OAEP public key, and seals one more copy under `SERVER_KEK`.
4. Messages are encrypted with that key using AES-256-GCM, with a fresh IV for every message.

**What this protects, and what it doesn't.** The sealed copy lets the server add new members, restore access at sign-in, and encrypt AI, bot and integration messages while users are offline. The cost is that anyone holding both the database and `SERVER_KEK` can decrypt every conversation. This is server-assisted encryption, not zero-knowledge end-to-end encryption. There is no forward secrecy, and removing a member does not rotate the conversation key.

**What the server sees in plaintext:**
- text you send to AI features: summaries, translation, `@ai`, and smart replies (on by default; a workspace setting turns them off)
- link-preview URLs and `@mention` handles
- attachments, polls, notes and tasks

Message text is never stored in plaintext, and push notifications never include it.

### Server secrets and hardening
- Integration credentials, 2FA secrets and escrowed keys are sealed with AES-256-GCM under `SERVER_KEK` and the versioned `CRYPTO_KEK_*` keys.
- Helmet headers, a CORS allow-list, rate limits on authentication, OTP and the public API, input sanitising, and membership checks on workspace routes.
- Sensitive actions are written to audit, compliance and security logs in MongoDB, and mirrored to PostgreSQL.

Found a vulnerability? Please report it privately through [GitHub security advisories](https://github.com/thrishankkuntimaddi/Oruniwan/security/advisories/new) rather than in a public issue.

---

## AI

Oruinwan AI lives in `ai/`, and every feature calls it through one gateway. By default it runs inside the API process. Set `AI_SERVICE_URL` and it runs as its own service instead: a small HTTP server that requires a bearer token, streams answers as server-sent events, and calls tools back through `/api/internal/ai-actions/:name`.

| Provider | How to select |
|---|---|
| `local_llm` (default) | Any OpenAI-compatible server: Ollama locally (`qwen2.5:3b` by default), vLLM on a GPU host |
| `gemini`, `openai`, `anthropic` | `AI_PROVIDER` globally, or per workspace in Settings → Oruinwan AI, with the workspace's key sealed at rest |
| `mock` | Used automatically under `NODE_ENV=test` |

What it does:

- **Assistant** (Cmd/Ctrl + Shift + A) with 14 tools: read the current workspace, channels and members; send channel and direct messages; create, list and update tasks; create and list notes; search the workspace; schedule meetings; and remember or forget facts about the user
- **Smart replies** under the message composer
- **Translate** messages and **summarize** threads
- **Note assist**: summarize, rewrite, expand, proofread, extract action items
- **Task assist**: descriptions, subtasks, acceptance criteria, estimates
- **Knowledge search** over pgvector embeddings (HNSW index, cosine distance). The embedding model must produce 768-dimension vectors, such as `nomic-embed-text`

OpenAI-compatible providers stream answers token by token. Gemini and Anthropic return the whole answer at once. Conversation memory lives in the AI process, so each AI instance keeps its own.

The client sends only text the user can already read, and the server never gives stored ciphertext to a model. That text does reach the server and the chosen provider, as described in [Security model](#security-model). See [ai/README.md](ai/README.md) for agents, tools, memory and how to add providers.

---

## Clients: web, desktop, mobile, SDK

**Web.** The React app in `client/` is the main client, and every server hosts it (`server/server.js` serves `dist/`). Below 768 px wide it switches to a mobile layout with a bottom tab bar; tablets, iPad included, keep the full layout down to 600 px. Besides the default build it has two modes:
- `vite build --mode app`: the desktop and tablet apps. The user picks the server, sign-in uses the server's app token mode, and "Explore the demo" opens a sample workspace answered on the device (see `client/src/appMode`).
- `vite build --mode site`: the product website on GitHub Pages.

**Desktop.** `desktop/` runs the web client's app build in a sandboxed Electron shell for macOS, Windows and Linux, with native notifications and an unread badge ([desktop/README.md](desktop/README.md)).

**Android, iPhone and iPad.** `mobile/` is a Capacitor app with two UIs:
- On phones, a phone-first React UI (a 1.4 MB app) with a built-in demo.
- On tablets and iPads, the web client's app build.

It keeps messages encrypted with the web client's scheme. The Android app updates itself from GitHub Releases, and the iOS app is built in CI for TestFlight. Details, release steps and configuration are in [mobile/README.md](mobile/README.md).

```bash
cd mobile && npm install
npm run dev              # phone UI preview at http://localhost:5174
npm run android:debug    # debug APK in android/app/build/outputs/apk/debug/
cd ../desktop && npm install && npm start   # the desktop app (start `npx vite --mode app` in client/ first)
```

**SDK.** `sdk/js` is a zero-dependency client for Node 18+ and browsers.

```js
const { OruinwanSDK } = require('@oruinwan/sdk');

const oruinwan = new OruinwanSDK({ baseUrl: 'https://your-host', apiKey: 'chx_...' });
await oruinwan.tasks.create({ title: 'Rotate credentials', priority: 'high' });
```

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

- Node.js 22 or newer and [Yarn 1](https://classic.yarnpkg.com) (`npm install -g yarn`)
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

Open http://localhost:3000. The web app proxies `/api` and `/uploads` to the API on `localhost:8080`. To reach an API on another machine, set `API_PROXY_TARGET` in `client/.env`, and add the web app's address to `CORS_EXTRA_ORIGINS` in `server/.env`.

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
| Data stores | `TASKS_STORE` | `pg` (as in `.env.example`) keeps tasks in PostgreSQL; the code falls back to MongoDB if unset |
| CORS | `CORS_EXTRA_ORIGINS` | Comma-separated origins allowed besides `FRONTEND_URL` and localhost |
| AI | `AI_PROVIDER`, `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_MODEL`, `LOCAL_EMBED_MODEL`, `AI_SERVICE_URL`, `AI_SERVICE_TOKEN` | Default provider is `local_llm` |
| Email | `BREVO_API_KEY`, `EMAIL_FROM`, `SMTP_*`, `SMTP_FALLBACK_*` | Tried in that order |
| OAuth | `GOOGLE_*`, `GITHUB_*`, `LINKEDIN_*` | Only Google's client id is required |
| Huddles | `CLOUDFLARE_TURN_*`, or `TURN_URLS` with `TURN_SECRET` or static credentials; `HUDDLE_MAX_PARTICIPANTS` | Configure one TURN source |
| Retention | `AUDIT_LOG_RETENTION_DAYS`, `HISTORY_LOG_RETENTION_DAYS`, `ACTIVITY_RETENTION_DAYS`, `SECURITY_AUDIT_RETENTION_DAYS` | `0` keeps logs forever |
| Feature flags | `FEATURES_ENABLED` | Comma list of `billing`, `sso`, `integrations`, `community`, or `all` |

The client only needs `VITE_API_URL`, `VITE_BACKEND_URL` and `VITE_GOOGLE_CLIENT_ID`. Never put secrets in `client/.env`: Vite bundles every `VITE_` variable into the browser build. Production examples for both sides are in `server/.env.production.template` and `client/.env.production.template`.

Generate secrets with:

```bash
openssl rand -hex 32
```

---

## Repository layout

```
Oruniwan/
├── client/            React 19 + Vite web app (also served by the API in production)
│   └── src/appMode/   Desktop and tablet app mode: server picker, token sign-in, on-device demo
├── server/            Express 5 + Socket.IO API
│   ├── server.js      Entry point: env validation, migrations, boot
│   ├── db/migrations/ PostgreSQL migrations, applied on boot
│   ├── models/        Mongoose models
│   └── src/
│       ├── identity/  PostgreSQL repositories for users, companies, workspaces, keys, sessions
│       ├── features/  56 feature modules (auth, channels, tasks, notes, knowledge, automations, ...)
│       ├── modules/   11 core domains (messages, threads, conversations, notifications, huddles, uploads, ...)
│       ├── shared/    Database clients, Redis, event bus, jobs, feature flags, middleware
│       └── socket/    Socket.IO setup and handlers
├── ai/                AI orchestrator, agents, tools, memory and providers (see ai/README.md)
├── desktop/           macOS, Windows and Linux app: the web client in an Electron shell (see desktop/README.md)
├── mobile/            Android and iOS app: phone UI, and the web client on tablets (see mobile/README.md)
├── sdk/js/            @oruinwan/sdk JavaScript client (see sdk/js/README.md)
├── platform/          Code shared by the web client and server: API client, socket client, event names
├── e2e/               Playwright browser tests
├── scripts/           Local development helpers
├── docs/              Architecture, scaling, local development, integrations
└── docker-compose.yml PostgreSQL, Redis, S3 storage and optional MongoDB
```

---

## API and real-time events

The REST API lives under `/api`, with newer endpoints versioned under `/api/v2`. Protected routes take `Authorization: Bearer <accessToken>`. On the web, the refresh token travels in an httpOnly cookie.

| Area | Base paths |
|---|---|
| Auth and accounts | `/api/auth`, `/api/auth/2fa`, `/api/auth/sso`, `/api/otp`, `/api/users` |
| Companies and workspaces | `/api/companies`, `/api/company`, `/api/departments`, `/api/teams`, `/api/permissions`, `/api/workspace-os` |
| Messaging | `/api/channels`, `/api/messages`, `/api/v2/messages`, `/api/threads`, `/api/v2/dm`, `/api/v2/conversations`, `/api/polls` |
| Encryption | `/api/v2/crypto`, `/api/v2/identity`, `/api/v2/devices` |
| Work | `/api/v2/tasks`, `/api/sprints`, `/api/milestones`, `/api/task-templates`, `/api/v2/notes`, `/api/v2/knowledge` |
| Files | `/api/v2/uploads`, `/api/v2/files`, `/api/upload` |
| Meetings | `/api/v2/huddles`, `/api/v2/meetings`, `/api/scheduled-meetings` |
| AI | `/api/ai` |
| Notifications | `/api/notifications`, `/api/push` |
| Admin and compliance | `/api/admin`, `/api/v2/audit`, `/api/compliance`, `/api/security`, `/api/analytics` |
| Developer platform | `/api/developer`, `/api/public`, `/api/v2/integrations`, `/api/v2/automations`, `/api/scim` |
| Health | `GET /api/health` reports databases, Redis, process role and scheduled jobs |

The route definitions in `server/src` are the source of truth.

**Socket.IO** uses the same JWT (`handshake.auth.token`). On connect, the server joins each socket to `user:<id>` and to every `channel:<id>` and `dm:<id>` room the user belongs to. Clients also use `join-workspace`, `chat:join` and `join-dm`.

Messages are **sent over REST** (`POST /api/v2/messages/channel` or `/direct`). The socket delivers them and carries the live updates:
- delivery: `new-message`, `conversation:activity` (unread badges), `notification:new`
- typing: `typing`
- read receipts: `mark-chat-read` → `read-update`
- huddles: `huddle:start`, `huddle:join`, `huddle:offer`, `huddle:answer`, `huddle:ice-candidate`, `huddle:leave`
- meeting notes: `meeting:join`, `meeting:notes_update`

With `REDIS_URL` set, events reach clients connected to any server instance.

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

## Testing

```bash
yarn lint          # ESLint for server, client, ai/ and sdk/
yarn test          # Jest for server, ai/ and sdk/; Vitest for the client
yarn build         # Production web build into dist/
yarn test:e2e      # Playwright end-to-end suite
cd mobile && npm test   # Vitest for the phone UI
```

| Suite | Files |
|---|---|
| Server (Jest) | 87 |
| AI and SDK (Jest, run with the server suite) | 4 + 1 |
| Web client (Vitest) | 27 |
| Mobile phone UI (Vitest) | 7 |
| End-to-end (Playwright) | 18 specs: sign-in, encrypted DMs and threads, tasks, huddles, webhooks, composer, message actions, channel policies, workspace admin, company dashboards and role gates, notifications |

The end-to-end suite needs MongoDB and PostgreSQL running, for example from `docker compose --profile mongo up -d`. It starts its own API on port 8095 and web app on port 3095, against a throwaway `chttrix_e2e` MongoDB database and an `oruinwan_e2e` PostgreSQL database. Both are dropped and re-seeded on every run, and the runner refuses any database whose name doesn't end in `_e2e`. Point it elsewhere with `E2E_MONGO_URI` and `E2E_DATABASE_URL`. Run `yarn playwright install chromium` inside `e2e/` once if Chrome isn't installed.

GitHub Actions runs lint, tests, the build and the end-to-end suite on every push to `main` and every pull request (`.github/workflows/ci.yml`).

---

## Releases

Pushing a `vX.Y.Z` tag runs `.github/workflows/apps.yml`. It builds every app and publishes them together in one GitHub Release:

- **Android:** a signed APK. CI checks that it is signed with the release key and refuses a debug-signed build.
- **Desktop:** a macOS dmg (arm64 and x64, ad-hoc signed), a Windows NSIS installer, and Linux AppImage and deb.
- **iOS:** built in CI and uploaded to TestFlight when the Apple signing secrets are configured.
- **`latest.json`:** the release manifest the apps use to find updates.

The Android app updates itself. Before installing a new APK it checks the APK's SHA-256, package name, version and signing certificate. The desktop app shows an update notice that opens the right installer.

The product website is deployed to GitHub Pages from `main` (`.github/workflows/web.yml`).

---

## Deployment

The smallest production setup is one server running everything:

1. Run PostgreSQL (with pgvector) and MongoDB, either from `docker-compose.yml` with changed passwords or as managed services. Add Redis when you run more than one process.
2. Create an S3 bucket, or any S3-compatible bucket, and set the `S3_*` variables.
3. Build the web app from the repository root: `yarn install && yarn build`. The output goes to `dist/`.
4. Start the server from `server/` with `NODE_ENV=production node server.js`, using `server/.env`. It applies migrations, creates the bucket if needed, and serves the API and `dist/` from one origin.
5. Put a TLS-terminating reverse proxy in front (Caddy, Nginx or a cloud load balancer) with WebSocket upgrades enabled. The server serves `dist/` as static files without an `index.html` fallback, so let the proxy serve `index.html` for unknown non-API paths (deep links).

**Docker.** `server/Dockerfile` and `server/Dockerfile.prod` currently copy only the server source. They leave out `server/db/migrations`, the root `ai/` package and the web build, and they use Node 20. Until they are updated, run from source as above.

To scale out, set `REDIS_URL` and run more instances, or split them with `PROCESS_ROLE`. Route `/socket.io` to realtime nodes and everything else to API nodes. Sticky sessions are only needed if clients fall back to HTTP long-polling. See [docs/SCALING.md](docs/SCALING.md).

**Pre-deploy checklist**

- [ ] `NODE_ENV=production`
- [ ] All secrets freshly generated, and the development passwords in `docker-compose.yml` changed
- [ ] `FRONTEND_URL` matches the public web origin exactly
- [ ] `DATABASE_URL`, `MONGO_URI` and `REDIS_URL` reachable from every process
- [ ] `S3_*` set, so every process shares the same uploads
- [ ] Email configured and the sender domain authenticated with SPF and DKIM
- [ ] AI endpoint reachable, or AI left disabled
- [ ] A TURN server configured if users sit behind corporate firewalls
- [ ] Log retention chosen to match your compliance needs

---

## Project status and known limitations

Oruinwan is under active development and is not yet production-hardened. Known gaps:

- **Unfinished areas.** Billing, SSO, integrations and the community page are incomplete and hidden behind feature flags.
- **Huddles** are peer-to-peer mesh calls, capped at six participants until a media server is added.
- **Data migration.** Data is moving from MongoDB to PostgreSQL. Identity has moved. Tasks run on PostgreSQL when `TASKS_STORE=pg`. Audit logs are mirrored to PostgreSQL, but reads still come from MongoDB. Messages haven't moved.
- **Encryption** is server-assisted by design (see [Security model](#security-model)). Attachments aren't encrypted, there is no forward secrecy, and removing a member doesn't rotate the conversation key.
- **Messaging:**
    - Sends carry no idempotency key, so a retried request can create a duplicate.
    - Order follows MongoDB ObjectIds, so it isn't strict across server instances.
    - No load testing or latency measurements have been done yet.
- **Single-process state.** Auth rate limits, OTP codes and AI chat memory live in process memory, so they aren't shared across instances yet.
- **Automations.** Only scheduled and integration-webhook triggers fire today.
- **Docker.** The images are incomplete (see [Deployment](#deployment)).
- **Phone app.** On Android phones and iPhone, attachments and polls appear as labels (open them in the web client), and there are no push notifications yet.

Issues and pull requests on any of these are welcome.

---

## Contributors

From the git history (734 commits):

- **Thrishank Kuntimaddi** created Oruinwan, then called Chttrix, and built the platform: the server, web client, encryption, authentication, tasks, AI, company administration, and the move to self-hosted infrastructure. 702 commits, August 2025 to October 2026.
- **Kuntimaddi Manideep** built the Capacitor app for Android and iOS, the Electron desktop app, and the CI and release pipeline, and prepared the repository for open source. 32 commits, October 2026.

Some commits were written with AI assistance and say so in their `Co-Authored-By` trailers.

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
- Every route checks workspace or company membership, not just authentication, and validates its input.
- Logging goes through the logger in `server/utils/logger.js`, never `console.*`.
- The UI uses the design tokens in `client/src/index.css` and Tailwind utilities, with no hard-coded colors.
- Icons come from Lucide React.
- API calls go through the service layer in `client/src/services`.
- Check every UI change at widths below 768 px.
- New PostgreSQL changes get a new numbered migration. Never edit an applied one.

---

## License

Released under the [MIT License](LICENSE).

<div align="center">

Built by [Thrishank Kuntimaddi](https://github.com/thrishankkuntimaddi) and [Kuntimaddi Manideep](https://github.com/manideepk90)

</div>
