# Automations API

Base path: `/api/v2/automations` (signed-in user, `Authorization: Bearer <access token>`).
Reading needs workspace membership; creating, editing, deleting and running needs a workspace **admin or owner**.

An automation is **trigger → conditions → steps**. Steps run in order and each step's output is
available to the steps after it, so "PR merged → post in #engineering → create release task" is one automation.

## Triggers

| `trigger.type` | Fired from | Event data (metadata only) |
|---|---|---|
| `task.created` | tasks service (create, subtask, public API), both task stores | `taskId, title, status, priority, type, tags[], channelId, assigneeId, assigneeIds[], assigneeUsernames[], createdBy, userId (actor), dueDate, storyPoints, issueKey, parentTaskId` |
| `task.completed` | a task moving to `done` (UI, API, or an integration such as a merged PR) | same as above + `completedAt` |
| `message.sent` | channel messages in **public** channels (REST and socket sends). DMs and private channels never trigger automations. Messages posted by an automation never re-trigger. | `messageId, channelId, channelName, senderId, senderUsername, type, isThreadReply, parentId, hasAttachments, attachmentCount, attachmentTypes[], createdAt` — **no text**: messages are end-to-end encrypted |
| `file.uploaded` | workspace file library uploads (`POST /api/v2/files`). Chat attachments are not included. | `fileId, fileName, extension, mimeType, size, sizeMB, folderId, tags[], userId, uploadedBy` |
| `meeting.completed` | huddles and scheduled meetings ending (see meetings.md) | `meetingId, title, kind ('huddle'\|'scheduled'), durationMinutes, participantCount, actionItemCount` |
| `github.pr_merged` | GitHub integration webhook | `repo, title, actor, event` (raw payload) |
| `webhook.received` | any integration webhook | `webhookType, event` (raw payload) |
| `scheduled` | the scheduler (see Schedules) | `automationId, scheduledAt, userId` (the automation's creator) |

Every event also carries `workspaceId`.

## Template variables

Any string in a step's `config` (also nested objects/arrays, e.g. a webhook `payload`) can use `{{path}}`:

- `{{title}}`, `{{priority}}` … — the event data;
- `{{task.title}}`, `{{meeting.title}}`, `{{file.fileName}}`, `{{message.channelName}}`, `{{github.repo}}` — the trigger's noun is an alias of the event data;
- `{{event.…}}` — the event data, plus the raw webhook payload's fields (`{{event.pull_request.html_url}}`);
- `{{steps.<id>.<field>}}` or `{{steps.<index>.<field>}}` (0-based) — an earlier step's output;
- `{{previous.<field>}}` — the step just before;
- `{{now}}` — ISO time of the run.

Unknown paths are left as written. A required field that still contains `{{…}}` after interpolation makes that step **skipped** (not failed).

## Conditions

```json
"conditions": [{ "field": "priority", "operator": "in", "value": ["high", "urgent"] }],
"conditionLogic": "all"
```

`conditionLogic`: `all` (default) or `any`. At most 20 conditions. `field` is a dot path into the event data.

| operator | value | matches when |
|---|---|---|
| `equals` / `not_equals` | string | case-insensitive equality |
| `contains` / `not_contains` | string | substring (string field) or element (array field), case-insensitive |
| `greater_than` / `less_than` | number or date | numeric comparison, else ISO date comparison |
| `in` | array or `"a, b, c"` | the field (or any element of an array field) is in the list |
| `exists` | `true` (default) / `false` | field present and non-empty / missing |
| `matches` | regex `"pattern"` (case-insensitive) or `"/pattern/flags"` | regular expression test |

A missing field never matches, except `not_contains` and `exists: false`.
Regex safety: pattern ≤ 200 chars; nested quantifiers (`(a+)+`), quantified alternations (`(a|b)+`),
back-references and repetition counts ≥ 1000 are rejected with 400; the tested text is capped at 2000 chars.

## Steps (actions)

```json
"actions": [
  { "id": "announce", "type": "send_message", "config": { "channelName": "engineering", "text": "🚀 {{event.title}} merged" } },
  { "id": "release",  "type": "create_task",  "config": { "title": "Release {{event.repo}}", "priority": "high", "dueInDays": 2 } },
  { "type": "assign_task", "config": { "assigneeId": "64b…" }, "continueOnError": true }
]
```

At most 10 steps. Per step: `type` (required), `config`, optional `id` (letters/digits/`_`/`-`, starts with a letter, unique), optional `name`, `continueOnError` (default `false`: a failed step stops the run and the rest are recorded as `skipped`).
Old automations (one or more actions without ids) keep working unchanged.

| type | config | output |
|---|---|---|
| `send_message` | `channelId` **or** `channelName` (`"engineering"` / `"#engineering"`), `text` (≤ 4000) | `messageId, channelId, channelName` |
| `create_task` | `title`, `description?`, `priority?` (low/medium/high/urgent), `assignedToIds?[]`, `assigneeId?`, `dueInDays?` or `dueDate?`, `tags?[]` | `taskId, taskTitle, issueKey` |
| `assign_task` | `assigneeId`, `taskId?` (defaults to the previous step's `taskId`, then the trigger's `taskId`) | `taskId, assigneeId` |
| `send_notification` | `title`, `body?`, `recipientId?` (defaults to the trigger's `userId`), `link?` | `notified` |
| `call_webhook` | `url`, `method?` (GET/POST/PUT/PATCH/DELETE), `payload?`, `headers?` | `status, data` (JSON ≤ 4 KB) |
| `post_to_slack` | `webhookUrl`, `text` | `posted` |
| `trigger_ci_pipeline` | `url`, `token?`, `payload?` | `status` |

Notes:
- `send_message` posts as the **Automations** system account, encrypted with the channel's server-held key (like Oruinwan AI). Channels whose key the server does not hold fail the step with a clear error. The channel must belong to the automation's workspace.
- `create_task` creates a workspace-visible task owned by the automation's creator, tagged `automation`. Tasks created by automations do not fire `task.created` again (no loops).
- Outbound URLs (`call_webhook`, `post_to_slack`, `trigger_ci_pipeline`) must be http(s) on a public address; redirects are not followed.

## Schedules (`trigger.type: "scheduled"`)

```json
"schedule": { "type": "cron", "expression": "30 9 * * 1-5", "timezone": "Europe/Berlin" }
"schedule": { "type": "interval", "expression": "2h" }
```

- **interval**: `<n>m|h|d`, 5 minutes to 366 days; runs when that long has passed since the last run.
- **cron**: 5 fields `minute hour day-of-month month day-of-week` in `timezone` (IANA, default `UTC`).
  `*`, lists `1,15`, ranges `1-5`, steps `*/15` `0-30/10`, names `JAN`–`DEC` `SUN`–`SAT` (0 and 7 = Sunday),
  macros `@hourly @daily @midnight @weekly @monthly @yearly @annually`. When both day-of-month and day-of-week
  are restricted, either may match (standard cron).
- A 5-field expression sent with `type: "interval"` is stored as cron (older clients).
- No schedule on a scheduled automation → `24h` interval (as before).
- The runner ticks every minute on one instance; a slot missed by up to an hour (restart) still runs once. Each slot is claimed atomically, so it runs once across instances.
- Invalid schedules → `400 { message }`.

## Endpoints

### `GET /templates`
`{ templates: [...] }` — includes multi-step and cron examples.

### `GET /schedule/preview?expression=30%209%20*%20*%201-5&type=cron&timezone=UTC&count=5`
`200 { schedule: { type, expression, timezone }, nextRuns: [ISO, …] }` · `400 { message }` when invalid. `count` 1–20.

### `POST /`
Body: `{ workspaceId, name, description?, trigger: { type, config? }, conditions?, conditionLogic?, actions: [...], schedule?, templateId? }`
`201 { automation }` · `400` validation · `403` not admin · `422` workspace limit (50).

### `GET /?workspaceId=&page=&limit=`
`{ automations, total, page, limit }`. Scheduled automations include `nextRunAt`.

### `GET /:id?workspaceId=`
`{ automation }` (with `nextRunAt` when scheduled).

### `PATCH /:id`
Body: `{ workspaceId, ...fields }` (any of `name, description, trigger, conditions, conditionLogic, actions, isActive, schedule`). Same validation as create. `{ automation }`.

### `DELETE /:id?workspaceId=`
Soft delete. `{ message }`.

### `POST /:id/run` — run now / test
Body: `{ workspaceId, eventData?: { ...sample trigger data }, dryRun?: boolean }` (admin).
- `dryRun: true` (**Test**): evaluates conditions and returns every step's interpolated config as `preview` (secrets such as `token`/`webhookUrl` masked). Nothing is executed. `200 { run }`, `run.source = "test"`.
- otherwise (**Run now**): executes the steps with `eventData` (plus `workspaceId`, `userId` = you, `manual: true`). `201 { run }`, `run.source = "manual"`.
- Conditions not met → the run is recorded with `status: "skipped"`, `conditionsMet: false`.
- Works on inactive automations, so drafts can be tested.

### `GET /:id/runs?workspaceId=&limit=20&before=<ISO>`
`{ runs: [run, …] }` newest first (member). Runs are kept 30 days.

## Run object

```json
{
  "_id": "…", "automationId": "…", "workspaceId": "…",
  "triggerType": "github.pr_merged", "triggerData": { "repo": "web", "title": "…" },
  "source": "event | schedule | manual | test", "dryRun": false, "triggeredBy": null,
  "conditionsMet": true,
  "status": "success | partial | failed | skipped",
  "error": "Step 2 (create_task): …",
  "durationMs": 182,
  "actionsExecuted": [
    { "index": 0, "stepId": "announce", "type": "send_message", "status": "success", "success": true,
      "output": { "messageId": "…", "channelId": "…", "channelName": "engineering" }, "startedAt": "…", "durationMs": 95 },
    { "index": 1, "stepId": "release", "type": "create_task", "status": "skipped", "success": false,
      "reason": "Not run: step 1 failed", "durationMs": 0 }
  ],
  "createdAt": "…"
}
```

Step `status`: `success`, `failed` (`error`), `skipped` (`reason`: missing config, earlier step failed, or test run).
Run `status`: `success` (no step failed), `partial` (some failed, some succeeded), `failed`, `skipped` (conditions not met; manual/test only — event runs whose conditions fail are not recorded).
`triggerData` is stored without sockets, capped at 16 KB (`truncated: true` when the raw payload was dropped).
