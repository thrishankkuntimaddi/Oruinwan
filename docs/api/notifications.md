# Notifications API

In-app notifications, push, and notification emails. Messages are end-to-end
encrypted, so no notification, push or email ever contains message text — only
who did what and where ("alice mentioned you in #general").

All routes need a signed-in user (`Authorization: Bearer <token>` / auth cookie).

## Notification feed — `/api/notifications`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/notifications?workspaceId=&page=&limit=&type=&unreadOnly=true` | `{ notifications, total, unreadCount, page, pages }` |
| GET | `/api/notifications/unread-count?workspaceId=` | `{ count }` |
| PATCH | `/api/notifications/read-all?workspaceId=` | emits `notification:read-all` |
| PATCH | `/api/notifications/read` | body `{ ids: [...] }` (up to 200), emits `notification:read` |
| PATCH | `/api/notifications/:id/read` | emits `notification:read` |
| DELETE | `/api/notifications/:id` | emits `notification:deleted` |
| DELETE | `/api/notifications?workspaceId=` | emits `notification:cleared` |
| GET | `/api/notifications/preferences?workspaceId=` | workspace preferences (below) |
| PATCH | `/api/notifications/preferences?workspaceId=` | partial, booleans only |

Notification object: `{ _id, recipient, workspaceId, type, title, body, link, meta, groupKey, read, createdAt, updatedAt, emailedAt }`.
`emailedAt` is set once the offline-email job has handled a mention/DM. Lists are sorted by
`updatedAt` (newest first).

### Chat notifications are grouped (2.2)

`dm`, `mention` and `thread_reply` notifications are **one row per conversation** (per thread for
replies and thread mentions) while it is unread. `groupKey` is `dm:<dmId>`, `mention:<convId>`,
`mention:<convId>:<parentId>` or `thread:<parentId>`. Each new message counts the row up:
`meta.count`, `meta.senders` (last 5 names), the latest `meta`, and a title like
`"ben · 5 new messages"`. The first message emits `notification:new`, later ones
`notification:updated`. Push for a grouped row goes out at most once per 30 seconds and
carries `data.count`; Android `tag` / iOS `thread-id` replace the earlier push.

### Nothing for what is on screen

Clients report what they show with `presence:viewing { conversationType, conversationId,
conversations?: [{ conversationType, conversationId }] (split panes), threadId?, client?: 'mobile',
visible, focused }` on every change and every minute. While any of the person's sessions shows that
conversation (or, for replies and thread mentions, that thread), the server stores no notification
and sends no push for it. With `REDIS_URL` this is shared across instances
(`oruinwan:viewing:<userId>`, 150 s TTL). An active web or desktop session also skips push; an open
phone app (`client: 'mobile'`) still gets push for other conversations, which it shows as banners.

### Reading clears everywhere

`mark-chat-read` (socket) marks that conversation's unread `dm` / `mention` rows read, and opening a
thread (`GET /api/threads/:id`) marks its `thread_reply` / thread `mention` rows read; every device
gets `notification:read { ids, workspaceId }`.

### Do not disturb

While the person's status is `dnd`, notifications are stored and emitted with `silent: true`;
nothing is pushed, and clients show no toast or OS alert and play no sound.

### Socket events (room `user:<id>`)

- `notification:new` `{ notification, silent? }`, `notification:updated` `{ notification, silent? }` (a grouped row counted up)
- `notification:read` `{ ids, workspaceId }`, `notification:read-all` `{ workspaceId }`
- `notification:deleted` `{ ids, workspaceId }`, `notification:cleared` `{ workspaceId }`

### Types added / now produced

| type | produced by | link | meta |
| --- | --- | --- | --- |
| `meeting_reminder` | meeting reminder job | `/meetings/:id` | `{ meetingId, scheduledMeetingId, meetingTitle, startTime (ISO), startsIn }` |
| `meeting_recap` | a call (scheduled meeting or ad-hoc huddle) ended — see meetings-unified.md | `/meetings/:id` | `{ kind: 'meeting_recap', meetingId, meetingKind, channelId, dmSessionId }` |
| `ai_suggestion` | suggestion job | task list / task / `/meetings/:id` / `/channel/:id` / `/dm/:id` / `/huddles?tab=history` | `{ kind: 'overdue_tasks' \| 'meeting_action_items' \| 'huddle_action_items', count?, meetingId?, huddleSessionId?, noteId? }` |
| `mention` (thread reply) | thread replies with `@handle`, `@channel` or `@here` | `/channel/:id` / `/dm/:id` | `{ …, isEveryone }` — `isEveryone: true` for `@channel`/`@here` (title "alice notified everyone") |

Show `startTime` in the reader's own time zone; `startsIn` is a ready label (e.g. `"10 min"`).

## Workspace preferences (`NotificationPreference`)

`GET/PATCH /api/notifications/preferences?workspaceId=`

```json
{ "message": true, "threadReply": true, "task": true, "meeting": true,
  "aiSuggestions": true, "email": false, "push": true }
```

- `aiSuggestions` (**new**, default `true`) — rule-based suggestion notifications.
- `meeting` — also governs meeting reminders.
- `email` (default `false`) — opt-in for notification emails from this workspace
  (task assigned, meeting invite, and the new offline mention/DM email).

## Account preferences

`GET /api/auth/me/preferences/notifications`, `PUT` (partial)

```json
{ "emailDigest": true, "marketingEmails": false, "desktopPush": true, "sound": true,
  "mentionsOnly": false, "dmNotifications": true, "digestFrequency": "smart", "newSignInEmails": true }
```

- `digestFrequency`: `"smart" | "daily" | "weekly" | "off"`, default `"smart"`. Any other value → 400.
  A stored `"daily"` that the person never picked themselves (saved before 2.2, no
  `digestChosen` flag) reads as `"smart"`; saving a cadence sets `digestChosen`.
- The digest email is sent only while `emailDigest` is `true` **and** `digestFrequency` is not `"off"`.
- `newSignInEmails` (default `true`): the "new sign-in" security email. Password-changed and
  signed-out-everywhere emails are always sent.
- `dmNotifications: false` also removes DMs from offline emails.

These also appear under `preferences.notifications` in `GET /api/auth/me`.

## Background jobs

All jobs run on one instance per tick (Redis lock) and use a once-only claim
(`NotificationClaim`, unique key, 35-day TTL), so nothing is ever sent twice.

### Meeting reminders — every minute

For each scheduled meeting (`ScheduledMeeting.status = 'scheduled'`) starting within
`MEETING_REMINDER_MINUTES` (default **10**), the organizer and all participants get one
`meeting_reminder` notification (in-app + push), respecting the `meeting` preference.
The claim key includes the start time, so a rescheduled meeting is reminded again.

### Suggestions — hourly

Modest, rule-based, honouring the `aiSuggestions` preference:

1. **Overdue tasks** — assignees of open tasks past their due date (last 60 days) get one
   nudge per workspace per UTC day: "You have 3 overdue tasks — Oldest: …".
2. **Meeting action items** — a scheduled meeting completed in the last 24h with open
   action items not yet turned into tasks: one nudge to the organizer ("… ended with 2 action
   items — turn them into tasks") and one to each assignee. Once per meeting.
3. **Huddle action items** — a huddle (not one that held a scheduled meeting; those use rule 2)
   that ended in the last 24h whose shared huddle notes still have open action items (not done,
   not turned into a task): one nudge to whoever started it ("The huddle in #design ended with
   2 open action items") and one to each assignee (body: their item texts). Once per huddle run
   (claim `ai:huddle-actions:<sessionId>`). Link: the huddle's channel / DM, else `/huddles?tab=history`.
   `meta: { kind: 'huddle_action_items', huddleSessionId, noteId, count? }`.

The job returns `{ overdue, meetings, huddles }` (counts of nudged items).

## Thread replies: `@channel` / `@here`

The `mentionText` a client sends with a thread reply (plaintext extracted by the client; the
reply itself stays E2EE) is parsed for `@handle`, `@channel` and `@here`:

- `@handle` — channel members / DM participants with that username get a `mention` notification,
  follow the thread, and are stored in the reply's `mentions` (unchanged).
- `@channel` — every member of the parent's channel; `@here` — only members online right now
  (presence not `offline`). They get a `mention` notification with `meta.isEveryone: true` instead
  of the generic thread-reply notification. They are **not** made thread followers, and members who
  muted the channel are skipped (a direct `@handle` still reaches them).
- The channel's `broadcastMentions` policy applies exactly as for top-level messages: with
  `'admins'`, only channel admins / workspace admins can use `@channel` / `@here`; for anyone else
  they are ignored. Ignored in DM threads.

### Offline mention / DM email — every 5 minutes

Unread `mention` / `dm` notifications older than `OFFLINE_EMAIL_MINUTES` (default **15**,
up to 24h old) are emailed when the recipient is offline (no socket on any instance and
last seen at least that many minutes ago). One summary email per user per run:

> **alice mentioned you in #general** (×2)
> **bob sent you a direct message**

No message content. Requires the workspace `email` preference to be on and `message`
not off; DMs also need account `dmNotifications`. A user still online is re-checked on
the next run; handled notifications get `emailedAt` and are never emailed again.

### Digest email — hourly, sends once the UTC hour reaches `DIGEST_EMAIL_HOUR_UTC` (default 8)

- daily subscribers: notification counts of the last 24h, once per UTC day;
- weekly subscribers: counts of the last 7 days, on Mondays;
- smart (the default): on a day when unread mentions, DMs, thread replies or assigned / due tasks
  have waited 6 hours or more **and** the person hasn't been active in any app since midnight UTC,
  an email listing what is still unread; otherwise a weekly roundup on Mondays. At most one
  digest per person per day.

Grouped by workspace with a count per category (Mentions, Direct messages, Tasks assigned
to you, Meeting invitations, …) plus "Still unread", and a link to `/notifications`. Grouped
chat rows count every message they hold. Users with nothing new get no email.

There is no in-app digest any more: the bell holds only real notifications (old `digest` rows
are removed at start-up).

### "New sign-in" email

Sent when an account signs in on a device the server has not seen (a new device id), unless:
the person turned `newSignInEmails` off; the same browser or app family (e.g. Chrome on Mac)
signed in from the same network (IPv4 /24, IPv6 /64) in the last 30 days (cleared storage or a
re-install, not a stranger); or one was already sent in the last 10 minutes. Signing out keeps
the device id, so signing back in on the same device is never "new".

### Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `MEETING_REMINDER_MINUTES` | 10 | reminder lead time |
| `OFFLINE_EMAIL_MINUTES` | 15 | how long a user must be away before mention/DM emails |
| `DIGEST_EMAIL_HOUR_UTC` | 8 | earliest UTC hour for digest emails |
