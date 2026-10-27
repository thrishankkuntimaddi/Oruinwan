# Oruinwan — High-Level Design (HLD)

How the system is put together: the parts, where they run, how data moves and the main design
decisions. For module- and file-level detail see the [LLD](LLD.md); for what the product does see
the [PRD](PRD.md).

---

## 1. System context

```
            ┌────────────── People ──────────────┐
            │ Web · Desktop · Android · iPhone ·  │
            │ phone browser (/m/)                 │
            └──────┬──────────────────────┬───────┘
          HTTPS (REST)              WebSocket (Socket.IO)        WebRTC (media, peer to peer / TURN)
                   │                      │                               │
        ┌──────────▼──────────────────────▼──────────┐          ┌─────────▼────────┐
        │  Oruinwan server (Node.js, Express 5,       │          │ coturn (TURN)    │
        │  Socket.IO) — one process, several roles    │          └──────────────────┘
        └──┬──────────┬──────────┬──────────┬────────┘
           │          │          │          │
     PostgreSQL    MongoDB     Redis     S3-compatible storage
     (identity,    (messages,  (presence, (files, images,
      tasks, keys,  channels,   queues,    backups)
      plans)        notes …)    pub/sub)
           │
   External services: Firebase Cloud Messaging · Apple Push · Web Push · Brevo (email) ·
   AI providers (Anthropic / OpenAI / Gemini / local LLM) · Google (sign-in, Drive backup) ·
   GitHub, Jira and other integrations
```

## 2. Building blocks

| Block | Technology | Responsibility |
|---|---|---|
| **Web client** | React 19, Vite, React Router | The full product in the browser; also the desktop app's UI (`app` build mode). |
| **Desktop app** | Electron 44 | Wraps the web client; native notifications, tray, deep links, quick UI updates. |
| **Phone app** | React 19, Vite, Capacitor 8 | Android and iPhone apps; the same build is the phone website (`/m/`). Native plugins for calls, push, Google sign-in, updates. |
| **Server** | Node.js 22+, Express 5, Socket.IO 4 | REST API, realtime events, background jobs, uploads. Roles (`api`, `realtime`, `jobs`, `uploads`) can run in one process or be split (see [SCALING.md](SCALING.md)). |
| **AI subsystem** | `ai/` package (gateway, orchestrator, agents, memory) | Talks to the configured model provider; tools that act in the workspace. |
| **PostgreSQL 16 + pgvector** | | Identity (users, workspaces, members, sessions, devices), encryption keys, tasks, plans, audit, embeddings for AI search. |
| **MongoDB 7** | Mongoose | Messages, channels, DM sessions, notes, notifications, meetings and other document data. |
| **Redis 7** | | Presence, rate limits, Socket.IO adapter (multi-instance), job queues, short-lived state. |
| **Object storage** | S3 API (RustFS in production, any S3 elsewhere) | Uploaded files, profile and workspace images, encrypted attachments. |
| **TURN** | coturn | Relays call media when people can't connect directly. |
| **Reverse proxy** | Caddy | HTTPS certificates, routes `oruinwan.poelys.com` (web) and `api.oruinwan.poelys.com` (API) to the app. |

## 3. Deployment (production)

```
GitHub (repo: main + v* tags)
   ├─ Actions "CI": server tests, web tests + build, browser end-to-end tests (Playwright)
   ├─ Actions "Build apps": phone (Android APK + Play bundle, iOS), desktop installers,
   │                        UI bundles for quick updates → GitHub Release on v* tags
   └─ Actions "Deploy web app": the marketing/docs site to GitHub Pages

AWS EC2 (ap-south-1), Ubuntu, Docker Compose:
   caddy ─▶ app (Node server + built web client in dist/, phone web in dist/m/)
            postgres · mongo · redis · s3 (RustFS) · turn (coturn)
   Backups: database dumps before every deploy; daily EBS snapshots (7 kept).
```

- The web client is built on a workstation and copied to the server with the update script (the
  small server cannot build it); the server image is built on the server. A health check gates
  every deploy; a failed check rolls back to the previous image automatically.
- Database migrations for PostgreSQL run when the server starts (`server/db/migrations`); MongoDB
  indexes are created on start (or with `server/scripts/syncIndexes.js`).

## 4. Key flows

### 4.1 Sign-in and sessions
1. The client signs in (password, Google, passkey, QR from another device, or SSO).
2. The server returns a short-lived **access token** (JWT) and a **refresh token** (rotated on use;
   an httpOnly cookie on the web, a body field for native apps).
3. Every device is a session row; the device limit and 2FA are enforced at sign-in.
4. The device unlocks its **identity key** (below) with the password, or with a server-sealed key
   for Google accounts.

### 4.2 End-to-end encryption
- Each person has an **identity key pair** (X25519; older accounts RSA-OAEP). The private key is
  encrypted on the device with a **UMEK** derived from the password (PBKDF2). Google-only accounts
  have the UMEK sealed by the server's key-encryption key.
- Each conversation (channel, DM, group) has a **conversation key** (AES-256-GCM), wrapped for every
  member's identity key and stored on the server only in wrapped form.
- Messages are encrypted on the sender's device and decrypted on readers' devices. The server sees
  ciphertext, sender, time and the plaintext list of @mentions (needed for notifications).
- When someone leaves or is removed, the conversation gets a new key version (**key epochs**);
  people added later receive only the keys for the period they may read.

### 4.3 Sending a message
```
client ──encrypt──▶ POST /api/v2/messages/* or socket "send-message"
server: access check (conversationAccess) → send rules (sendRules.prepareSend)
      → store (MongoDB) → emit "new-message" / "thread-reply" to the conversation's rooms
      → notifications (activity, push) for people not looking at it
readers' clients ──decrypt──▶ show; mark read → "conversation:read" to the reader's other devices
```
REST and Socket.IO share one access rule and one send path, so they behave identically.

### 4.4 Notifications
- In-app: `conversation:activity` and `notification:*` events over Socket.IO; the client decides
  toast vs. silent based on what is on screen.
- Push: the server sends only when the person is not active anywhere; Firebase Cloud Messaging
  (Android), Apple Push (iPhone), Web Push (phone browsers). One notification per conversation
  (tag / collapse id). Message text stays encrypted, so pushes name the sender.

### 4.5 Calls
- Signalling over Socket.IO (`huddle:*` events); media over WebRTC, through TURN when needed.
- Ringing: socket event to open apps; a high-priority data push to Android so a closed app shows
  a native incoming-call screen; Apple Push alert on iPhone.

### 4.6 App updates
- **Quick updates:** the release publishes signed UI bundles; desktop and phone apps download,
  verify the signature, switch on next start and roll back if the new bundle fails to boot
  (see [UPDATES.md](UPDATES.md)).
- **Full updates:** new installers on GitHub Releases; the Google Play build is updated only by
  Play.

### 4.7 AI requests
- The client gathers the context the person can see (decrypting locally), sends the question to
  the server, the AI gateway calls the provider with tools scoped to the person's access, and the
  answer streams back over Socket.IO (`ai:reply`). Usage is metered per plan.

## 5. Data ownership

| Data | Store | Notes |
|---|---|---|
| Users, workspaces, members, roles, sessions, devices, passkeys | PostgreSQL | The identity "source of truth" (`server/src/identity`). |
| Conversation keys and epochs, identity public keys | PostgreSQL | Wrapped keys only. |
| Tasks, sprints, milestones, plans, billing, audit | PostgreSQL | |
| Messages, channels, DM sessions, notes, notifications, meetings, files metadata | MongoDB | Message bodies are ciphertext. |
| Files and images | Object storage | Paths under per-feature prefixes; access checked by the server. |
| Presence, rate limits, queues | Redis | Ephemeral. |

## 6. Security model (summary)

- Every REST route and socket event checks **active workspace membership** and conversation access
  through shared helpers; removing someone evicts their sockets immediately.
- Transport: HTTPS (Caddy, Let's Encrypt); HSTS; secure cookies.
- Secrets live only in the server's environment file (never in the repository); signing keys for
  apps and updates live in GitHub Actions secrets.
- Audit log and security events for sign-ins, admin actions and key changes.

## 7. Scalability

One EC2 instance today. The path: split roles into separate processes, add instances behind the
proxy with the Redis Socket.IO adapter, move databases to managed services, shard large tenants.
Details in [SCALING.md](SCALING.md).

## 8. Key decisions

| Decision | Why |
|---|---|
| Two databases (PostgreSQL + MongoDB) | Relational identity, keys and tasks need constraints and transactions; chat data is document-shaped and grows fast. |
| End-to-end encryption by default | Teams' conversations stay private even from the operator; trade-off: server-side search and push previews are limited. |
| One React codebase per surface (web/desktop share; phone separate) | Phone UX needs its own navigation and components; shared logic lives in `platform/`. |
| Capacitor for phones | One web codebase for Android, iPhone and the phone website, with native plugins where needed. |
| Quick UI updates outside the stores | Fixes reach people in minutes; stores still deliver native changes. |
| Self-hostable with Docker Compose | Organisations can own their data; every limit is configurable. |
