# Roadmap & milestones API

Server code: `server/src/features/roadmap/` (roadmap items) and `server/src/features/milestones/`
(milestones, task linking, progress). Every route needs the usual `Authorization: Bearer <access token>`.
Errors are always `{ message }` (plus `errors: [ids]` when some referenced ids were rejected).

Both work on either task store (`TASKS_STORE=pg` → PostgreSQL, otherwise MongoDB); ids are 24-hex strings in both.

---

## Progress model (shared)

```jsonc
// "progress" on a milestone
{ "total": 4, "done": 3, "open": 1, "percent": 75, "estimatedHours": 12, "remainingHours": 2, "complete": false }
```

* Cancelled tasks are left out of every count.
* `percent = done / total` (rounded). A milestone with no tasks is `100` when its status is `completed`, else `0`.
* `complete` is true when the milestone status is `completed` or all its counted tasks are done.
* `estimatedHours` / `remainingHours` sum `Task.estimatedHours` (all counted / not done).

Roadmap item progress uses every task reachable from the item — directly linked `taskIds`, tasks of linked
`milestoneIds`, and tasks of the linked `projectId` (deduplicated):

```jsonc
{
  "percent": 67,                       // tasks when there are any; else completed milestones / milestones; else 100 if status=done, 0 otherwise
  "tasks": { "total": 3, "done": 2, "open": 1, "percent": 67, "estimatedHours": 5, "remainingHours": 3 },
  "milestones": { "total": 2, "completed": 1, "items": [ { "_id", "name", "status", "dueDate", "total", "done", "percent", "complete", ... } ] }
}
```

---

## Milestones — `/api/milestones`

Access: any active member of the workspace reads, creates, edits and deletes. Linking a task also requires the
caller to see the task (workspace-visible, or they created / are assigned to it).

Milestone fields: `_id, workspace, company, name, description, dueDate, startDate, endDate,
status ('not_started' | 'in_progress' | 'completed' | 'at_risk'), createdBy, deleted, createdAt, updatedAt`.

| Method | Path | Body / query | Response |
| --- | --- | --- | --- |
| GET | `/api/milestones?workspaceId=` | | `{ milestones: [Milestone & { taskCounts: {total, done}, progress }] }` |
| POST | `/api/milestones` | `{ workspaceId, name, description?, dueDate?, startDate?, endDate?, status? }` | 201 `{ milestone }` |
| GET | `/api/milestones/:id` | | `{ milestone: Milestone & { taskCounts, progress, tasks: [TaskSummary] } }` — `tasks` only lists tasks the caller can see; counts include all |
| GET | `/api/milestones/:id/progress` | | `{ milestoneId, progress }` |
| PUT / PATCH | `/api/milestones/:id` | any of `name, description, dueDate, startDate, endDate, status` (dates may be `null`) | `{ milestone }` |
| DELETE | `/api/milestones/:id` | | `{ message }` — soft delete; its tasks are detached (`milestoneId = null`) |
| POST | `/api/milestones/:id/tasks` | `{ taskIds: string[] }` (≤ 200) | `{ milestoneId, linked: [ids], progress }`; 400 + `errors` for tasks outside the workspace / not visible. A task moves from its previous milestone. |
| DELETE | `/api/milestones/:id/tasks/:taskId` | | `{ milestoneId, unlinked, progress }`; 404 if the task is not on this milestone |

`TaskSummary = { _id, title, status, milestoneId, project, workspace, visibility, createdBy, assignedTo[], channel, issueKey, dueDate, priority, estimatedHours }`.

Validation: `name` non-empty (≤ 200), `status` in the enum, dates parseable, `startDate <= endDate` → else 400.

Socket: after create/update the server emits `milestone:updated { action: 'created' | 'updated', milestoneId }`
to `workspace:<workspaceId>`.

---

## Roadmap items — `/api/v2/roadmap`

### Model `RoadmapItem`

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | id | |
| `workspaceId` | id | |
| `title` | string ≤ 200 | required |
| `description` | string ≤ 10000 | |
| `status` | `planned` \| `in_progress` \| `at_risk` \| `done` | default `planned` |
| `startDate`, `endDate` | ISO date \| null | `startDate <= endDate` |
| `ownerId` | user id \| null | active member; defaults to the creator. Hydrated to `{ _id, username, profilePicture }` in responses |
| `milestoneIds` | id[] | milestones of the same workspace (≤ 200) |
| `taskIds` | id[] | tasks of the same workspace the caller can see (≤ 200) |
| `projectId` | id \| null | its tasks count toward progress |
| `channelId` | id \| null | a channel of the same workspace |
| `quarter` | `"YYYY-Qn"` \| null | e.g. `"2026-Q4"` |
| `order` | number | lane order; new items go last |
| `color` | `accent` \| `color-primary` \| `color-success` \| `color-warning` \| `color-danger` \| `text-muted` | **theme token names**, render as `var(--<color>)`; default `accent` |
| `createdBy` | user id | hydrated like `ownerId` |
| `progress` | object | computed on read (see above) |
| `canEdit` | boolean | computed for the caller |

### Permissions

* read: any active workspace member
* create, reorder, change owner: workspace owner/admin, or a company owner/admin/manager (`companyRole`) of the
  workspace's company ("managers")
* edit: managers as above, the item's `ownerId`, or its creator
* delete: managers or the creator

### Routes

| Method | Path | Body / query | Response |
| --- | --- | --- | --- |
| GET | `/api/v2/roadmap/meta` | | `{ statuses: [...], colors: [...] }` |
| GET | `/api/v2/roadmap?workspaceId=&quarter=&status=` | `quarter`, `status` optional filters | `{ items: [RoadmapItem], canCreate, statuses, colors }` sorted by `order`, then `startDate` |
| POST | `/api/v2/roadmap` | `{ workspaceId, title, description?, status?, startDate?, endDate?, ownerId?, milestoneIds?, taskIds?, projectId?, channelId?, quarter?, order?, color? }` | 201 `{ item }` |
| GET | `/api/v2/roadmap/:id` | | `{ item }` (404 for items outside your workspaces) |
| PATCH | `/api/v2/roadmap/:id` | any create field except `workspaceId` | `{ item }` |
| DELETE | `/api/v2/roadmap/:id` | | `{ message }` (soft delete) |
| POST | `/api/v2/roadmap/reorder` | `{ workspaceId, order: [itemId, ...] }` | `{ order }` — each item's `order` = its index |

### Socket

`roadmap:updated` is emitted to `workspace:<workspaceId>` after every change:
`{ workspaceId, action: 'created' | 'updated' | 'deleted' | 'reordered', itemId?, order? }`. Clients refetch the list.
