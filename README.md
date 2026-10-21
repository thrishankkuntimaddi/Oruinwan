<div align="center">

<img src="client/public/icons/oruinwan-192.png" alt="Oruinwan logo" width="80" height="80" />

# Oruinwan

**The free, open-source workspace for teams: chat, tasks, notes, huddles and AI, on web, desktop, phone and tablet.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/thrishankkuntimaddi/Oruinwan/actions/workflows/ci.yml/badge.svg)](https://github.com/thrishankkuntimaddi/Oruinwan/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/thrishankkuntimaddi/Oruinwan)](https://github.com/thrishankkuntimaddi/Oruinwan/releases/latest)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)

[Website](https://thrishankkuntimaddi.github.io/Oruinwan/) · [Pricing](https://thrishankkuntimaddi.github.io/Oruinwan/pricing) · [Download the apps](https://github.com/thrishankkuntimaddi/Oruinwan/releases/latest) · [Report a bug](https://github.com/thrishankkuntimaddi/Oruinwan/issues) · [Local development guide](docs/LOCAL_DEVELOPMENT.md)

<img src="mobile/play-store/feature-graphic.png" alt="Oruinwan: one workspace, every conversation" width="720" />

</div>

---

## Contents

- [What Oruinwan is](#what-oruinwan-is)
- [Features](#features)
- [Plans](#plans)
- [Download](#download)
- [Self-hosting](#self-hosting)
- [Configurable limits](#configurable-limits)
- [Development](#development)
- [Project structure](#project-structure)
- [Tests](#tests)
- [Builds and releases](#builds-and-releases)
- [Updates](#updates)
- [Environment variables](#environment-variables)
- [Security and privacy](#security-and-privacy)
- [Contributing](#contributing)
- [Documentation](#documentation)
- [License](#license)

---

## What Oruinwan is

Oruinwan is a workspace for teams. Each **workspace** has public and private channels, direct messages, threads, huddles and meetings, tasks and planning, notes and a knowledge base, files, AI agents, automations and integrations. Companies can also register for a **company console** with departments, roles, permissions and audit logs.

It runs in the browser, as a desktop app for macOS, Windows and Linux, and as an app for Android phones and tablets (with split and wide layouts on larger screens). On iPhone and iPad, use the web app. Every app talks to one Oruinwan server, which you can use as a hosted service or run yourself.

Oruinwan is free and MIT-licensed. The Free plan has every feature; Pro and Enterprise plans are coming soon.

---

## Features

### Chat
- Public and private channels and direct messages
- Messages encrypted on your device with a key for each conversation (see [Security and privacy](#security-and-privacy))
- Threads, reactions, mentions, pins, polls, search and file sharing
- Split view on desktop and tablet: two conversations, or a conversation and a thread, side by side

### Huddles and meetings
- Audio and video calls with screen sharing and raise hand, started in one click or scheduled ahead
- One meeting page before, during and after every call: agenda, notes, recording, live transcript and captions
- An AI recap after the call, from its transcript

### Tasks and planning
- Tasks straight from messages, with owners, due dates, boards and progress
- Planning views and design reviews with comments on the work itself

### Notes and knowledge
- Notes with live co-editing, templates and a roadmap
- Files and a knowledge base the AI can search

### AI
- The AI assistant with your choice of model: Claude, ChatGPT, Gemini, Grok, or any model you host (Ollama or any OpenAI-compatible server)
- Agents installed for a whole workspace by an admin, or connected personally with your own API key
- Summaries, drafts, rewrites, tasks from threads and meeting recaps

### Integrations and automations
- GitHub, GitLab, Bitbucket, Jira, Linear, Slack, Microsoft Teams, Zoom, Google Drive, OneDrive, Dropbox, CI/CD and incoming webhooks, connected with a personal token or a webhook URL
- Automations with triggers, conditions, schedules and actions

### Accounts and administration
- Email and password or Google sign-in, email verification, passkeys and two-factor authentication
- Workspace admin (members, invitations, channels, feature switches) and the company console (departments, people, roles, permissions, audit logs)
- Optional encrypted backup to your own Google Drive
- Admins never see message content or message counts, and Oruinwan keeps no per-person activity metrics

---

## Plans

| | **Free** · available now | **Pro** · coming soon | **Enterprise** · coming soon |
|---|---|---|---|
| Who it's for | Small teams, every feature | Growing teams | Organisations |
| Signed-in devices | Up to 4 per person | Up to 4 per person | Up to 4 per person |
| Workspaces | Create 2, join 2 | More | Custom |
| Members per workspace | Owner + 10 | More | Custom |
| Channels | 10 besides the ones made with the workspace (#general, #random, your project) | More | Custom |
| Huddles | Up to 10 people, 30 minutes | Longer calls, more people | Custom |
| Notes | 2 per template, blank notes unlimited | More | Custom |
| Tasks | 300 active per workspace; 30 for yourself + 30 assigned per person | More | Custom |
| AI requests | 50 per person per day, 300 per workspace per day | More | Custom |
| Backup | Encrypted backup to your Google Drive | ✓ | ✓ |
| Admin controls, SSO, compliance | | | ✓ |

Prices for Pro and Enterprise aren't set yet. To hear when they launch, email [admin@poelys.com](mailto:admin@poelys.com?subject=Notify%20me%3A%20Oruinwan%20Pro). The limits apply to individual accounts; company accounts and company workspaces are not limited (the device limit doesn't depend on the plan, and company accounts have none unless `COMPANY_DEVICE_LIMIT` is set). On your own server you can change or remove them ([Configurable limits](#configurable-limits)).

---

## Download

Every release has the same file names, so these links always fetch the newest version:

| Platform | Download |
|---|---|
| Mac (Apple Silicon) | [Oruinwan-Mac-AppleSilicon.dmg](https://github.com/thrishankkuntimaddi/Oruinwan/releases/latest/download/Oruinwan-Mac-AppleSilicon.dmg) |
| Mac (Intel) | [Oruinwan-Mac-Intel.dmg](https://github.com/thrishankkuntimaddi/Oruinwan/releases/latest/download/Oruinwan-Mac-Intel.dmg) |
| Windows 10 / 11 | [Oruinwan-Windows-Setup.exe](https://github.com/thrishankkuntimaddi/Oruinwan/releases/latest/download/Oruinwan-Windows-Setup.exe) |
| Linux (any distribution) | [Oruinwan-Linux.AppImage](https://github.com/thrishankkuntimaddi/Oruinwan/releases/latest/download/Oruinwan-Linux.AppImage) |
| Linux (Debian, Ubuntu) | [Oruinwan-Linux.deb](https://github.com/thrishankkuntimaddi/Oruinwan/releases/latest/download/Oruinwan-Linux.deb) |
| Android phones and tablets | [Oruinwan-Android.apk](https://github.com/thrishankkuntimaddi/Oruinwan/releases/latest/download/Oruinwan-Android.apk) |
| iPhone and iPad | Use the web app in Safari |

The release page lists SHA-256 checksums and install notes (the Mac and Windows builds aren't notarized or code-signed yet). Once installed, the apps tell you when an update is ready ([Updates](#updates)).

---

## Self-hosting

The root `Dockerfile` builds one image with the API, the AI module, the migrations and the web app. `docker-compose.yml` runs it next to PostgreSQL (with pgvector), Redis, S3-compatible storage and MongoDB.

```bash
git clone https://github.com/thrishankkuntimaddi/Oruinwan.git
cd Oruinwan
cp server/.env.example server/.env      # then fill in the secrets below
docker compose --profile mongo --profile app up -d --build
```

Oruinwan is then on **http://localhost:8080**.

1. In `server/.env`, generate fresh `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `SERVER_KEK` and `CRYPTO_KEK_V1` (each exactly 64 hex characters):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. In a `.env` next to `docker-compose.yml`, set `APP_URL` (the public `https://` address; sign-in cookies need HTTPS anywhere but localhost), `POSTGRES_PASSWORD` and `S3_SECRET_KEY`. Use `APP_MONGO_URI` for a hosted MongoDB instead of the `mongo` service.
3. Configure email (`BREVO_API_KEY` or `SMTP_*`; `DEV_MAIL=console` prints codes to the log while testing).
4. Optional: `VITE_GOOGLE_CLIENT_ID` as a build argument for Google sign-in on the web, a TURN server for huddles behind strict firewalls, and an AI provider (`AI_PROVIDER`; the default is a local model through Ollama).
5. Create the first platform admin: `docker compose exec app node scripts/createOruinwanAdmin.js`.

Without Docker: `yarn install && yarn build`, then `NODE_ENV=production node server.js` in `server/`. The server serves the API and the web app from one origin.

Production checklist:

- `NODE_ENV=production`, all secrets freshly generated and the development passwords from `docker-compose.yml` changed
- `FRONTEND_URL` matches the public web address exactly
- PostgreSQL (with pgvector), MongoDB and, for more than one process, Redis reachable from every server process
- `S3_*` set so every process shares the same uploads
- Email sender domain authenticated (SPF and DKIM)
- TLS in front (load balancer or reverse proxy) with WebSocket upgrades enabled

Production templates: `server/.env.production.template` and `client/.env.production.template`. To scale out, set `REDIS_URL` and run more instances, or split them by `PROCESS_ROLE`; see [docs/SCALING.md](docs/SCALING.md).

The desktop and phone apps connect to the server they were built for (`VITE_SERVER_URL`), so a self-hosted server needs its own app builds ([Builds and releases](#builds-and-releases)), or its users use the web app.

---

## Configurable limits

The Free plan limits live in one server-side configuration, so a self-hosted server can change them:

| Variable | Effect |
|---|---|
| `PLAN_LIMITS_JSON` | JSON that overrides individual plan limits (workspaces, members, channels, huddle size and length, notes, tasks, AI requests); the keys are documented in `server/.env.example` |
| `DEVICE_LIMIT` | How many devices one account can be signed in on at once (default 4) |
| `ORUINWAN_UNLIMITED` | `true` turns every plan limit off |

Workspaces that were already over a limit when it was introduced keep working; they just can't grow further.

---

## Development

### Prerequisites

- Node.js 22 or newer and [Yarn 1](https://classic.yarnpkg.com)
- Docker with Compose
- Optional: [Ollama](https://ollama.com) for the built-in AI

### Run everything

```bash
git clone https://github.com/thrishankkuntimaddi/Oruinwan.git
cd Oruinwan
yarn install                         # client, server and e2e workspaces
cp server/.env.example server/.env   # generate the secrets as in Self-hosting
cp client/.env.example client/.env
docker compose up -d                 # PostgreSQL, Redis and S3 storage (add --profile mongo for a local MongoDB)
yarn build                           # build the web app once (yarn dev serves this build)
yarn dev:all                         # starts local MongoDB and Ollama if needed, then the API and web app
```

The API is on http://localhost:8080 and the web app on http://localhost:3000 (it proxies `/api` to the API). Point `server/.env` at your local services:

```bash
MONGO_URI=mongodb://127.0.0.1:27017/oruinwan
DATABASE_URL=postgres://oruinwan:oruinwan-dev@localhost:5432/oruinwan
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8080
GOOGLE_CLIENT_ID=placeholder        # or a real client id to use Google sign-in
DEV_MAIL=console                    # verification codes and invitations in the server console
```

| Command | What it does |
|---|---|
| `yarn dev:all` | Starts local MongoDB and Ollama if needed, then `yarn dev` |
| `yarn dev` | The API and the web app |
| `yarn dev:status` | Shows which services are running |
| `yarn server` | The API alone, with nodemon |
| `yarn workspace client start` | The web app with hot reload (Vite dev server) |
| `cd mobile && npm install && npm run dev` | The phone and tablet UI in a browser |
| `cd client && npx vite --mode app`, then `cd desktop && npm start` | The desktop app against the dev server |

For the built-in AI: `ollama pull qwen2.5:3b && ollama pull nomic-embed-text`. The full guide, including troubleshooting, is [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).

---

## Project structure

```
  Web (React + Vite)    Desktop (Electron)    Android phones & tablets (Capacitor)
            \                  |                     /
             \_____ HTTPS + WebSocket to your Oruinwan server _____/
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

| Folder | What it is |
|---|---|
| `server/` | Express 5 + Socket.IO API: features in `server/src/features`, core modules in `server/src/modules`. Runs PostgreSQL migrations on boot and serves the web app's build. |
| `client/` | React 19 + Vite web app. The same code builds the desktop app (`vite build --mode app`) and the product website (`vite build --mode site`). |
| `desktop/` | Electron shell for macOS, Windows and Linux around the client's app build. See [desktop/README.md](desktop/README.md). |
| `mobile/` | Capacitor app for Android (and iOS): its own phone UI, with split and wide layouts on tablets. See [mobile/README.md](mobile/README.md). |
| `ai/` | AI layer: agents, tools, memory and providers (Anthropic, OpenAI, Gemini, xAI and any OpenAI-compatible server). See [ai/README.md](ai/README.md). |
| `platform/` | Code shared by the web client and server: API client, socket client and event names. |
| `sdk/` | The public API SDK. |
| `e2e/` | Playwright end-to-end tests. |
| `docs/` | Architecture, scaling, integrations and API documentation. |

| Store | Used for | Required |
|---|---|---|
| **PostgreSQL 16 + pgvector** | Identity, tasks, audit logs, AI embeddings and the event outbox | Yes |
| **MongoDB 7** | Messages, channels, notes, notifications and other documents | Yes |
| **Redis 7** | Socket.IO fan-out, presence, live huddles, job locks | Only with more than one server process |
| **S3-compatible storage** | File uploads (falls back to local disk in development) | Yes in production |

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SCALING.md](docs/SCALING.md).

---

## Tests

| Package | Command | Runner |
|---|---|---|
| Server, `ai/` and SDK | `yarn workspace server test` | Jest |
| Web client | `yarn workspace client test` | Vitest |
| Server and web client together | `yarn test` | |
| Phone app | `cd mobile && npm test` | Vitest |
| Desktop app | `cd desktop && npm test` | Node test runner |
| End-to-end | `yarn test:e2e` | Playwright |
| Lint | `yarn lint`; `cd mobile && npm run lint` | ESLint |

The end-to-end suite needs PostgreSQL and MongoDB running; it starts its own API and web app against throwaway `_e2e` databases. GitHub Actions runs lint, tests, builds and the end-to-end suite on every push to `main` and every pull request (`.github/workflows/ci.yml` and `apps.yml`).

---

## Builds and releases

App builds have the server address fixed at build time through `VITE_SERVER_URL` (in `client/.env` for desktop, `mobile/.env` for the phone app); the apps never ask for a server address.

```bash
yarn build                                   # web app into dist/, served by the API server
cd client && npx vite build --mode site      # product website (GitHub Pages, .github/workflows/web.yml)

cd desktop && npm install
npm run build:mac | build:win | build:linux  # .dmg, NSIS installer, AppImage + .deb

cd mobile && npm install
npm run android:debug                        # debug APK
npm run android:release                      # release APK (needs the release signing key)
npm run android:play                         # Google Play bundle
```

Pushing a `vX.Y.Z` tag runs `.github/workflows/apps.yml`: it builds the signed Android APK and the desktop installers and publishes them in one GitHub Release with `latest.json`. Release steps and the required repository secrets are in [mobile/README.md](mobile/README.md).

---

## Updates

- The desktop and Android apps read `latest.json` from the newest GitHub release when they start and every 6 hours. When a newer version exists they show a toast and a card in Notifications (phone: on Home); **Settings → About & updates** (phone: **Settings → Updates**) shows your versions, *Check for updates* and the release notes.
- Most releases only change the app's interface. Those ship as a signed **UI bundle** that the app downloads, verifies and restarts into: one click on *Update and restart*, no reinstall. If the new interface fails to start, the app goes back to the last one that worked.
- Bundles are signed with Ed25519. CI signs them with the `ORUINWAN_UPDATE_SIGNING_KEY` secret (a PKCS#8 PEM private key, or a base64 32-byte seed); the matching public key is in `platform/update-public-key.txt` and is built into the apps. Without the secret CI publishes the bundles unsigned, and the apps refuse them and offer the full download.
- Releases that change the native app (new plugins, a new Electron version) raise the minimum in `platform/native-shells.json`; older installs are then offered the full installer instead.
- iPhone and iPad builds update through the App Store / TestFlight.
- The web app shows *A new version is available — Reload* after a new deploy.

Details and key setup: [docs/UPDATES.md](docs/UPDATES.md).

---

## Environment variables

Each `.env.example` documents every variable it uses. The key ones:

### Server (`server/.env`)

| Group | Variables | Notes |
|---|---|---|
| Required at boot | `MONGO_URI`, `DATABASE_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, `SERVER_KEK` | The server exits if any is missing |
| URLs | `BACKEND_URL`, `CORS_EXTRA_ORIGINS` | Public API address; extra allowed web origins |
| Encryption | `SERVER_KEK`, `CRYPTO_KEK_ACTIVE_VERSION`, `CRYPTO_KEK_V1`, `CRYPTO_KEK_V2` | `SERVER_KEK` is the server master key that protects the sealed keys and other server secrets. Each key is exactly 64 hex characters |
| Storage | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE` | The bucket is created on boot if missing |
| Scaling | `REDIS_URL`, `PROCESS_ROLE` | Any role other than `all` needs Redis |
| Email | `BREVO_API_KEY`, `EMAIL_FROM`, `SMTP_*`, `SMTP_FALLBACK_*`, `DEV_MAIL` | Tried in that order; `DEV_MAIL=console` for development |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | |
| Push notifications | `FIREBASE_SERVICE_ACCOUNT` (Android), `APNS_*` (iOS) | Optional |
| AI | `AI_PROVIDER`, `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_MODEL`, `LOCAL_EMBED_MODEL`, `AI_SERVICE_URL`, `AI_SERVICE_TOKEN` | Default provider is `local_llm` |
| Huddles | `CLOUDFLARE_TURN_*`, or `TURN_URLS` with `TURN_SECRET` or `TURN_USERNAME`/`TURN_CREDENTIAL`; `HUDDLE_MAX_PARTICIPANTS` | Configure one TURN source |
| Plan limits | `PLAN_LIMITS_JSON`, `DEVICE_LIMIT`, `ORUINWAN_UNLIMITED` | See [Configurable limits](#configurable-limits) |
| Integrations | `INTEGRATIONS_PUBLIC_URL`, `GITHUB_API_URL` | Optional server-wide settings; credentials are entered in the app |
| Feature flags | `FEATURES_ENABLED` | Comma list of `billing`, `sso`, `integrations`, `community`, or `all` |
| Retention | `AUDIT_LOG_RETENTION_DAYS`, `HISTORY_LOG_RETENTION_DAYS`, `ACTIVITY_RETENTION_DAYS`, `SECURITY_AUDIT_RETENTION_DAYS` | `0` keeps logs forever |

### Web client (`client/.env`)

Every `VITE_` value is bundled into the browser build, so never put secrets here.

| Variable | Used by | Meaning |
|---|---|---|
| `VITE_API_URL`, `VITE_BACKEND_URL` | Web build | API and server address for local development |
| `VITE_GOOGLE_CLIENT_ID` | Web build | Google sign-in |
| `VITE_SERVER_URL` | App build (desktop) | The Oruinwan server the app talks to, fixed at build time |
| `VITE_WEB_APP_URL` | Product website | Where "Log in" and "Get started" open, in a new tab |

### Phone app (`mobile/.env`)

| Variable | Meaning |
|---|---|
| `VITE_SERVER_URL` | The Oruinwan server the app talks to, fixed at build time. Empty: `http://localhost:8080` |
| `VITE_UPDATE_MANIFEST_URL` | Where the app looks for updates; defaults to `latest.json` on the newest GitHub release |
| `VITE_FIREBASE_*` | Optional Firebase web config for Remote Config |
| `ORUINWAN_WEB_HOST` | Native build setting (not bundled): the web app's host, so invitation links open the app |

---

## Security and privacy

- **Encrypted messages.** Messages in channels and DMs are encrypted on your device with a key for each conversation (AES-256-GCM, wrapped for each member with their RSA-OAEP key), and stay encrypted in transit and at rest. The server keeps a protected copy of each conversation key so AI agents can post and people can recover their account, so this is not zero-knowledge: whoever runs the server and holds its keys could decrypt messages. Attachments are not encrypted on the device.
- **A sealed key on the server, stated plainly.** Oruinwan's server keeps a sealed copy of your key and of each conversation key, protected by the server master key (`SERVER_KEK`). That is what lets your devices unlock automatically after you sign in, lets AI agents answer in encrypted conversations, and lets you keep access after a password reset. Anyone who controls both the server's database and `SERVER_KEK` could therefore decrypt conversations. If you want to hold that key yourself, self-host.
- **Admins.** Message content is never shown to workspace or company admins, and admins never see message counts.
- **No individual tracking.** Oruinwan has no per-person activity metrics.
- **Accounts.** Passwords are hashed; accounts can add passkeys and two-factor authentication.
- **Updates.** App UI bundles are verified against an Ed25519 key built into the apps before they are loaded.

Found a vulnerability? Please report it privately through [GitHub security advisories](https://github.com/thrishankkuntimaddi/Oruinwan/security/advisories/new) rather than in a public issue.

---

## Contributing

Issues and pull requests are welcome.

1. Fork the repository and create a branch, for example `feat/recurring-tasks`.
2. Make your change, with tests, and run `yarn lint && yarn test` (plus `npm test` in `mobile/` or `desktop/` if you touched them).
3. Write commits in the [Conventional Commits](https://www.conventionalcommits.org) style, for example `feat(tasks): add recurring tasks`.
4. Open a pull request describing what changed and how you tested it.

Backend code follows the feature-module layout in `server/src/features` and `server/src/modules`; new PostgreSQL changes go in a new numbered migration. UI changes keep the existing "Monolith Gloss" theme (`client/src/styles/gloss.css`) in light and dark.

---

## Documentation

- [docs/PRODUCT_MAP.md](docs/PRODUCT_MAP.md): how every feature links, what runs underneath, and the ranked gaps
- [docs/TEAM_WALKTHROUGH.md](docs/TEAM_WALKTHROUGH.md): a 5-person team uses everything for a week, GitHub and Jira included
- [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): running the whole stack locally
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SCALING.md](docs/SCALING.md): how it fits together and how to scale it
- [docs/UPDATES.md](docs/UPDATES.md): in-app updates and update signing
- [docs/integrations.md](docs/integrations.md): connecting other tools
- [docs/api/](docs/api/): API reference by area
- [desktop/README.md](desktop/README.md), [mobile/README.md](mobile/README.md), [ai/README.md](ai/README.md)

---

## License

Released under the [MIT License](LICENSE). Copyright © 2025-2026 Oruinwan Inc.
