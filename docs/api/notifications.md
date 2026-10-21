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
| PATCH | `/api/notifications/:id/read` | emits `notification:read` |
| DELETE | `/api/notifications/:id` | emits `notification:deleted` |
| DELETE | `/api/notifications?workspaceId=` | emits `notification:cleared` |
| GET | `/api/notifications/preferences?workspaceId=` | workspace preferences (below) |
| PATCH | `/api/notifications/preferences?workspaceId=` | partial, booleans only |

Notification object: `{ _id, recipient, workspaceId, type, title, body, link, meta, read, createdAt, emailedAt }`.
`emailedAt` (new) is set once the offline-email job has handled a mention/DM.

### Socket events (room `user:<id>`)

- `notification:new` `{ notification }`
- `notification:read` `{ ids, workspaceId }`, `notification:read-all` `{ workspaceId }`
- `notification:deleted` `{ ids, workspaceId }`, `notification:cleared` `{ workspaceId }`

### Types added / now produced

| type | produced by | link | meta |
| --- | --- | --- | --- |
| `meeting_reminder` | meeting reminder job | `/meetings/:id` | `{ meetingId, scheduledMeetingId, meetingTitle, startTime (ISO), startsIn }` |
| `ai_suggestion` | suggestion job | task list / task / `/meetings/:id` | `{ kind: 'overdue_tasks' \| 'meeting_action_items', count?, meetingId? }` |

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
  "mentionsOnly": false, "dmNotifications": true, "digestFrequency": "daily" }
```

- `digestFrequency` (**new**): `"daily" | "weekly" | "off"`, default `"daily"`. Any other value → 400.
- The digest email is sent only while `emailDigest` is `true` **and** `digestFrequency` is not `"off"`
  (old clients that only toggle `emailDigest` keep working: on = daily).
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
- weekly subscribers: counts of the last 7 days, on Mondays.

Grouped by workspace with a count per category (Mentions, Direct messages, Tasks assigned
to you, Meeting invitations, …) plus "Still unread", and a link to `/notifications`.
Users with nothing new get no email. The in-app daily `digest` notification is unchanged.

### Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `MEETING_REMINDER_MINUTES` | 10 | reminder lead time |
| `OFFLINE_EMAIL_MINUTES` | 15 | how long a user must be away before mention/DM emails |
| `DIGEST_EMAIL_HOUR_UTC` | 8 | earliest UTC hour for digest emails |
