# Chttrix — AI-Augmented Collaboration Platform

> A full-stack, enterprise-grade real-time collaboration platform with end-to-end encryption, AI assistance, role-based access control, and multi-workspace support.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running Locally](#running-locally)
- [API Overview](#api-overview)
- [Security](#security)
- [Deployment](#deployment)
- [Scripts](#scripts)

---

## Overview

Chttrix is a production-ready, real-time collaboration platform built for organizations that need secure internal communication at scale. It supports company workspaces, department-scoped channels, direct messaging with end-to-end encryption, AI-powered features via Google Gemini, rich task and note management, and a full company administration suite.

The platform is structured as a **monorepo** with a `client` (React + Vite) and a `server` (Node.js + Express + Socket.IO), deployed independently to Vercel and Railway respectively.

---

## Tech Stack

### Frontend (`/client`)
| Technology | Version | Purpose |
|---|---|---|
| React | 19.1.x | UI framework |
| Vite | 6.x | Build tool & dev server |
| React Router DOM | 7.x | Client-side routing |
| Tailwind CSS | 3.4.x | Utility-first styling |
| Socket.IO Client | 4.8.x | Real-time WebSocket communication |
| Axios | 1.x | HTTP client |
| Recharts | 3.x | Analytics dashboards & charts |
| Lucide React | 0.525.x | Icon library |
| React Hot Toast | 2.x | Notifications |
| React Markdown | 10.x | Markdown rendering |
| React RnD | 10.x | Draggable/resizable UI panels |
| `@react-oauth/google` | 0.12.x | Google OAuth integration |
| `jwt-decode` | 4.x | JWT decoding on the client |
| `turndown` | 7.x | HTML → Markdown conversion |

### Backend (`/server`)
| Technology | Version | Purpose |
|---|---|---|
| Node.js + Express | 5.x | REST API server |
| Socket.IO | 4.8.x | Real-time bidirectional events |
| MongoDB + Mongoose | 8.x | Primary database (ODM) |
| Redis + ioredis | 5.x | Socket.IO horizontal scaling adapter |
| `@socket.io/redis-adapter` | 8.x | Multi-instance pub/sub for Socket.IO |
| JSON Web Tokens | 9.x | Access & refresh token authentication |
| bcryptjs | 3.x | Password hashing |
| Passport.js | 0.7.x | OAuth strategy middleware |
| `passport-github2` | 0.1.x | GitHub OAuth |
| `passport-linkedin-oauth2` | 2.x | LinkedIn OAuth |
| `google-auth-library` | 10.x | Google ID token verification |
| Helmet | 8.x | HTTP security headers |
| `express-rate-limit` | 8.x | Rate limiting |
| `express-validator` | 7.x | Input validation |
| Multer | 2.x | File upload handling |
| Nodemailer | 7.x | Transactional email |
| Twilio | 5.x | OTP SMS delivery |
| `@google/generative-ai` | 0.24.x | Gemini AI integration |

---

## Architecture

```
ChttrixCollab/
├── client/          # React + Vite SPA (deployed to Vercel)
├── server/          # Node.js + Express + Socket.IO API (deployed to Railway)
├── dist/            # Built client, served by server in production
├── vercel.json      # Vercel deployment config (client)
├── railway.json     # Railway deployment config (server)
├── nixpacks.toml    # Nixpacks build config (Railway)
└── package.json     # Root workspace (npm workspaces)
```

The server serves the built client (`dist/`) in production. In development, the Vite dev server runs on port 5173 and the API server runs on port 8080, with Vite proxying `/api` requests to the backend.

### Real-Time Layer
Socket.IO powers all real-time features (messaging, presence, typing indicators). When `REDIS_URL` is set, the `@socket.io/redis-adapter` enables horizontal scaling across multiple server instances via Redis pub/sub. Without Redis, the server runs in single-instance in-memory mode.

### End-to-End Encryption (E2EE)
Chttrix implements a layered E2EE architecture:
- **User identity keys**: ECDH key pairs generated per user (public key stored server-side, private key encrypted client-side with the user's password).
- **Conversation keys**: Per-conversation symmetric keys, encrypted with recipients' public keys.
- **Server KEK (Key Encryption Key)**: A 256-bit (32-byte / 64-char hex) AES-256 key (`SERVER_KEK`) used to wrap/unwrap workspace keys at rest. Validated on every server startup.
- **UMEK-based recovery**: Crypto identity recovery using User Master Encryption Keys.

---

## Features

### Authentication & Identity
- **Email/password** registration with email verification
- **Google OAuth** (one-click sign-in, ID token verification)
- **GitHub OAuth** via Passport.js
- **LinkedIn OAuth** via Passport.js
- **OTP verification** via Twilio SMS for phone-based flows
- **Refresh token rotation** with device-level session tracking
- **Account lockout** after failed login attempts
- **Password reset** via tokenized email links
- **Multi-email accounts** (multiple verified emails per user)

### Company & Organization Management
- **Company registration** with multi-step setup wizard (profile → departments → invites → complete)
- **Domain verification** (DNS TXT record) — verified domain enables auto-join policies
- **Application review** — admin approval flow for new company registrations
- **Role hierarchy**: `owner → admin → manager → member → guest`
- **Co-owner support** for shared top-level admin
- **Department management** — create, assign members, assign managers per department
- **Employee management** — employee categories (Full-time, Part-time, Contractor, Intern), job titles, direct reporting lines, and work history
- **Invite system** — email invites with role pre-assignment; invite acceptance flow
- **Billing plans**: `free`, `starter`, `professional`, `enterprise` with configurable seat limits, workspace quotas, and data retention policies

### Workspaces & Channels
- **Multi-workspace support** — company workspaces scoped to departments, plus personal workspaces
- **Workspace settings**: private/public, member invite permissions, admin approval, auto-archive inactive workspaces
- **Channels** within workspaces — with member role control (`owner`, `admin`, `member`)
- **Join workspace / Join channel** flows with invite link support

### Messaging
- **Real-time direct messages** (DMs) with Socket.IO
- **Channel messages** with full history
- **Message threads** — reply chains under messages
- **Internal messaging** for structured org-level broadcasts
- **Message polls** — create polls within chats
- **File uploads** — via Multer, served at `/uploads` behind authentication
- **Rich text** — Markdown rendering with `react-markdown` + `remark-breaks`
- **Typing indicators** and **read receipts** (configurable per user)
- **Favorites** — pin DMs and channels for quick access
- **Muted chats** — per-chat mute with optional duration
- **Blocked users** management

### End-to-End Encryption
- ECDH-based key exchange for DMs
- Per-conversation symmetric encryption keys
- Client-side private key storage (password-derived encryption)
- Server KEK-wrapped workspace keys
- Key distribution health audit — runs on startup and every 60 minutes
- Device-level key management and session revocation (`/api/v2/devices`)

### AI Features
- **Google Gemini** integration (`@google/generative-ai`)
- AI routes exposed at `/api/ai`

### Tasks
- Full task lifecycle: create, assign, update status, close
- Task activity log (`TaskActivity` model)
- Subtask support
- Available at `/api/tasks` and `/api/v2/tasks`

### Notes
- Rich notes with E2EE-ready storage
- Media attachment support (images/videos/audio as base64, up to 50 MB)
- Available at `/api/notes` and `/api/v2/notes`

### Analytics & Dashboards
- **Owner Dashboard** — company-wide metrics, growth charts (Recharts), seat usage
- **Manager Dashboard** — department-level views and team metrics
- **Admin Dashboard** — platform administration
- **Analytics routes** at `/api/analytics`
- `Analytics.js` model tracks structured platform events

### Search
- Global search across users, channels, and messages at `/api/search`

### Security & Audit
- **Helmet** — sets 14+ HTTP security headers
- **Rate limiting** — 20 req/min in production on auth endpoints (100 in development), excluding `/me`, `/refresh`, and `/users`
- **MongoDB injection sanitization** — strips `$` operators from all request bodies
- **Input validation** via `express-validator`
- **Security audit log** (`AuditLog` model) — recorded per sensitive action
- **Audit digest service** — generates hourly key distribution health reports
- **Security routes** at `/api/v2/security` and `/api/v2/audit`
- **Device session tracking** at `/api/v2/devices`
- **HTTPS redirect** enforced in production (301 redirect for HTTP requests behind proxy)

### User Profiles & Preferences
- Avatar / profile picture (via Google or upload)
- Bio, date of birth, address, resume URL
- Social links: LinkedIn, Twitter, GitHub, website
- Theme preference: `light`, `dark`, `auto`
- Privacy settings: read receipts, typing indicators, discovery, data sharing
- Region settings: language, timezone, date format
- Online presence tracking (`isOnline`, `lastLoginAt`, `lastActivityAt`)
- User status: `active`, `away`, `dnd`

### Platform Support
- **Support tickets** (`SupportTicket`, `SupportMessage` models)
- Platform-level support routes at `/api/platform/support`
- User-facing support at `/api/support`

### Updates & Broadcasts
- Company-wide update/announcement broadcasts (`Update`, `Broadcast` models)
- Available at `/api/updates`

### Settings
- Per-user settings page with tabbed interface (profile, security, privacy, region, notifications)
- Company-level settings managed by admins/owners

### Legal
- Legal pages rendered client-side (Terms, Privacy Policy, etc.)

---

## Project Structure

```
client/src/
├── App.js                  # Root router — all route definitions
├── components/             # Reusable UI components
│   ├── messagesComp/       # Message thread, composer, reactions (74 files)
│   ├── profile/            # User profile components
│   ├── tasksComp/          # Task board components
│   ├── workspace/          # Workspace UI components
│   ├── layout/             # App shell, sidebar, nav
│   ├── company/            # Company management components
│   ├── manager/            # Manager dashboard components
│   └── ...
├── pages/                  # Route-level page components
│   ├── SidebarComp/        # Main chat interface
│   ├── AdminDashboard/     # Platform admin views
│   ├── OwnerDashboard/     # Company owner views
│   ├── ManagerDashboard/   # Department manager views
│   ├── LoginPageComp/      # Auth pages
│   ├── settingsTabs/       # Settings tabs (9 tabs)
│   ├── legal/              # Legal pages
│   ├── register/           # Multi-step registration
│   └── ...
├── contexts/               # React Context providers (auth, theme, socket, etc.)
├── hooks/                  # Custom React hooks
├── services/               # Axios API service modules (24 files)
├── utils/                  # Helper utilities
└── modules/                # Domain-specific feature modules

server/
├── server.js               # App entrypoint: env validation, middleware, routes, Socket.IO
├── socket.js               # Socket.IO handler registration (top-level)
├── socket/                 # Modular socket event handlers
├── src/
│   ├── features/           # 31 domain feature modules (routes + controllers)
│   │   ├── auth/           # Login, register, OAuth, refresh, logout
│   │   ├── admin/          # Platform admin, owner dashboard, manager dashboard
│   │   ├── company/        # Company CRUD, settings, metrics
│   │   ├── company-registration/ # Multi-step registration flow
│   │   ├── employees/      # Employee management
│   │   ├── departments/    # Department management
│   │   ├── workspaces/     # Workspace management
│   │   ├── channels/       # Channel management
│   │   ├── messages/       # Message CRUD + history
│   │   ├── tasks/          # Task management
│   │   ├── notes/          # Notes (E2EE-ready)
│   │   ├── polls/          # In-chat polls
│   │   ├── analytics/      # Usage analytics
│   │   ├── ai/             # Gemini AI endpoints
│   │   ├── audit/          # Security audit log
│   │   ├── security/       # Security events
│   │   ├── devices/        # Device session management
│   │   ├── crypto/         # UMEK-based identity recovery
│   │   ├── favorites/      # Pinned chats
│   │   ├── status/         # User presence status
│   │   ├── search/         # Global search
│   │   ├── support/        # Support tickets
│   │   ├── users/          # User profile and lookup
│   │   ├── updates/        # Broadcasts and announcements
│   │   ├── onboarding/     # Employee onboarding
│   │   ├── internal-messaging/ # Org-level internal messages
│   │   ├── domain-verification/ # DNS domain verification
│   │   ├── managers/       # Manager-specific actions
│   │   ├── dashboard/      # Dashboard aggregations
│   │   └── chatlist/       # Chat list / conversations list
│   ├── modules/            # V2 modular architecture
│   │   ├── messages/       # V2 messages
│   │   ├── encryption/     # E2EE key operations
│   │   ├── identity/       # Public key management
│   │   ├── conversations/  # Conversation key management
│   │   └── threads/        # Message threads
│   ├── services/           # Shared services (audit digest, etc.)
│   └── shared/             # Shared utilities, upload routes, OTP routes
├── models/                 # 27 Mongoose models
│   ├── User.js             # Full user schema (auth, E2EE, preferences, presence)
│   ├── Company.js          # Company schema (billing plans, domain, settings)
│   ├── Workspace.js        # Workspace (company/personal, members, settings)
│   ├── Department.js       # Department structure
│   ├── InternalMessage.js  # Org-wide messaging
│   ├── ConversationKey.js  # E2EE conversation key storage
│   ├── UserIdentityKey.js  # User ECDH key storage
│   ├── UserSession.js      # Device/session tracking
│   ├── AuditLog.js         # Security audit log
│   ├── Analytics.js        # Platform analytics events
│   ├── Task.js             # Task + subtasks
│   ├── TaskActivity.js     # Task activity history
│   ├── Note.js             # Notes (E2EE-ready)
│   ├── SupportTicket.js    # Support tickets
│   ├── SupportMessage.js   # Support thread messages
│   ├── DMSession.js        # Direct message sessions
│   ├── Favorite.js         # Favorited chats
│   ├── HistoryLog.js       # Action history log
│   ├── Permission.js       # Granular permission records
│   ├── Invite.js           # Company/workspace invites
│   ├── Billing.js          # Billing records
│   ├── Invoice.js          # Invoice records
│   ├── Ticket.js           # Generic tickets
│   ├── Update.js           # Announcements/updates
│   ├── Broadcast.js        # Broadcast messages
│   ├── PlatformSession.js  # Platform-level session
│   └── encryption.js       # Encryption key model
├── middleware/
│   ├── auth.js             # JWT access token verification
│   └── validate.js         # Input sanitization (MongoDB injection prevention)
├── config/
│   └── passport.js         # Passport OAuth strategies
└── utils/
    └── logger.js           # Structured logger
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- **MongoDB** — a MongoDB Atlas cluster or local instance
- **Redis** *(optional)* — only required for multi-instance horizontal scaling

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/chttrix-collab.git
cd chttrix-collab

# 2. Install all dependencies (root + client + server)
npm run install-all
```

### Environment Variables

#### Server (`server/.env`)

Copy the template and fill in values:

```bash
cp server/.env.example server/.env
```

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `ACCESS_TOKEN_SECRET` | ✅ | JWT access token secret (min 32 chars) |
| `REFRESH_TOKEN_SECRET` | ✅ | JWT refresh token secret (min 32 chars) |
| `FRONTEND_URL` | ✅ | Frontend origin URL (e.g. `http://localhost:5173`) |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `SERVER_KEK` | ✅ | 64-char hex AES-256 key for E2EE workspace key wrapping |
| `NODE_ENV` | ✅ | `development` or `production` |
| `PORT` | — | Server port (default: `8080`) |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth client secret |
| `LINKEDIN_CLIENT_ID` | — | LinkedIn OAuth client ID |
| `LINKEDIN_CLIENT_SECRET` | — | LinkedIn OAuth client secret |
| `SMTP_HOST` | — | SMTP server for email (invites, resets) |
| `SMTP_PORT` | — | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `EMAIL_FROM` | — | From address for outbound email |
| `BREVO_API_KEY` | — | Brevo (Sendinblue) API key alternative |
| `TWILIO_ACCOUNT_SID` | — | Twilio account SID for OTP SMS |
| `TWILIO_AUTH_TOKEN` | — | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | — | Twilio sending number |
| `GEMINI_API_KEY` | — | Google Gemini AI API key |
| `REDIS_URL` | — | Redis connection URL for Socket.IO horizontal scaling |
| `CRYPTO_KEK_ACTIVE_VERSION` | — | Active KEK version (e.g., `1`) |
| `CRYPTO_KEK_V1` | — | KEK version 1 (64-char hex) |
| `CRYPTO_KEK_V2` | — | KEK version 2 (64-char hex) |
| `ACCESS_TOKEN_EXPIRES_IN` | — | Access token TTL (default: `15m`) |
| `REFRESH_TOKEN_EXPIRES_IN` | — | Refresh token TTL (default: `7d`) |

> **Generate `SERVER_KEK`:**
> ```bash
> node -e "require('crypto').randomBytes(32).toString('hex')"
> ```

#### Client (`client/.env`)

```bash
cp client/.env.example client/.env
```

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL (e.g. `http://localhost:8080/api`) |
| `VITE_BACKEND_URL` | Backend base URL |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `VITE_APP_NAME` | App name (default: `Chttrix`) |
| `VITE_ENABLE_ANALYTICS` | Enable client analytics (`true`/`false`) |
| `VITE_ENABLE_DEBUG` | Enable debug logging |
| `VITE_GOOGLE_ANALYTICS_ID` | Google Analytics ID |
| `VITE_SENTRY_DSN` | Sentry error tracking DSN |

### Running Locally

```bash
# Run both client and server concurrently (from root)
npm run dev

# Or run separately:
npm run server   # starts server with nodemon on port 8080
npm run client   # starts Vite dev server on port 5173
```

**Health check:** Once running, verify the server is up:
```
GET http://localhost:8080/api/health
```

---

## API Overview

All routes are prefixed with `/api`. The server exposes both legacy (`v1`) and `v2` modular routes.

| Prefix | Feature |
|---|---|
| `/api/auth` | Authentication (login, register, OAuth, refresh, logout) |
| `/api/otp` | OTP verification |
| `/api/users` | User profile and search |
| `/api/companies` | Company CRUD, settings, metrics, registration, employees, domain verification |
| `/api/departments` | Department management |
| `/api/workspaces` | Workspace management |
| `/api/channels` | Channel management |
| `/api/messages` | Messages (legacy) |
| `/api/chat` | Chat list / conversation list |
| `/api/polls` | In-chat polls |
| `/api/notes` | Notes |
| `/api/tasks` | Tasks |
| `/api/search` | Global search |
| `/api/analytics` | Analytics |
| `/api/ai` | AI (Gemini) features |
| `/api/updates` | Announcements and broadcasts |
| `/api/dashboard` | Dashboard aggregations |
| `/api/managers` | Manager-specific routes |
| `/api/admin` | Admin routes |
| `/api/admin-dashboard` | Admin dashboard |
| `/api/owner-dashboard` | Owner dashboard |
| `/api/manager-dashboard` | Manager dashboard |
| `/api/manager` | Manager (new pattern) |
| `/api/support` | User support tickets |
| `/api/platform/support` | Platform-level support |
| `/api/internal` | Internal org messaging |
| `/api/upload` | File uploads |
| `/api/v2/messages` | Messages (V2 modular) |
| `/api/v2/encryption` | E2EE key operations |
| `/api/v2/identity` | Public key management |
| `/api/v2/conversations` | Conversation key management |
| `/api/threads` | Message threads |
| `/api/v2/crypto` | UMEK-based identity recovery |
| `/api/v2/devices` | Device session management |
| `/api/v2/security` | Security audit routes |
| `/api/v2/audit` | Audit log routes |
| `/api/v2/tasks` | Tasks (V2) |
| `/api/v2/notes` | Notes (V2) |
| `/api/v2/favorites` | Favorites (V2) |
| `/api/v2/status` | User presence status |
| `/api/v2/admin` | Admin (V2) |
| `/api/health` | Health check (MongoDB status, uptime, env) |

---

## Security

| Measure | Implementation |
|---|---|
| Access tokens | Short-lived JWT (`15m` default), sent as Bearer token |
| Refresh tokens | Long-lived JWT (`7d` default), hashed before storage, device-bound |
| Password hashing | bcryptjs |
| HTTP headers | Helmet (CSP, HSTS, X-Frame-Options, etc.) |
| Rate limiting | `express-rate-limit` — 20 req/min on auth in production |
| Input sanitization | Custom middleware strips MongoDB `$` operators |
| Input validation | `express-validator` on all mutation endpoints |
| CORS | Explicit allowlist, `credentials: true` |
| HTTPS | Enforced in production (301 redirect for HTTP) |
| E2EE | ECDH key exchange, per-conversation keys, AES-256 KEK |
| Uploads | Served behind auth middleware (`requireAuth`) |
| Audit logging | Sensitive actions recorded in `AuditLog`, hourly digest |
| Account lockout | `failedLoginAttempts` + `lockedUntil` on `User` |
| Graceful shutdown | SIGTERM/SIGINT handlers drain connections before exit |

---

## Deployment

### Frontend → Vercel

Configured via `vercel.json`:
- **Build command:** `npm install && npm run build --workspace=client`
- **Output directory:** `../dist`
- **SPA rewrite:** all routes → `index.html`

Set environment variables in the Vercel project dashboard (`VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, etc.).

### Backend → Railway

Configured via `railway.json` and `nixpacks.toml`:
- **Build command:** `cd server && npm install`
- **Start command:** `cd server && node server.js`
- **Restart policy:** `ON_FAILURE` with up to 10 retries

Set all server-side environment variables in Railway's variable panel before deploying.

### Docker

A `Dockerfile` is available in `server/` for containerized deployments (Cloud Run, ECS, etc.).

---

## Scripts

### Root
| Script | Description |
|---|---|
| `npm run dev` | Run client and server concurrently |
| `npm run client` | Start Vite dev server |
| `npm run server` | Start server with nodemon |
| `npm run install-all` | Install dependencies for root, client, and server |

### Client (`/client`)
| Script | Description |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint on `src/` |

### Server (`/server`)
| Script | Description |
|---|---|
| `npm run dev` | nodemon dev server |
| `npm start` | Production start (`node server.js`) |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with auto-fix |

---

## License

ISC