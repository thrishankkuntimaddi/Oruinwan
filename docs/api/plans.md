# Plans and limits

Every individual account and its workspaces are on the **Free** plan. **Pro** and **Enterprise** are
coming soon (`comingSoon: true`). Company accounts (a user with a company) and company workspaces
(a workspace with a `company`) are **never** limited by the free plan; they report plan `company`.

Source of truth: `server/src/shared/plans/plans.js`. Checks: `planService.js` (called by the route
guards in `planGuards.js`), AI counters: `aiQuota.js`, call timer: `huddleTimer.js`.

## Free plan

| `limit` key | Free | Counted as |
|---|---|---|
| `workspaces.create` | 2 | active personal workspaces where you are the owner |
| `workspaces.join` | 2 | active personal workspaces where you are a member but not the owner |
| `members.perWorkspace` | 11 | owner + 10 others: members who are not removed **plus pending email invites** (link invites name nobody and take no seat; bots/agents are not members) |
| `channels.perWorkspace` | 10 | non-archived channels besides the ones made with the workspace (`#general`, `#random` and the wizard's project channel, flagged `autoCreated`; in workspaces made before the flag, the project channel is recognised as the default channel without admins made with `#general`); any member may create, public or private |
| `huddles.participants` | 10 | people in one call at once |
| `huddles.minutes` | 30 | hard stop per call; warnings at 25:00 and 29:00 |
| `notes.perTemplate` | 2 | notes you created from one template in one workspace; blank notes are unlimited |
| `notes.externalSharing` | false | notes are shared with workspace members only (there is no public link) |
| `tasks.perWorkspace` | 300 | tasks not done / cancelled / deleted |
| `tasks.selfCreated` | 30 | active tasks you created that are assigned only to you |
| `tasks.assignedToOthers` | 30 | other active tasks you created; tasks assigned **to** you are unlimited |
| `ai.userDaily` | 50 | AI requests per person per UTC day |
| `ai.workspaceDaily` | 300 | AI requests per workspace per UTC day |

`null` = unlimited. **Grandfathering:** only new additions are refused; anything that already
exists over a limit keeps working (nothing is deleted, hidden or made read-only).

### Plan fields

`users.plan` and `workspaces.plan` (PostgreSQL, migration `0010_plan_limits.sql`), default `'free'`.
User-scoped limits (`workspaces.*`, `ai.userDaily`) use the user's plan; everything else uses the
workspace's plan.

### Self-hosting

| env | effect |
|---|---|
| `ORUINWAN_UNLIMITED=1` | every plan is unlimited: no refusals, no AI caps, no call timer |
| `PLAN_LIMITS_JSON` | JSON merged over the defaults, per plan, e.g. `{"free":{"ai.userDaily":200,"channels.perWorkspace":null}}` |
| `HUDDLE_MAX_PARTICIPANTS` | the server's own technical cap per call (default 10, any plan) |

## Refusals

Every refused addition answers **HTTP 403**:

```json
{
  "code": "PLAN_LIMIT",
  "limit": "workspaces.create",
  "max": 2,
  "used": 2,
  "plan": "free",
  "upgradeUrl": "/pricing",
  "message": "You've reached the free plan limit: 2 workspaces you created. Pro and Enterprise are coming soon.",
  "success": false,
  "error": "…same as message…"
}
```

Where they happen:

| Request | limits checked |
|---|---|
| `POST /api/workspaces`, `/create`, `/import`, `/:id/clone` | `workspaces.create` |
| `POST /api/workspaces/join` | `workspaces.join` (joiner), `members.perWorkspace` (your own pending email invite already holds your seat) |
| `POST /api/workspaces/:id/invite` | `members.perWorkspace` (each email takes a seat; a link needs one free seat) |
| `POST /api/channels`, `POST /api/workspaces/:id/channels` | `channels.perWorkspace` |
| `POST /api/v2/notes` (`templateId`) | `notes.perTemplate` |
| `POST /api/v2/tasks`, `/:id/subtasks`, message → task, meeting action item → task, task templates, public API, AI "extract and create" | `tasks.*` |
| `POST /api/v2/tasks/:id/restore` (a restored task that is open becomes active again) | `tasks.*` of the task's creator |
| `PUT /api/v2/tasks/:id` reopening (done / cancelled → an open status) | `tasks.*` of the task's creator |
| `PUT /api/v2/tasks/:id` `assignedTo` moving an active task from its creator alone to anyone else | `tasks.assignedToOthers` of the task's creator |
| tasks created by integrations (GitHub, Jira, … `task.create` effects) | `tasks.perWorkspace`, `tasks.assignedToOthers` of the person who connected it: over them no task is made, the channel card says why (`integration.extra.planNote`) and the webhook result lists `skippedTasks` |
| any AI endpoint answered with the server's key | `ai.userDaily`, `ai.workspaceDaily` |

When an invite cannot be accepted because the invitee reached `workspaces.join`, the inviter gets a
socket event and an in-app notification (type `plan_limit`):

```json
// socket "plan:limit_reached" → user_<inviterId>
{ "code": "PLAN_LIMIT", "limit": "workspaces.join", "workspaceId": "…", "workspaceName": "Acme",
  "userId": "…", "username": "Sam", "message": "Sam couldn't join Acme: they've reached the free plan limit of 2 joined workspaces." }
```

`POST /api/ai/extract-tasks` with `create: true` stops creating at the task limit and returns
`planLimit` (the body above) next to `created`.

Tasks that are already active are never refused, whatever the counts (grandfathering).

### Bulk creates: create what fits, report the rest

Cloning, importing and applying a template never fail because of the channel or member limits;
they create what fits and say what they skipped:

| Request | skipped and reported |
|---|---|
| `POST /api/workspace-os/:id/clone`, `POST /api/workspaces/:id/clone` | channels past `channels.perWorkspace` (channels made with the source workspace always come along); with members (`includeMembers` / `includeMembership`), people past their own `workspaces.join` or the clone's `members.perWorkspace` (the cloner is the owner; the source's other owners become admins) |
| `POST /api/workspace-os/import`, `POST /api/workspaces/import` | channels past `channels.perWorkspace` (a bundle can't mark its own channels free) |
| `POST /api/workspaces` / `/create` with `templateId`, `POST /api/workspace-templates/:id/import` | template channels past `channels.perWorkspace` |

```json
{
  "workspace": { "id": "…", "name": "Acme (copy)" },
  "skippedChannels": ["design", "ops"],
  "channelLimit": 10,
  "skippedMembers": [{ "userId": "…", "name": "Sam", "reason": "workspaces.join" }],
  "skippedMessage": "2 channels skipped: free plan allows 10 channels. 1 person was not added: free plan limits (members per workspace or workspaces joined)"
}
```

Company workspaces and company accounts skip nothing. Signing up with an invite makes a company
account only when the invite belongs to a company; an invite to a personal workspace keeps a
personal (free plan) account.

## GET /api/plan?workspaceId=

Auth required; `workspaceId` optional (must be a workspace you are a member of).

```json
{
  "plan": "free", "userPlan": "free", "workspacePlan": "free", "exempt": false, "upgradeUrl": "/pricing",
  "plans": [{ "id": "free", "name": "Free", "comingSoon": false }, { "id": "pro", "name": "Pro", "comingSoon": true }, { "id": "enterprise", "name": "Enterprise", "comingSoon": true }],
  "limits": { "workspaces.create": 2, "members.perWorkspace": 11, "…": "…" },
  "usage":  { "workspaces.create": 1, "members.perWorkspace": 4, "ai.userDaily": 12, "…": "…" },
  "items": [ { "key": "workspaces.create", "label": "Workspaces you created", "used": 1, "max": 2, "atLimit": false, "scope": "user" }, "…" ],
  "notes": { "perTemplate": 2, "byTemplate": { "meeting": 1 }, "externalSharing": false },
  "huddles": { "participants": 10, "minutes": 30 },
  "ai": { "userUsed": 12, "userMax": 50, "userRemaining": 38, "workspaceUsed": 40, "workspaceMax": 300, "workspaceRemaining": 260, "resetsAt": "2026-10-22T00:00:00.000Z", "exempt": false },
  "blocked": { "workspaces.create": false, "channels.perWorkspace": false, "…": false }
}
```

`items` is in display order (personal items, then workspace items when `workspaceId` is given).
`blocked[key]` is true when the next addition would be refused (use it to disable create buttons).
A usage count that cannot be computed is left out rather than failing the request.

## GET /api/plan/ai?workspaceId=

Today's AI counters only: `{ userUsed, userMax, userRemaining, workspaceUsed, workspaceMax, workspaceRemaining, resetsAt, exempt }`.

## AI counting

The single choke point is `server/src/features/ai/ai.gatewayResolver.js`: every model request the
server makes goes through it (in-process or the standalone AI service). A request is counted when it
is answered with the server's own key (no `provider` in the gateway context). Requests through a
person's own installed key (Agents & tools, `keySource: 'personal'`) or a workspace-installed provider
key are **not** counted. `rerank` and `classify_intent` are helper steps of a larger request and are not
counted; system jobs without a person or workspace are not counted.

Counters: `ai:u:<userId>:<YYYY-MM-DD>` and `ai:w:<workspaceId>:<YYYY-MM-DD>`, increment-then-check, so
concurrent requests on several instances never get past the limit; a refused request gives its
increments back. Store: Redis (`INCRBY` + expiry) when `REDIS_URL` is set, otherwise MongoDB
(`plancounters`, upsert `$inc`, TTL index), otherwise process memory (single instance).

After each counted request the person's apps receive:

```json
// socket "plan:ai_usage" → user_<userId>
{ "workspaceId": "…", "userUsed": 13, "userMax": 50, "workspaceUsed": 41, "workspaceMax": 300, "resetsAt": "…" }
```

## Calls (huddles)

- Whose plan applies is decided on the server: the channel's workspace, the DM's workspace, or the
  workspace of a workspace huddle (membership checked). A workspace id sent by the client never
  exempts a call. A DM outside any workspace follows the **caller's own plan** (the person who
  opened the call): free → 10 people / 30 minutes; company accounts are not limited.
- The people limit is checked in the same step that adds the person to the call's registry (no
  wait in between), so two joins on one server can't both take the last place. With several
  servers the registry copies converge through replication; two joins landing on two servers
  within that delay can still overshoot by one.

- `huddle:join` past the plan's people limit is refused:
  `huddle:error { huddleId, code: 'PLAN_LIMIT', limit: 'huddles.participants', max: 10, used: 10, plan, upgradeUrl, message }`.
  Someone already in the call may always re-join (another device).
- `huddle:roster` carries `timeLimit: { maxMinutes: 30, startedAt, endsAt }` (null when the plan has no limit)
  and `maxParticipants` (the plan's cap when lower than the server's).
- Every instance sweeps its registry copy every 5 s. Warnings and the end are one-shot claims
  (Redis `SET NX` / MongoDB / memory), so they happen once per call however many instances run:
  - `huddle:time_warning { huddleId, meetingId, minutesLeft: 5 | 1, endsAt, maxMinutes: 30, plan, message }` to everyone in the call at 25:00 and 29:00;
  - at 30:00 the call ends for everyone: `huddle:ended { …, reason: 'time_limit', message: "This call ended at the free plan's 30-minute limit. Your notes are saved in the meeting notes." }`.
    Ending completes the call's meeting record as any other end does; meeting notes are kept.

## Notes

`POST /api/v2/notes` accepts `templateId` (`meeting`, `projectspec`/`spec`, `techdesign`/`tech`,
`brainstorm`, `sop`, `announcement`, `document`; `blank` or none = blank note). The note stores
`templateKey`. Notes created before this field existed are not counted.
