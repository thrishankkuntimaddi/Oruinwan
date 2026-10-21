# Tasks API: planning, recurrence, dependencies, time tracking, templates

Base path: `/api/v2/tasks` (all routes need `Authorization: Bearer <token>`).
Task templates live at `/api/task-templates`. Errors are `{ message, errors?, code? }`.

Both task stores (MongoDB default, PostgreSQL with `TASKS_STORE=pg`) behave the same.

## Planning fields on create / update

`POST /api/v2/tasks` and `PUT /api/v2/tasks/:id` now accept and save:

| field | type | notes |
|---|---|---|
| `milestoneId` | id \| null | must be a live milestone of the task's workspace (400 otherwise); `null` unlinks |
| `sprintId` | id \| null | must be a live sprint of the task's workspace; `null` removes it from the sprint |
| `estimatedHours` | number ≥ 0 \| null | (update already accepted it; create now does too) |
| `storyPoints` | number ≥ 0 \| null | create too |
| `startDate` | ISO date \| null | |
| `recurring` | object \| null | see below; `null`, `false` or `{ isRecurring: false }` turns recurrence off |
| `ignoreBlockers` | boolean | update only: complete a task even though blockers are open |

On update, changing `milestoneId`, `sprintId`, `startDate` or `recurring` needs edit rights
(task creator or workspace owner/admin), like the other detail fields. Each change is logged
in the task activity (`action: 'updated'`, `field: 'milestoneId' | 'sprintId' | 'startDate' | 'recurring'`).

### `recurring`

```json
{
  "isRecurring": true,
  "pattern": "daily | weekly | monthly | custom",
  "interval": 1,
  "daysOfWeek": [1, 3],
  "dayOfMonth": 15,
  "endDate": "2026-12-31",
  "nextDue": "2026-11-04T09:00:00.000Z"
}
```

- `daily`: every `interval` days. `custom`: every `interval` days (with `daysOfWeek`: those weekdays every week).
- `weekly`: every `interval` weeks; with `daysOfWeek` (0 = Sunday … 6 = Saturday) on those weekdays of every `interval`-th week.
- `monthly`: every `interval` months on `dayOfMonth` (defaults to the day of the first occurrence; clamped to short months: Jan 31 → Feb 28 → Mar 31).
- `endDate`: no occurrence after it. A date-only value (`YYYY-MM-DD`) includes that whole day (UTC).
- `nextDue`: due date of the next copy to create. If omitted, the server computes it: the task itself is the first
  occurrence (at its `dueDate`, or now), so the first generated copy is the occurrence after it.
- All dates are calculated in UTC. `interval` is 1..365.

The stored rule comes back on the task as `recurring` (same shape, dates as ISO strings).

The generator runs hourly (one run fleet-wide). For each due rule it claims the run atomically
(so two instances never create the same copy), creates one new task due at `nextDue` (copying
title, description, assignees, visibility, channel, priority, tags, labels, estimatedHours,
storyPoints, milestoneId; status `todo`; its own issue key) plus copies of the series task's live
subtasks, then moves `nextDue` past now. Missed occurrences after an outage are skipped (one
catch-up copy, not one per missed day). When the next occurrence would be after `endDate`, the
rule switches off (`isRecurring: false`).

## Dependencies and blockers

A task's blockers are its `dependencies` plus tasks linked to it as `is_blocked_by`.

- `POST /:id/dependency` `{ dependencyTaskId }` → `{ dependencies: [id] }` (unchanged)
- **`DELETE /:id/dependency/:dependencyId`** → `{ dependencies: [id] }` — creator, assignees or workspace managers; 400 on a malformed id.
- **`GET /:id/blockers`** → `{ blocked: boolean, blockers: [{ _id, title, issueKey, status }] }` — only blockers that are not done/cancelled/deleted.

Completing a blocked task: `PUT /:id { status: 'done' }` answers
**409** `{ message, code: 'TASK_BLOCKED', blockers: [...] }` while blockers are open.
Send `{ status: 'done', ignoreBlockers: true }` to complete it anyway (the UI should ask first).

## Time tracking

Every member runs their own timer on a task (one open session per user per task). Sessions are
stored as `timeTracking.sessions[] = { start, end, user, source: 'timer' | 'manual', note? }`;
`timeTracking.totalTime` is the sum of closed sessions in seconds (older sessions without `user`
still count).

- `POST /:id/time/start` → `{ message, timeTracking }` — 400 if *your* timer is already running.
- `POST /:id/time/stop` → `{ message, elapsed, timeTracking }` — stops *your* running timer; 400 if none.
- **`POST /:id/time/log`** `{ minutes | seconds, start?, note? }` → 201 `{ message, timeTracking }` — log time without the timer (1 s … 24 h; `start` defaults to "ending now"; `note` ≤ 500 chars).
- **`GET /:id/time`** →
  ```json
  { "taskId": "…", "estimatedHours": 4, "totalSeconds": 5400, "runningSeconds": 120,
    "byUser": [{ "userId": "…", "seconds": 3720, "running": true, "sessions": 2,
                 "user": { "_id": "…", "username": "ana", "profilePicture": null } }] }
  ```
  `totalSeconds` = closed sessions; `runningSeconds` = open timers up to now (also included in each user's `seconds`).
- **`GET /time/report?workspaceId=&from=&to=`** → `{ workspaceId, from, to, totalSeconds, byUser: [{ userId, seconds, tasks, running, user }], byTask: [{ taskId, title, issueKey, estimatedHours, seconds }] }` — across the workspace tasks the caller can see; `from`/`to` keep sessions that started in the range.

All need the caller to be able to see the task (same visibility rules as `GET /:id`).

## Workload

`GET /workload?workspaceId=` → `{ workload: [{ userId, count, estimatedHours, unestimated, user }] }`

- `count`: open (not done/cancelled) tasks assigned to the user that the caller can see.
- `estimatedHours`: sum of `estimatedHours` over those tasks (a task shared by several assignees counts in full for each).
- `unestimated`: how many of those tasks have no estimate.

## Subtasks

Unchanged: `POST /:id/subtasks { title, description?, assignedTo?: [id], priority?, dueDate?, tags? }`.
Subtasks cannot be nested; the parent's `subtasks` list comes back on `GET /:id`.

## Task templates (`/api/task-templates`)

Template fields: `name` (required), `title`, `description`, `priority`, `tags`, `estimatedHours`,
`subtaskTitles: string[]` (the template's checklist; trimmed, blanks dropped, max 50), `automationRules`.

- `GET /?workspaceId=` → `{ templates }`
- `POST /` `{ workspaceId, name, ... }` → 201 `{ template }`
- `PUT /:id` → `{ template }` · `DELETE /:id` → `{ message }`
- **`POST /:id/apply`** → 201 `{ message, templateId, tasks: [task], subtasks: [subtask] }`

  Creates a task from the template, then one subtask per `subtaskTitles` entry (assigned to the
  new task's assignees). Body fields override the template or add to it — any create-task field:
  `title, description, priority, tags, estimatedHours, dueDate, startDate, milestoneId, sprintId, recurring,
  assignmentType, assignedToIds, channelId, taskMode, status, labels`. With `assignmentType: 'individual'`
  and `taskMode: 'split'`, each assignee gets their own task and their own subtasks. The returned
  `tasks` are re-read, so they include their `subtasks`.


## Socket events

Unchanged: `task-created`, `task-updated`, `task-assigned`, `task-removed`, `subtask-created`.
Time and dependency changes do not emit events; clients re-read `GET /:id/time` or `/:id`.
