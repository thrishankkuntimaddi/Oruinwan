# Oruinwan — Low-Level Design (LLD)

Where things are in the code and how they work inside. Read the [HLD](HLD.md) first for the big
picture. API references for individual areas are in [docs/api/](api/).

---

## 1. Repository layout

```
/                      yarn workspaces root (server, client, e2e); mobile and desktop use npm
├─ server/             Node.js API + realtime + jobs
├─ client/             web app (React, Vite); also the desktop app's UI ("app" build mode)
├─ desktop/            Electron shell for Windows, macOS, Linux
├─ mobile/             phone app (React, Vite, Capacitor): Android, iOS and the /m/ phone website
├─ platform/           shared plain-JS modules used by client and mobile (no React)
├─ ai/                 AI subsystem (gateway, orchestrator, agents, memory, tools)
├─ e2e/                Playwright end-to-end tests (web + phone) against a throwaway stack
├─ docs/               product, design and API documentation (this folder)
├─ docker-compose.yml  local / production stack (postgres, mongo, redis, s3, app, turn)
└─ .github/workflows/  ci.yml, apps.yml (app builds + releases), web.yml (GitHub Pages site)
```

## 2. Server (`server/`)

### 2.1 Entry and request lifecycle
- `server.js` boots: environment, MongoDB (`src/shared/db.js`), PostgreSQL + migrations
  (`src/shared/postgres.js`, `src/shared/migrations.js`), Redis, Express, Socket.IO.
- Process roles (`src/shared/processRole.js`): `all` (default), or `api`, `realtime`, `jobs`,
  `uploads` when split.
- Express pipeline: security headers → CORS (`allowedOrigins.js`) → JSON / cookies → routes →
  `errorHandlers.js`.
- Authentication: `src/shared/middleware/auth.js` (`requireAuth`) verifies the JWT and puts
  `req.user` (`sub` = user id). Workspace and company gates: `requireWorkspaceMember`,
  `requireWorkspaceAdmin`, `requireCompanyAdmin`, `permissionMiddleware`, `enforceRoleCeiling`.
- Validation: `validate.js` (schema per route) where used.

### 2.2 Code organisation
- `src/modules/<name>/` — newer domains with a common shape (`index.js` exports `register`,
  `registerSocket`, `start`): **messages, threads, notifications, huddles, meetings, collab**,
  plus `conversations` (shared access + keys), `encryption`, `identity`, `uploads`, `ai`,
  `linkPreview`. New work goes here.
- `src/features/<name>/` — older areas (routes, controller, service, model per folder): auth,
  workspaces, channels, tasks, notes, knowledge, files, search, admin, integrations, push, …
  They move to `modules/` as they are reworked.
- `src/identity/` — the PostgreSQL identity layer: repos for users, workspaces, companies, orgs,
  sessions, keys, plus `hydrate.js` (fills user cards into Mongo documents).
- `src/shared/` — cross-cutting: plans and limits (`plans/`), feature flags, jobs, events
  (outbox), Redis, uploads, utils.
- `src/socket/` — Socket.IO connection, authentication (`socketAuth.js`), chat handlers.
- `models/` and `src/models/` — Mongoose models (e.g. `DMSession.js`, `Note.js`, `Task.js`).

### 2.3 Conversation core (the most important code)

| File | Role |
|---|---|
| `modules/conversations/conversationAccess.js` | **The** access rule: `checkConversationAccess({channel, dm}, userId, {forWrite, topLevel})`, `checkMessageAccess`, `historyFilter`, join-date (`since`) for groups. Every message read/write path calls it. |
| `modules/messages/sendRules.js` | `prepareSend`: access, posting policy, parent/thread rules, quotes, attachments sanitising, DM creation from `receiverId`. |
| `modules/messages/messages.service.js` | `createMessage`, fan-out (`new-message` / `thread-reply` events, unread, notifications, @mention resolution), DM list (`getUserDMSessions`), `findOrCreateDMSession` (one DM per pair via `pairKey`; `isSelf` notes-to-self). |
| `modules/messages/groupDM.service.js` | Group DMs: create (reopen same people), `findConversation` (To: bar lookup, creates nothing), add/remove members with history choice, admin hand-over, rename. |
| `modules/conversations/conversationKeys.service.js`, `keyEpochs.js`, `conversationRooms.js` | Wrapped conversation keys, key rotation when membership changes, evicting sockets. |
| `utils/mentionMatch.js` | Which usernames (they may contain spaces) a message mentions — longest name wins. |

Rules are summarised in [CONVERSATIONS.md](CONVERSATIONS.md).

### 2.4 Data

**PostgreSQL** (migrations in `server/db/migrations/NNNN_name.sql`, applied in order at start-up):
users, user_emails, user_sessions, user_devices, user_device_sessions, user_refresh_tokens,
user_passkeys, user_otp_codes, user_identity_keys, user_crypto_state, companies, company_admins,
company_role_permissions, workspaces, workspace_members, workspace_permissions, invites,
departments, teams, conversation_keys, conversation_key_members, conversation_key_epochs,
conversation_key_epoch_members, tasks (+ assignees, watchers, links, dependencies, activity),
sprints, milestones, projects, billing_accounts, invoices, analytics_snapshots, audit_log,
security_event, compliance_log, event_outbox, ai_embeddings.

**MongoDB** (Mongoose models): messages, channels, `DMSession` (1:1, groups, notes to self;
`pairKey` unique), notes, notifications, meetings/huddles, conversation prefs, favorites,
scheduled messages, reminders, knowledge pages and categories, files metadata, support tickets.

Adding a migration: create the next `NNNN_*.sql`; it must be idempotent-safe and forward-only.
Adding a Mongo index: declare it on the schema; production syncs on start.

### 2.5 Realtime (Socket.IO)
- Rooms: `user:<id>` (all of a person's devices), `workspace:<id>`, `channel:<id>`, `dm:<id>`.
- Main events (server → client): `new-message`, `thread-reply`, `message-updated`,
  `message:deleted`, `message:reaction_added/removed`, `message-pinned/unpinned`, `read-update`,
  `conversation:read`, `conversation:activity`, `notification:new/updated`,
  `dm:members_updated`, `dm:removed`, `new-dm-session`, `workspace-updated`, `huddle:*`,
  `ai:reply`, presence events.
- Client → server: `send-message`, `mark-chat-read`, `join-dm` / `leave-dm`, `presence:viewing`,
  `huddle:*`.

### 2.6 Notifications and push
- `modules/notifications/notificationService.js`: creates, groups (one row per conversation),
  emits, and sends push when the person is not active anywhere (`viewing` tracking), with a
  debounce per conversation.
- `features/push/push.service.js`: FCM (Android), APNs (iPhone, with `apns-collapse-id`),
  Web Push; call pushes are high-priority data messages.

### 2.7 Uploads
- `modules/uploads/upload.service.js` writes to S3 (`writeObject`) and returns a server URL
  (`/api/v2/uploads/file?path=…`); access is checked per prefix (`upload.access.js`).
- Workspace pictures and covers: `features/workspaces/workspaceProfile.js`
  (`POST/DELETE /api/workspaces/:id/profile/:kind`, admins).

## 3. Web client (`client/`)

- `src/main.jsx` → `App.js` (routes). Layout: `components/layout/MainLayout.jsx` (icon rail,
  side panel per section, main area, AI panel, phone-layout switch, workspace picture host).
- **Contexts** (`src/contexts/`): Auth, Workspace, Socket, Contacts (channel/DM lists, newest
  first, live), Toast, Theme; `features/notifications/NotificationsContext.jsx` (unread counts,
  alerts).
- **Pages** (`src/pages/`): Home, Messages, Channels, Tasks, Notes, Huddles, Notifications (with
  Calendar), Settings, admin, landing/legal.
- **Features** (`src/features/`): messaging (chat window `chatWindowComp/ChatWindowV2.jsx`,
  New message `newMessage/NewMessageView.jsx`, recipients, group DMs), calendar
  (`CalendarBoard.jsx`), huddles, meetings, notifications, workspace (picture host), plan, split.
- **Services** (`src/services/`): `api.js` (axios with refresh), message and conversation-key
  encryption, identity keys.
- Desktop: `src/appMode/` (environment, updates, phone-layout switch) — the same code built with
  `vite --mode app`.
- Imports: `@platform/…` resolves to `../platform`; `@services/…` to `src/services`.

## 4. Phone app (`mobile/`)

- `src/main.jsx` → `app/App.jsx` → `app/Shell.jsx` (tab bar, stacks, drawers, AI button).
- Navigation: `app/nav.js` (a zustand store: tabs, stacks, `push`/`pop`), routes in
  `app/routes.js` (lazy screens by name).
- Data: `data/session.js` (who and where), `data/query.js` (small stale-while-revalidate cache),
  `data/hooks.js` (`useChannels`, `useDms`, `useMembers`, …), `data/live/*` (the adapter that
  calls the server, maps responses, decrypts, realtime), `data/outbox.js` (offline sends).
- Screens in `src/features/<area>/` (chats, tasks, notes, huddles, home, more = activity, files,
  calendar; settings; admin; workspace).
- UI kit `src/ui/` (Screen, Header, List, Button, Sheet, Avatar, Icon, Markdown, SquareCropSheet).
- Native: `src/native/` (push, keyboard, storage, calls) + Java in
  `android/app/src/main/java/com/oruinwan/app/` (call service, Google sign-in, OTA bundles,
  updater). Two Android flavors: `github` (self-updating APK) and `play` (no updater).
- Drawers: `app/WorkspaceDrawer.jsx` (left: workspace, cover/picture, places) and
  `app/SidePanel.jsx` (right: you).

## 5. Shared code (`platform/`)

Plain modules used by both apps, each with a `*.cases.js` shared test file run by both suites:
`people/peopleMatch.js` (search people), `people/mentions.js` (mentions with spaces),
`commands/slashCommands.js`, `calendar/calendarLayout.js`, `media/squareCrop.js`,
`motion/arrivals.js`, `tasks/discussionSync.js`, `sdk/` (public SDK pieces).

## 6. Configuration

- Server: `server/.env` (see `server/.env.example` and `.env.production.template`): database URLs,
  JWT secrets, S3, Redis, email (Brevo), push (FCM service account, APNs key, Web Push VAPID), AI
  provider and keys, public URLs, plan overrides. **Never committed.**
- Web: `VITE_BACKEND_URL`, `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID` at build time.
- Phone: `VITE_SERVER_URL` (built in), optional `mobile/.env` (Firebase web config), Android
  `google-services.json` from a CI secret.
- CI secrets: Android keystore, update-signing key, Apple keys, Firebase config.

## 7. Testing

| Layer | Tool | Where | Run |
|---|---|---|---|
| Server unit/integration | Jest | `server/src/**/__tests__` | `cd server && npx jest` |
| Web unit/component | Vitest + Testing Library | `client/src/__tests__` | `cd client && npx vitest run` |
| Phone unit/component | Vitest | `mobile/src/**/*.test.js(x)` | `cd mobile && npx vitest run` |
| Shared rules | `platform/**/*.cases.js` | run by web and phone suites | — |
| End-to-end | Playwright | `e2e/tests/*.spec.js` (web + phone) | `cd e2e && npx playwright test` (needs Docker; uses `_e2e` databases only) |

Lint: `npm run lint` in `server`, `client`, `mobile` (zero errors required).

## 8. CI/CD

- `ci.yml` (every push): server lint + tests, web lint + tests + build, end-to-end suite.
- `apps.yml` (push and `v*` tags): phone lint + tests, phone UI bundle, Android (APK + Play AAB on
  tags, signed), iOS, desktop installers (Linux, Windows, macOS ×2); on tags, publishes the GitHub
  Release with `latest.json` and signed quick-update bundles.
- `web.yml`: the product website on GitHub Pages.
- Production deploy: build the web client, copy it with the update scripts to the server, rebuild
  the app image, health-check, automatic rollback (see the onboarding kit).

## 9. Conventions

- Plain, short comments that explain *why*; user-facing text in plain English.
- One rule, one place: access checks in `conversationAccess.js`, sends in `sendRules.js`, people
  matching in `platform/people`.
- Tests next to the code; shared behaviour tested once via `platform/*.cases.js`.
- Commits: `type(scope): summary` (feat, fix, chore, test, docs), with a body that says what changed
  for people.
