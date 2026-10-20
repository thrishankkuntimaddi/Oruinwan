<div align="center">

<img src="client/public/icons/oruinwan-192.png" alt="Oruinwan logo" width="80" height="80" />

# Oruinwan

**A workspace for companies: channels, direct messages, huddles, tasks, notes and AI agents, on the web, desktop, phones and tablets.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/thrishankkuntimaddi/Oruniwan/actions/workflows/ci.yml/badge.svg)](https://github.com/thrishankkuntimaddi/Oruniwan/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/thrishankkuntimaddi/Oruniwan)](https://github.com/thrishankkuntimaddi/Oruniwan/releases/latest)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)

[Website](https://thrishankkuntimaddi.github.io/Oruniwan/) · [Download the apps](https://github.com/thrishankkuntimaddi/Oruniwan/releases/latest) · [Report a bug](https://github.com/thrishankkuntimaddi/Oruniwan/issues) · [Local development guide](docs/LOCAL_DEVELOPMENT.md)

</div>

---

## Contents

- [What Oruinwan is](#what-oruinwan-is)
- [Features](#features)
- [Architecture](#architecture)
- [Local development](#local-development)
- [Tests](#tests)
- [Builds](#builds)
- [Deployment](#deployment)
- [Environment variables](#environment-variables)
- [Security and privacy](#security-and-privacy)
- [Contributing](#contributing)
- [License](#license)

---

## What Oruinwan is

Oruinwan is a team workspace for companies of around fifty people. A **company** owns one or more **workspaces**; each workspace has public and private channels, direct messages, threads, huddles, tasks, notes, files and a knowledge base. AI agents (Claude, ChatGPT, Gemini, Grok and the built-in Oruinwan AI) can be added to a workspace and answer in conversations.

It runs in the browser, as a desktop app for macOS, Windows and Linux, as a phone app for Android and iOS, and as a tablet app on Android tablets and iPads. Every app talks to one Oruinwan server, which a company runs for itself.

---

## Features

### Sign-in and accounts
- Email and password, or Google
- Email verification, passkeys, and two-factor authentication with authenticator-app codes
- In the desktop and tablet apps, Google sign-in is available on the web only

### Workspaces
- A step-by-step wizard for creating a workspace
- Invitations by email, by reusable team link, or by one-time link
- Workspace admins can switch individual features (such as tasks, notes, huddles and polls) off for their workspace

### Messaging
- Public and private channels, direct messages and threads
- Reactions, pins, mentions, search and file sharing
- Tasks, notes, files, a knowledge base and company updates alongside conversations

### Huddles
- Audio and video calls with screen sharing and raise hand
- Scheduled meetings

### Split view
- On desktop and tablet, open two conversations, or a conversation and a thread, side by side

### Agents, workflows and integrations
- Claude, ChatGPT, Gemini and Grok, plus the built-in Oruinwan AI
- Agents are installed for the whole workspace by an admin, or connected personally by each member with their own API key
- Workflows (automations), apps and integrations: GitHub, Jira, Zoom and incoming webhooks
- Members can connect their personal GitHub and Jira accounts

### Administration
- **Workspace admin** for each workspace: members, invitations, channels and feature settings
- **Company console** for owners and admins: departments, people, workspaces, roles and permissions, audit logs and security settings
- Admins never see message content or message counts, and Oruinwan keeps no per-person activity metrics

---

## Architecture

```
  Web (React + Vite)    Desktop (Electron)    Phones (Capacitor)    Tablets (Capacitor)
            \                  |                     |                    /
             \_________ HTTPS + WebSocket to your Oruinwan server _______/
                                       |
              ┌────────────────────────▼────────────────────────┐
              │  server/   Express 5 + Socket.IO                 │
              │            also serves the built web app (dist/) │
              └──┬────────────┬────────────┬────────────┬────────┘
                 │            │            │            │
           PostgreSQL     MongoDB        Redis        ai/  ──► model providers
           + pgvector                  (optional)
                       S3-compatible object storage for uploads
```

| Part | What it is |
|---|---|
| `server/` | Express 5 + Socket.IO API. Runs PostgreSQL migrations on boot and serves the web app's production build from `dist/`. |
| `client/` | React 19 + Vite web app. The same code also builds the desktop and tablet app (`vite build --mode app`, output `client/dist-app`) and the product website (`vite build --mode site`, output `client/dist-site`). |
| `desktop/` | Electron shell for macOS, Windows and Linux that loads the client's app build. See [desktop/README.md](desktop/README.md). |
| `mobile/` | Capacitor app for Android and iOS: a phone-first UI on phones, and the client's app build on tablets and iPads. See [mobile/README.md](mobile/README.md). |
| `ai/` | AI provider layer: agents, tools, memory and providers (Anthropic, OpenAI, Gemini, xAI and any OpenAI-compatible model server). Runs inside the API process by default, or as its own service when `AI_SERVICE_URL` is set. See [ai/README.md](ai/README.md). |
| `platform/` | Code shared by the web client and server: API client, socket client and event names. |
| `e2e/` | Playwright end-to-end tests. |

### Data stores

| Store | Used for | Required |
|---|---|---|
| **PostgreSQL 16 + pgvector** | Identity (users, companies, workspaces, memberships, keys, sessions), tasks, audit logs, AI knowledge embeddings and the event outbox. Migrations in `server/db/migrations` run on boot. | Yes |
| **MongoDB 7** | Messages, channels and other documents such as notes and notifications | Yes |
| **Redis 7** | Socket.IO fan-out, shared presence and live huddles, scheduled-job locks, and the event stream across server instances | Only when running more than one server process |
| **S3-compatible storage** | File uploads. Locally the `s3` service in `docker-compose.yml`; without `S3_*` the server falls back to local disk (development only) | Yes in production |

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SCALING.md](docs/SCALING.md).

---

## Local development

### Prerequisites

- Node.js 22 or newer and [Yarn 1](https://classic.yarnpkg.com)
- Docker with Compose
- Optional: [Ollama](https://ollama.com) for the built-in AI

### 1. Install

```bash
git clone https://github.com/thrishankkuntimaddi/Oruniwan.git
cd Oruniwan
yarn install          # installs the client, server and e2e workspaces
```

### 2. Start PostgreSQL, Redis, S3 storage and MongoDB

```bash
docker compose --profile mongo up -d
```

Leave out `--profile mongo` if you use a hosted MongoDB.

### 3. Create the env files

| Copy | To | For |
|---|---|---|
| `server/.env.example` | `server/.env` | The API server (required) |
| `client/.env.example` | `client/.env` | The web app, and the desktop/tablet and website builds |
| `mobile/.env.example` | `mobile/.env` | The phone app (only if you work on `mobile/`) |

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

In `server/.env`, generate fresh values for `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `SERVER_KEK` and `CRYPTO_KEK_V1` (each key must be exactly 64 hex characters):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then point the server at your local services:

```bash
MONGO_URI=mongodb://127.0.0.1:27017/oruinwan
DATABASE_URL=postgres://oruinwan:oruinwan-dev@localhost:5432/oruinwan
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8080
GOOGLE_CLIENT_ID=placeholder        # or a real client id to use Google sign-in
```

The S3, Redis and AI defaults in `server/.env.example` already match `docker-compose.yml` and a local Ollama. To work without a real inbox, set `DEV_MAIL=console`: verification codes and invitations are printed in the server console.

### 4. Optional: start the AI engine

```bash
ollama serve &
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
```

### 5. Run

```bash
yarn build        # build the web app once into dist/ (yarn dev serves this build)
yarn dev          # API on http://localhost:8080 and the web app on http://localhost:3000
```

| Command | What it does |
|---|---|
| `yarn dev:all` | Starts local MongoDB and Ollama if needed, then `yarn dev` |
| `yarn dev:status` | Shows which services are running |
| `yarn server` | The API alone, with nodemon |
| `yarn workspace client start` | The web app with hot reload (Vite dev server) |

The web app proxies `/api` to the API on `localhost:8080`. The full guide, including troubleshooting, is in [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).

---

## Tests

| Package | Command | Runner |
|---|---|---|
| Server, `ai/` and SDK | `yarn workspace server test` | Jest (the server config also runs the `ai/` and `sdk/` suites) |
| Web client | `yarn workspace client test` | Vitest |
| Server and web client together | `yarn test` | |
| Phone app | `cd mobile && npm test` | Vitest |
| End-to-end | `yarn test:e2e` | Playwright |
| Lint | `yarn lint` (server, client, `ai/`, SDK); `cd mobile && npm run lint` | ESLint |

The end-to-end suite needs PostgreSQL and MongoDB running (for example from `docker compose --profile mongo up -d`). It starts its own API and web app against throwaway `_e2e` databases. Run `yarn playwright install chromium` inside `e2e/` once if Chromium isn't installed.

GitHub Actions runs lint, tests, the web build and the end-to-end suite on every push to `main` and every pull request (`.github/workflows/ci.yml`), and lints, tests and builds the apps in `.github/workflows/apps.yml`.

---

## Builds

App builds have the server address fixed at build time through `VITE_SERVER_URL`; the apps never ask users for a server address. Set it in `client/.env` (desktop and tablet) and `mobile/.env` (phone) before building.

### Web

```bash
yarn build        # client production build into dist/, served by the API server
```

The product website is a separate build of the client, deployed to GitHub Pages from `main` by `.github/workflows/web.yml`:

```bash
cd client && npx vite build --mode site     # output: client/dist-site
```

### Desktop (macOS, Windows, Linux)

```bash
cd desktop && npm install
npm run build:mac      # .dmg
npm run build:win      # Windows NSIS installer
npm run build:linux    # AppImage and .deb
```

Each command first builds the client in app mode (`vite build --mode app`) and bundles it. During development, run `npx vite --mode app` in `client/` and `npm start` in `desktop/`. See [desktop/README.md](desktop/README.md).

### Android APK

```bash
cd mobile && npm install
npm run android:debug      # android/app/build/outputs/apk/debug/app-debug.apk
npm run android:release    # release build (needs the release signing key)
```

The APK contains both the phone UI and the client's app build for Android tablets. `./scripts/release-local.sh` in `mobile/` builds a signed release APK locally.

### iOS

iOS builds need a Mac with Xcode:

```bash
cd mobile
npm run build && npm run assemble && npx cap sync ios
open ios/App/App.xcodeproj
```

During testing, iOS builds are distributed through TestFlight.

### Releases

Pushing a `vX.Y.Z` tag runs `.github/workflows/apps.yml`, which builds the signed Android APK and the desktop installers, publishes them together in one GitHub Release with `latest.json` (used by the in-app updaters), and uploads the iOS build to TestFlight when the Apple signing secrets are configured. Release steps and the required repository secrets are in [mobile/README.md](mobile/README.md).

---

## Deployment

Oruinwan is deployed on AWS. There is no production domain yet, so nothing in this repository assumes one: configure the public address of **your Oruinwan server** through environment variables (`FRONTEND_URL`, `BACKEND_URL`, `VITE_SERVER_URL`, `VITE_WEB_APP_URL`).

The smallest production setup is one server process running everything. The root `Dockerfile` builds a single image containing the API, the AI module, the migrations and the web app; `docker-compose.yml` can run it (profile `app`) next to PostgreSQL, Redis, S3 storage and MongoDB:

```bash
docker compose --profile mongo --profile app up -d --build
```

The `app` service reads `server/.env` and listens on port 8080. Set `APP_URL` (the public address of your Oruinwan server), `POSTGRES_PASSWORD` and `S3_SECRET_KEY` in a `.env` next to `docker-compose.yml`, or `APP_MONGO_URI` to use a hosted MongoDB. To enable Google sign-in on the web, pass `VITE_GOOGLE_CLIENT_ID` as a build argument. Create the first platform admin with `docker compose exec app node scripts/createChttrixAdmin.js`.

Without Docker: build the web app with `yarn install && yarn build`, then start the server from `server/` with `NODE_ENV=production node server.js`. It serves the API and the web app from one origin.

Production checklist:

- `NODE_ENV=production`, with all secrets freshly generated and the development passwords from `docker-compose.yml` changed
- `FRONTEND_URL` matches the public web address exactly
- PostgreSQL (with pgvector), MongoDB and, for more than one process, Redis reachable from every server process
- `S3_*` set so every process shares the same uploads (on AWS, an S3 bucket)
- Email configured, with the sender domain authenticated (SPF and DKIM)
- A TLS-terminating load balancer or reverse proxy in front, with WebSocket upgrades enabled
- A TURN server configured if users are behind strict firewalls

Production templates: `server/.env.production.template` and `client/.env.production.template`. To scale out, set `REDIS_URL` and run more instances, or split them by `PROCESS_ROLE`; see [docs/SCALING.md](docs/SCALING.md).

---

## Environment variables

Each `.env.example` documents every variable it uses. The key ones:

### Server (`server/.env`)

| Group | Variables | Notes |
|---|---|---|
| Required at boot | `MONGO_URI`, `DATABASE_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, `SERVER_KEK` | The server exits if any is missing |
| URLs | `BACKEND_URL`, `CORS_EXTRA_ORIGINS` | Public API address; extra allowed web origins |
| Encryption | `SERVER_KEK`, `CRYPTO_KEK_ACTIVE_VERSION`, `CRYPTO_KEK_V1`, `CRYPTO_KEK_V2` | `SERVER_KEK` is the server master key that protects the escrowed conversation keys and other sealed server secrets. Each key is exactly 64 hex characters |
| Storage | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE` | The bucket is created on boot if missing |
| Scaling | `REDIS_URL`, `PROCESS_ROLE` | Any role other than `all` needs Redis |
| Email | `BREVO_API_KEY`, `EMAIL_FROM`, `SMTP_*`, `SMTP_FALLBACK_*`, `DEV_MAIL` | Tried in that order; `DEV_MAIL=console` for development |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | |
| Push notifications | `FIREBASE_SERVICE_ACCOUNT` (Android), `APNS_*` (iOS) | Optional |
| AI | `AI_PROVIDER`, `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_MODEL`, `LOCAL_EMBED_MODEL`, `AI_SERVICE_URL`, `AI_SERVICE_TOKEN` | Default provider is `local_llm` |
| Huddles | `CLOUDFLARE_TURN_*`, or `TURN_URLS` with `TURN_SECRET` or `TURN_USERNAME`/`TURN_CREDENTIAL`; `HUDDLE_MAX_PARTICIPANTS` | Configure one TURN source |
| Integrations | `INTEGRATIONS_PUBLIC_URL`, `GITHUB_API_URL` | Optional server-wide settings; credentials are entered in the app |
| Feature flags | `FEATURES_ENABLED` | Comma list of `billing`, `sso`, `integrations`, `community`, or `all` |
| Retention | `AUDIT_LOG_RETENTION_DAYS`, `HISTORY_LOG_RETENTION_DAYS`, `ACTIVITY_RETENTION_DAYS`, `SECURITY_AUDIT_RETENTION_DAYS` | `0` keeps logs forever |

### Web client (`client/.env`)

Every `VITE_` value is bundled into the browser build, so never put secrets here.

| Variable | Used by | Meaning |
|---|---|---|
| `VITE_API_URL`, `VITE_BACKEND_URL` | Web build | API and server address for local development |
| `VITE_GOOGLE_CLIENT_ID` | Web build | Google sign-in |
| `VITE_SERVER_URL` | App build (`--mode app`: desktop and tablet) | The Oruinwan server the app talks to, fixed at build time. The apps don't ask for a server address. Empty: `VITE_BACKEND_URL` |
| `VITE_WEB_APP_URL` | Product website (`--mode site`) | Where "Log in" and "Get started" open, in a new tab. When empty, the site keeps its fallback (links stay in the same tab and point to a local web app) |

### Phone app (`mobile/.env`)

| Variable | Meaning |
|---|---|
| `VITE_SERVER_URL` | The Oruinwan server the phone app talks to, fixed at build time. Empty: `http://localhost:8080` |
| `VITE_UPDATE_MANIFEST_URL` | Where the Android app looks for newer builds; defaults to `latest.json` on the newest GitHub release |
| `VITE_FIREBASE_*` | Optional Firebase web config for Remote Config |
| `ORUINWAN_WEB_HOST` | Native build setting (not bundled): the web app's host, so invitation links open the phone app |

---

## Security and privacy

- **End-to-end encrypted messages.** Messages are encrypted between devices with a key for each conversation.
- **Key escrow.** The server also keeps an escrowed copy of each conversation key, protected by a server master key (`SERVER_KEK`). This lets AI agents answer in encrypted conversations, and lets people regain access to their conversations after a password reset. Anyone who controls both the server's database and `SERVER_KEK` could therefore decrypt conversations, so protect that key accordingly.
- **In transit and at rest.** Traffic is encrypted in transit with TLS, and data is encrypted at rest.
- **Admins.** Message content is never shown to workspace or company admins, and admins never see message counts.
- **No individual tracking.** Oruinwan has no per-person activity metrics.
- **Accounts.** Passwords are hashed; accounts can add passkeys and two-factor authentication.

Found a vulnerability? Please report it privately through [GitHub security advisories](https://github.com/thrishankkuntimaddi/Oruniwan/security/advisories/new) rather than in a public issue.

---

## Contributing

1. Create a branch, for example `feat/recurring-tasks`.
2. Make your change and run `yarn lint && yarn test`.
3. Write commits in the [Conventional Commits](https://www.conventionalcommits.org) style, for example `feat(tasks): add recurring tasks`.
4. Open a pull request describing what changed and how you tested it.

Backend code follows the feature-module layout in `server/src/features` and `server/src/modules`; new PostgreSQL changes go in a new numbered migration.

---

## License

Released under the [MIT License](LICENSE). Copyright © 2025-2026 Oruinwan Inc.
