# Oruinwan — Product Requirements Document (PRD)

| | |
|---|---|
| Product | Oruinwan, a team workspace: chat, huddles, tasks, notes, knowledge and AI in one place |
| Version described | 3.3.x (October 2026) |
| Platforms | Web (oruinwan.poelys.com), desktop (Windows, macOS, Linux), Android, iPhone, phone browsers (`/m/`) |
| Owner | Product owner (repository owner) |
| Related | [HLD](HLD.md) · [LLD](LLD.md) · [Onboarding kit](ONBOARDING.md) · [Product map](PRODUCT_MAP.md) · [Conversation rules](CONVERSATIONS.md) |

---

## 1. Why Oruinwan exists

Small and mid-size teams juggle a chat app, a task tracker, a docs tool, a meeting tool and an AI
assistant, each with its own login, notifications and search. Context is lost between them: a
decision made in chat never reaches the task, a meeting's notes never reach the people who missed
it.

**Oruinwan puts the whole working day in one workspace.** Conversations, the work that comes out of
them, the meetings about it and the knowledge it produces live together, link to each other and
are searchable in one place — privately: messages are end-to-end encrypted.

### Goals

1. One place for a team's communication and work, on every device, with one account.
2. Private by default: message content is end-to-end encrypted; the server never reads it.
3. Familiar: people who know Slack, WhatsApp, Notion or Google Calendar feel at home in minutes.
4. Free for small teams; self-hostable for organisations that need to own their data.
5. AI that helps inside the work (summaries, drafting, answering from the team's knowledge), not a
   separate chatbot.

### Non-goals (for now)

- Public communities or social features beyond a workspace.
- Replacing email for external communication.
- A full project-portfolio or HR suite (only the pieces teams use daily).

## 2. Who it is for

| Persona | Needs | What they mostly use |
|---|---|---|
| **Team member** | Talk, get tasks done, find things fast, few interruptions | Chats, Tasks, Notes, Activity, phone app |
| **Team lead** | Plan work, run meetings, keep everyone informed | Tasks (board, sprint, roadmap), huddles, calendar, notes |
| **Workspace owner / admin** | Set the workspace up, invite people, control access and features | Admin, settings, invitations, plans |
| **Company administrator** | Several workspaces, compliance, single sign-on | Company dashboard, SSO, audit, retention |
| **Self-hosting operator** | Run Oruinwan on their own servers | Docker Compose, environment configuration |

## 3. Platforms and distribution

| Platform | Built from | Distributed through | Updates |
|---|---|---|---|
| Web | `client/` (React + Vite) | oruinwan.poelys.com | Each deploy; the page offers "Reload" |
| Desktop | `desktop/` (Electron) wrapping `client/` in app mode | GitHub Releases (Windows, macOS Intel + Apple Silicon, Linux) | Quick update (UI bundle) or new installer |
| Android | `mobile/` (React + Capacitor) | Google Play (AAB, `play` flavor) and GitHub Releases (APK, `github` flavor) | Play / quick update; GitHub APK self-updates |
| iPhone | `mobile/` (Capacitor) | App Store (when published) | App Store / quick update |
| Phone browser | `mobile/` built into `/m/` | oruinwan.poelys.com (phones are sent to `/m/` automatically) | Each deploy |

**Requirements**
- R-PLAT-1: Every feature works on web and desktop; phone apps have parity for everything people do
  daily (chat, tasks, notes, calls, activity, calendar, settings).
- R-PLAT-2: A browser window narrower than 600 px switches to the phone layout; a wider one goes back
  (unless the person chose "Use the full website").
- R-PLAT-3: Quick updates (UI bundles) never need a reinstall; native changes ship as a full build.
- R-PLAT-4: The Google Play build never installs APKs itself (no `REQUEST_INSTALL_PACKAGES`).

## 4. Features and requirements

Each area lists what a person can do and the rules that must hold. Detailed rules for
conversations are in [CONVERSATIONS.md](CONVERSATIONS.md).

### 4.1 Accounts and sign-in
- Sign up with email + password (date of birth, 13+), or with Google. Sign in on the web, desktop
  (QR code from a signed-in phone, or Google), and phone.
- Two-step verification (authenticator app), passkeys, trusted devices, a device limit per plan.
- Password reset by email; email verification.
- **Account deletion** in the app (Settings) and on the web (`/delete-account`) — required by app
  stores.
- R-AUTH-1: Every session can be seen and signed out from Settings → Devices.
- R-AUTH-2: Encryption keys are unlocked with the account password once per device.

### 4.2 Workspaces
- A person belongs to one or more workspaces; each has members with roles: **owner, admin, member**
  (and guests where enabled).
- Create a workspace (from a template or blank), invite by email or link, remove or suspend people.
- **Workspace profile:** name, description, picture (square, like a group icon), cover image,
  tagline, website, location. Owners and admins edit it.
- Workspace settings: features on/off, permissions, channel defaults, AI, integrations, data, plan.
- R-WS-1: Everything a person can see is limited to workspaces where they are an **active** member;
  removal or suspension takes effect immediately on every device.

### 4.3 Chats
- **Channels** (public or private, announcement channels), **direct messages**, **group DMs**
  (3–10 people), **notes to self**, **AI agent chats**.
- Messages: text with Markdown, mentions (full names, @here, @channel), reactions, threads, quotes,
  edit, delete, pin, bookmark, forward, polls, checklists, files, images, voice notes, link
  previews, scheduled messages, reminders, slash commands (`/task`, `/poll`, `/remind`, …).
- **New message with a "To:" bar:** one person opens the 1:1 chat; several open the group with
  exactly those people, or offer to start it.
- Lists are **newest activity first** everywhere; unread counts clear when a chat is read on any
  device.
- R-CHAT-1: Message content is end-to-end encrypted; the server stores only ciphertext.
- R-CHAT-2: People added to a group see messages from when they joined unless the person adding
  them shares earlier history.
- R-CHAT-3: Mentioning someone outside a channel offers to add them; in a 1:1 chat it offers a
  group (opening an existing one when it already exists).

### 4.4 Huddles, calls and meetings
- Voice and video calls in DMs, groups and channels; ringing on every device (even when the phone
  app is closed on Android); screen sharing; add people to a call.
- Scheduled meetings with invitees, conflict warnings and suggested free times.
- Meeting notes and recaps (transcript and AI summary when enabled).
- R-CALL-1: A call reaches a person on all their devices; answering on one stops ringing on the
  others.

### 4.5 Tasks
- Personal and workspace tasks: assignees, watchers, due dates, priority, status, labels, sub-tasks,
  dependencies, recurrence, attachments.
- Views: list, board, sprint, timeline, workload; milestones, roadmap, time report, templates,
  design reviews.
- **Task discussion:** comments and an activity log on every task; a task made from a message links
  to that message's thread.
- R-TASK-1: The Tasks page opens on **All tasks** (everything the person can see).

### 4.6 Notes, canvases and knowledge
- **Notes:** personal documents (meeting notes, specs, drafts) shared with specific people or the
  workspace; templates, pins, archive, reminders, version history, turn into tasks.
- **Canvases:** a shared document per channel.
- **Knowledge:** the workspace's wiki — pages in categories, links and backlinks, a map of pages,
  AI summaries; Oruinwan AI's Knowledge mode answers from these pages.

### 4.7 Activity, notifications and calendar
- **Activity:** mentions, DMs, thread replies, reactions, task and meeting updates, grouped per
  conversation; filters.
- **Notifications:** in-app toasts, desktop notifications, phone push (Android, iPhone, web push);
  quiet when the conversation is already on screen; per-workspace and per-conversation settings;
  do-not-disturb.
- **Calendar:** day, week, month and schedule views of meetings, huddles, tasks due, reminders and
  scheduled messages; filters by kind; schedule a meeting by clicking a free time (web).
- R-NOTIF-1: One message produces at most one alert per device; reading it anywhere clears it.

### 4.8 Oruinwan AI
- Ask in any conversation (`@Oruinwan`), in the AI tab, from the floating AI button (quick window),
  or "Ask AI about this chat"; workspace agents (Claude, ChatGPT, Gemini…) when connected.
- Tools: summarise, draft, create tasks and notes, schedule meetings, search messages and
  knowledge.
- R-AI-1: AI sees only what the person asking can see; message content is decrypted on the
  person's device and sent with the question.
- R-AI-2: Usage is limited per person and per workspace per day by plan.

### 4.9 Search, files and integrations
- Universal search (⌘K): messages (decrypted locally), people, channels, tasks, notes, files.
- Files: everything shared in the workspace, by type and conversation.
- Integrations: GitHub, Jira, CI, webhooks, Google Drive backup, a public API and developer apps,
  automations (workflows).

### 4.10 Administration and compliance
- Admin: members, invitations, roles, permissions, features, channels, analytics, data export,
  retention, audit log.
- Company level: several workspaces, departments, SSO (SAML/OIDC), domain verification, compliance
  logs.

## 5. Plans and limits

The Free plan's limits are enforced by the server (`server/src/shared/plans/`) and shown in the apps
(Settings → Plan & usage). Self-hosted servers can change every limit. Pro and Enterprise are
planned. Current Free limits include: workspaces per person, people per workspace, channels, active
tasks, notes per template, AI requests per person and per workspace per day, devices, call size.
See `client/src/pages/pricing/plans.js` for the published list.

## 6. Quality requirements (non-functional)

| Area | Requirement |
|---|---|
| Privacy | Messages end-to-end encrypted (per-conversation keys, rotated when people leave). No selling of data, no ads. Analytics anonymous and optional on phones. |
| Security | HTTPS only in production; refresh-token rotation; 2FA; rate limits; access checked on every API call and socket event against one rule set. |
| Reliability | Health check at `/api/health`; automatic rollback when a deploy fails its health check; daily disk snapshots and pre-deploy database backups. |
| Performance | Chat lists and conversations open within a second on a mid-range phone; messages arrive live over Socket.IO. |
| Accessibility | Keyboard reachable, labelled controls, reduced-motion respected, light and dark themes. |
| Compatibility | Android 7+ (minSdk 24, target 36), current iOS, current Chrome/Edge/Firefox/Safari, Windows 10+, macOS 12+, Ubuntu LTS. |
| Store compliance | In-app and web account deletion, privacy policy with service providers, Google Play build without self-update. |

## 7. Success measures

- Weekly active members per workspace and messages per active member.
- Share of tasks created from conversations; share of meetings with notes.
- Notification opt-out rate (lower is better) and crash-free sessions on phones.
- Time from invite to first message for new members.

## 8. Release process (product view)

1. Changes land on `main` with tests (unit and browser end-to-end) passing in CI.
2. The release commit bumps the one version number (`mobile/package.json`, mirrored in desktop and
   iOS) and adds release notes (`mobile/release-notes/<version>.md`).
3. A `v<version>` tag builds the signed apps and publishes the GitHub Release; installed apps pick up
   the quick update. The Play bundle is uploaded to Google Play.
4. The website and server are deployed (see [Onboarding kit → Releasing](ONBOARDING.md#7-shipping-a-release)).

## 9. Open questions and next steps

- Message text in phone notifications (needs on-device decryption in native code).
- iPhone App Store publication.
- Pro and Enterprise plans and billing.
- Rewriting the public repository's history to remove an old prototype `.env` (its credentials must
  be rotated regardless).
