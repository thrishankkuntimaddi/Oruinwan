# Meetings & huddles, unified (one record per call)

Every call has **one meeting record** with one page:

- a **scheduled meeting** (`kind: "scheduled"`), created from the schedule UI / AI; its call runs
  under the huddle id `meeting-<meetingId>`;
- an **ad-hoc huddle** (`kind: "huddle"`) started in a channel, a DM or the workspace; the record is
  created by the server when the huddle starts (no client call needed).

The record owns everything about the call, across every run of its huddle:

| Thing | Where it lives now | Was |
|---|---|---|
| Notes | one `Note` (`meeting.noteId`), the same before, during and after every run | `sharedNotes` text; a new Note per huddle run |
| Action items | `meeting.actionItems` | `meeting.actionItems` + action blocks in the huddle Note + huddle linked tasks |
| Summary | `meeting.summary` | `meeting.summary` + huddle draft summary + wrap-up chat message |
| Recording / transcript | the meeting (`/api/v2/meetings/:id/recording`, `/transcript`) | the huddle session for ad-hoc huddles |
| Whiteboard / brainstorm | keyed by `meetingId` (ad-hoc huddles have one too) | scheduled meetings only |

The menu is still called **Huddles**. When a call ends, people stay where they are and get a
`meeting:ended` socket event ("Meeting ended · View recap") plus a `meeting_recap` notification.

Server code: `server/src/features/meetings/meetingRecords.js` (records, notes, action items, summary,
end, lists), `meetingAccess.js` (access), `server/src/modules/huddles/*` (huddle side).
Older endpoints in [`meetings.md`](./meetings.md) keep working; this page wins where they differ.

All routes need `Authorization: Bearer <token>` unless marked **signed**. Errors are `{ message }` with
400 (bad input), 403 (no access), 404 (not found), 409 (limit reached).

---

## Access

A caller may open a meeting (every `/api/v2/meetings/:id*` route, `meeting:join`, the whiteboard /
brainstorm routes, collab on its note and whiteboard) when they are an **active member of the
meeting's workspace** and one of:

- the organiser (`createdBy`), an invitee (`invitees`) or a participant (`participantIds`);
- a member of the meeting's conversation: **channel members** for a channel meeting, the **DM
  participants** for a DM meeting, **any workspace member** for a workspace meeting (no channel/DM).

Otherwise `403`. Unknown id `404`, malformed id `400`.

---

## The meeting object

Returned by `GET /api/v2/meetings/:id`, `GET /api/v2/meetings/by-huddle/:huddleId`, list items, and as
`meeting` in most write responses. Fields clients should use:

```jsonc
{
  "id": "6720…",                       // = _id
  "kind": "scheduled",                 // "scheduled" | "huddle"
  "title": "Planning",                 // ad-hoc: "Huddle in #design" | "Huddle with Carol" | "Workspace huddle"
  "status": "completed",               // "scheduled" | "live" | "completed" | "cancelled"
  "workspaceId": "…",

  "scheduledStart": "2026-10-22T10:00:00.000Z",  // scheduled meetings only, else null
  "scheduledEnd":   "2026-10-22T10:30:00.000Z",  // scheduledStart + duration minutes, else null
  "startedAt": "2026-10-22T10:02:11.000Z",       // first time the call went live (null if never)
  "endedAt":   "2026-10-22T10:41:03.000Z",       // last time it ended (null while live / never held)
  "durationSec": 2332,                           // endedAt - startedAt, set when it ends (null before)

  "conversation": { "kind": "channel", "id": "<channelId>", "name": "design" },
  //  kind "channel" | "dm" (id = DM session id, name = the other person's/people's names) | "workspace" (id = workspaceId, name null)

  "huddleId": "meeting-6720…",         // the huddle id to join: "meeting-<id>" (scheduled) or the ad-hoc huddle's id
  "video": false,                      // ad-hoc huddles: started as a video call

  "createdBy": { "_id": "…", "username": "alice", "profilePicture": "…" }, // user card on GET /:id; id or card in lists
  "participants": [ { "_id": "…", "username": "bob" } ],  // LEGACY: everyone involved (cards on GET /:id, ids in lists)
  "participantIds": ["…"],             // everyone involved: invitees + everyone who joined
  "invitees": ["…"],                   // invited when scheduled ([] for ad-hoc huddles)
  "attendees": [ { "userId": "…", "username": "bob", "joinedAt": "…" } ],  // who actually joined (first join)

  "agenda": [ { "_id": "…", "title": "Launch date", "notes": "", "order": 0 } ],
  "noteId": "…",                       // the meeting's Note (null until first opened: POST /:id/notes)

  "actionItems": [ {
    "id": "…",                         // = _id
    "text": "Draft the release notes",
    "assigneeId": "…",                 // or null
    "dueDate": "2026-11-01T00:00:00.000Z",  // or null
    "done": false,
    "status": "pending",               // "pending" | "in_progress" | "done" (done === status "done")
    "taskId": null,                    // set when converted to / linked with a task
    "source": "manual",                // "manual" | "ai" | "huddle" (huddle panel) | "task" (linked task)
    "clientId": null,                  // the huddle panel's own id for items it created
    "createdBy": "…", "createdAt": "…",
    "assignedTo": "…"                  // LEGACY: same as assigneeId (a user card on GET /:id)
  } ],

  "summary": {                         // null when there is none
    "text": "We agreed to ship Monday…",
    "generatedAt": "…",
    "by": "<userId>",                  // who generated / posted / edited it
    "source": "ai",                    // "ai" (/:id/summarize) | "wrap-up" (huddle wrap-up) | "manual" (PUT /:id/summary)
    "messageId": null,                 // the wrap-up chat message, when posted to a conversation
    "channelId": null, "dmId": null    // where it was posted
  },

  "recording": {                       // null when there is none (one recording per meeting; a new upload replaces it)
    "mimeType": "video/webm", "size": 1234567, "durationSec": 2330,
    "originalName": "", "uploadedBy": "…", "uploadedAt": "…"
  },
  "recordingUrl": "/api/v2/meetings/:id/recording",  // or null
  "hasRecording": true,
  "hasTranscript": true,               // transcript segments exist (GET /:id/transcript)
  "hasContent": true,                  // notes / action items / summary / recording / transcript were added

  "whiteboard": { "exists": true, "strokeCount": 12, "updatedAt": "…" },  // GET /:id and by-huddle only; null in lists
  "brainstorm": { "exists": false, "itemCount": 0, "updatedAt": null },   // GET /:id and by-huddle only; null in lists

  "startTime": "…", "duration": 30,    // LEGACY: scheduled start / planned minutes (ad-hoc: startTime = startedAt)
  "sharedNotes": "",                   // DEPRECATED, read-only (see Migration)
  "meetingLink": null, "channelId": null, "dmSessionId": null, "createdAt": "…", "updatedAt": "…"
}
```

---

## Endpoints

### Lists

#### `GET /api/v2/meetings?workspaceId=&status=&kind=&q=&before=&after=&limit=&includeShort=`

Scheduled meetings **and** ad-hoc huddles the caller can open (see Access), in one workspace.

| Query | Meaning |
|---|---|
| `workspaceId` | required; caller must be an active member (403) |
| `status` | `upcoming` (scheduled, not over yet; soonest first) · `live` (newest first) · `past` (completed; newest first). Other values `400`. **Without `status` the old list is returned** (scheduled meetings only, `{ meetings }`, see meetings.md). |
| `kind` | optional `scheduled` \| `huddle` (`400` otherwise) |
| `q` | optional, case-insensitive match on the title |
| `limit` | 1–100, default 20 |
| `before` | `past` / `live` paging: the previous page's `nextBefore` (or any ISO date) |
| `after` | `upcoming` paging: the previous page's `nextAfter` |
| `includeShort` | `1` to include ad-hoc huddles that lasted ≤ 60 s **and** have no content (hidden from `past` by default) |

Sort key is `startTime` (scheduled start, or `startedAt` for ad-hoc huddles).

Response `200`:

```jsonc
{ "meetings": [ /* meeting objects (no whiteboard/brainstorm) */ ], "hasMore": true, "nextBefore": "2026-10-20T10:00:00.000Z|6720…" }
// status=upcoming: { meetings, hasMore, nextAfter }
```

`nextBefore` / `nextAfter` are `null` on the last page. Pass them back unchanged.

#### `GET /api/v2/meetings/by-huddle/:huddleId`

The meeting record of a huddle id (`meeting-<id>` → that meeting; an ad-hoc huddle id → its latest
record). `200 { meeting }`, `400` bad id, `403` no access, `404` the huddle has no record.
Usually not needed: huddle socket payloads carry `meetingId` (below).

#### `GET /api/v2/meetings/:id`

`200 { meeting }` (full object, user cards attached).

### Lifecycle

#### `POST /api/v2/meetings/:id/join`

Marks the meeting live (sets `startedAt` the first time) and adds the caller to `participants`.
`200 { meeting }`. (Joining the actual call is the huddle socket flow with `huddleId`.)

#### `PATCH /api/v2/meetings/:id/end`

Body (optional): `{ "recordingUrl": "https://…" }`.

Ends the meeting **and its live huddle**: status `completed`, `endedAt`, `durationSec`; everyone in the
call gets `huddle:ended` (`reason: "meeting_ended"`) and is removed from it; `meeting:ended` and recap
notifications go out (below). Ending an already-ended meeting changes nothing and sends nothing.
The reverse also holds: when the huddle ends (`huddle:end`, or the last person leaves) the meeting is
completed the same way. `200 { meeting }`.

### Notes

#### `POST /api/v2/meetings/:id/notes`

Returns the meeting's note, creating it the first time:

```json
{ "noteId": "6721…", "created": false }
```

- One `Note` per meeting for its whole life (`type: "meeting"`, `meeting: <meetingId>`, owner = the
  organiser / huddle starter, `allowEditing: true`, tag `meeting`). Every run of the meeting's huddle
  uses this same note (`POST /api/v2/huddles/:huddleId/notes` returns it too).
- The caller is added to the note's `sharedWith`, so it also shows in their Notes app.
- On creation: `meeting:note_ready { meetingId, noteId }` to `meeting:<id>` and `huddle:<huddleId>`
  (and `huddle:notes_ready { huddleId, noteId, meetingId }` when opened from the huddle).

**Live editing**: `collab:join { docType: "note", docId: noteId }` (see [collab.md](./collab.md)).
Anyone who may open the meeting can read **and write** its note over collab, even if not yet in
`sharedWith` (the collab access check falls back to the meeting's access rule). REST reads of the note
(`/api/notes/:id`) follow the Notes rules, so call `POST /:id/notes` first.

### Action items

The one list is `meeting.actionItems`. Every change emits
`meeting:action_items_updated { meetingId, actionItems }` to `meeting:<id>` and `huddle:<huddleId>`.

| Method & path | Body | Response |
|---|---|---|
| `GET /api/v2/meetings/:id/action-items` | – | `200 { actionItems }` |
| `POST /api/v2/meetings/:id/action-items` | `{ text, assigneeId?, dueDate?, done?, status?, taskId? }` (`assignedTo` accepted as alias) | `201 { meeting, actionItem, actionItems }` |
| `PATCH /api/v2/meetings/:id/action-items/:aid` | any of `text, assigneeId (null clears), dueDate (null clears), done, status, taskId` | `200 { meeting, actionItem, actionItems }`; `404` unknown item |
| `POST /api/v2/meetings/:id/action-items/:aid/toggle` | – | `200 { actionItem, actionItems }` (flips done) |
| `POST /api/v2/meetings/:id/action-items/:aid/convert` | `{ priority? }` | `200 { actionItem, actionItems, task }` — creates a task (assigned to the item's assignee, else the caller; due date carried over) and sets `taskId`. Already converted: `{ actionItem, actionItems, task: null, alreadyConverted: true }` |
| `DELETE /api/v2/meetings/:id/action-items/:aid` | – | `200 { removed, actionItems }` |
| `POST /api/v2/meetings/:id/action-items/extract` | `{ apply?: true }` | `200 { extracted, added, source, meeting }` — rule-based extraction from the transcript (else the notes); with `apply`, new texts are added (deduped case-insensitively against the list, `source: "ai"`) |

Validation: `text` non-empty (≤ 500 chars), ids 24-hex, `dueDate` a date, `done` boolean,
`status` one of `pending|in_progress|done` → `400`. Max 300 items (`409`).

Huddle side (for a meeting's huddle — every huddle now):
- `POST /api/v2/huddles/:huddleId/tasks { taskId }` adds an action item with that `taskId` (`source: "task"`,
  once per task) instead of a separate list; `DELETE /api/v2/huddles/:huddleId/tasks/:taskId` removes it.
  Both still answer `{ taskIds, meetingId }` and emit `huddle:tasks_linked { huddleId, taskIds, meetingId }`.
- `huddle:notes_op` with `kind: "action"` / `"action_remove"` writes to `meeting.actionItems` (the panel's
  item id is kept as `clientId`; a row is stored once it has text). Paragraph ops still edit the note.
- The huddle draft summary (`POST /api/v2/huddles/:huddleId/summarize`) adds the action items it finds to the list.

### Summary

#### `POST /api/v2/meetings/:id/summarize`

The single summary. AI over the **transcript, the meeting's notes and the agenda**; saved as
`meeting.summary` (`source: "ai"`, `by` = caller) and broadcast as
`meeting:summary_updated { meetingId, summary }`.

```jsonc
{ "summary": "We agreed…",              // the text (kept for older clients)
  "meetingSummary": { "text": "We agreed…", "generatedAt": "…", "by": "…", "source": "ai", "messageId": null, "channelId": null, "dmId": null },
  "source": "transcript",               // what it was mostly built from: transcript | notes | agenda | none
  "aiFallback": false }
```

With nothing to summarise it returns the current summary unchanged (`source: "none"`).

#### `PUT /api/v2/meetings/:id/summary`

Body `{ "text": "…" }` — edit the summary by hand (`source: "manual"`). `200 { summary }`.

#### Huddle wrap-up

`POST /api/v2/huddles/:huddleId/summarize` (draft) now returns the meeting's summary for meeting huddles:
`{ huddleId, sessionId, meetingId, source, summary (text), meetingSummary, aiFallback, actionItems (meeting items), addedActionItems }`
— and saves it as `meeting.summary`.

`POST /api/v2/huddles/:huddleId/wrap-up` body: `{ "messageId": "<the posted chat message>", "summary": "<the text you posted>" }`.
The client still posts the wrap-up to the conversation itself (E2EE message, unchanged). With `summary`
the text becomes `meeting.summary` (`source: "wrap-up"`, `messageId`/`channelId`/`dmId` set); without
it, the meeting keeps its text and only records where it was posted. Response
`{ notified, recipients, meetingId }`; `huddle:wrapped_up` and the "Huddle summary posted"
notification carry `meetingId`.

> Summaries (like transcripts) are stored on the server in plain text; chat messages stay E2EE.

### Recording & transcript

Same endpoints for every meeting, including ad-hoc huddles (shapes as in meetings.md):

- `POST /api/v2/meetings/:id/recording` (multipart `file`, `durationSec`) → `201 { recording, recordingUrl }`
- `GET /api/v2/meetings/:id/recording` → `{ recording, url, expiresAt }` (signed `url` for `<video>`)
- `GET /api/v2/meetings/:id/recording/stream?…` **signed**
- `DELETE /api/v2/meetings/:id/recording`
- `POST /api/v2/meetings/:id/transcript/segments` `{ segments: [...] }` → `201 { added }`
- `GET /api/v2/meetings/:id/transcript` → `{ meetingId, segments: [{ speakerId, speakerName, text, startedAt, endedAt }], text }`

`/api/v2/huddles/:huddleId/recording`, `/recording` (GET/DELETE), `/transcript/segments` and
`/transcript` are **aliases**: for a run that has a meeting they read/write the meeting record and add
`meetingId` to the response (`GET …/recording` then returns a signed `/api/v2/meetings/:id/recording/stream` url).
Socket events go to both rooms: `huddle:recording_ready|_deleted`, `huddle:transcript_segments`
(to `huddle:<id>`, with `meetingId`) and `meeting:recording_ready|_deleted`, `meeting:transcript_segments`
(to `meeting:<id>`). Runs from before this change (no meeting) keep using the session as before.

### Whiteboard & brainstorm

Unchanged routes `GET|POST /api/v2/collaboration/whiteboard/:meetingId`, `…/brainstorm/:meetingId`
and collab `docType: "whiteboard"` with `docId = meetingId` — they work for ad-hoc huddle records too
(use the huddle's `meetingId`). Same access rule as the meeting.

---

## Socket events

### Huddle events now carry `meetingId`

| Event | Added field |
|---|---|
| `huddle:started` | `meetingId` (the record id; `null` only if the database was unavailable) |
| `huddle:existing` | `meetingId` of the running huddle |
| `huddle:roster` (to the joiner) | `meetingId` |
| `huddle:joined`, `huddle:participant_joined` | `meetingId` |
| `huddle:ended` | `meetingId`; `reason` may now also be `"meeting_ended"` |
| `huddle:list` / `huddle:active` items | `meetingId` |
| `huddle:notes_op` (relay and ack) | `meetingId` |
| `huddle:tasks_linked`, `huddle:wrapped_up`, `huddle:notes_ready` | `meetingId` |
| `GET /api/v2/huddles/:huddleId/session`, `/history` items | `meetingId` |

Clients open the meeting page with `meetingId` (fallback: `GET /api/v2/meetings/by-huddle/:huddleId`).

### `meeting:ended` (server → client)

Sent when a meeting completes (End meeting, `huddle:end`, last person left) to **each participant's
user room** (`user:<userId>`: attendees, participants/invitees and the organiser) and to `meeting:<id>`:

```jsonc
{ "meetingId": "…", "title": "Huddle in #design", "kind": "huddle",
  "conversation": { "kind": "channel", "id": "…", "name": null },
  "huddleId": "…", "endedAt": "…", "durationSec": 1820, "endedBy": "<userId>|null",
  "reason": "ended" | "huddle_ended", "timestamp": "…" }
```

Show "Meeting ended · View recap" where the user is (link `/meetings/<meetingId>`); don't navigate.

### Other `meeting:<id>` room events

Join the room with `meeting:join { meetingId }` → ack `{ ok, meetingId, workspaceId, noteId, notes }`
(`notes` = deprecated `sharedNotes`).

| Event | Payload |
|---|---|
| `meeting:note_ready` | `{ meetingId, noteId }` |
| `meeting:action_items_updated` | `{ meetingId, actionItems }` (also to `huddle:<huddleId>`) |
| `meeting:summary_updated` | `{ meetingId, summary }` (also to `huddle:<huddleId>`) |
| `meeting:recording_ready` / `meeting:recording_deleted` | `{ meetingId, recording, recordingUrl }` / `{ meetingId }` |
| `meeting:transcript_segments` | `{ meetingId, segments }` |
| `meeting:agenda_updated` | `{ meetingId, agenda }` |
| `schedule:updated` (workspace room) | `{ meeting }` — scheduled meetings only; ad-hoc huddles are never announced workspace-wide |

`meeting:notes_update` (client → server) is **deprecated**: always refused with
`{ ok: false, code: "DEPRECATED", message, noteId }`.

---

## Notifications

`type: "meeting_recap"` (preference category `meeting`, push like other meeting notifications):

```jsonc
{ "type": "meeting_recap", "title": "Planning ended", "body": "View the recap: notes, action items and summary.",
  "link": "/meetings/<meetingId>",
  "meta": { "kind": "meeting_recap", "meetingId": "…", "meetingKind": "scheduled" | "huddle", "channelId": null, "dmSessionId": null } }
```

- Sent once per person per meeting (a meeting held again does not notify the same person twice).
- Not sent for ad-hoc huddles that lasted ≤ 60 s with no content (they still get `meeting:ended`).
- Respects the recipient's workspace notification preferences; only active workspace members.

---

## Clashes and priority

Scheduling never blocks on a clash: the apps **warn**, **suggest free times** and let the organiser
**go ahead**; the invitees see the clash and both meetings' priorities. Server: `features/meetings/conflicts.js`.

- **Priority**: `priority: "low" | "normal" | "high" | "urgent"` (default `normal`) on every scheduled
  meeting. Set it on `POST /api/scheduled-meetings` or `PATCH /api/scheduled-meetings/:id`; anything else is 400.
- **What counts**: every `scheduled` / `live` ScheduledMeeting (scheduled meetings and huddle records) the
  person organises, is invited to or joined. Cancelled and completed ones never clash. Times are UTC
  instants compared as half-open intervals `[start, end)`: 9:00–9:30 and 9:30–10:00 do not clash.

### `POST /api/v2/meetings/conflicts` (also `/api/scheduled-meetings/conflicts`)

```jsonc
// body
{ "workspaceId": "…", "startTime": "ISO", "duration": 30, "participants": ["<userId>"],
  "channelId": null, "dmSessionId": null,   // a DM with nobody picked = the DM's people
  "excludeMeetingId": null,                 // the meeting being edited
  "timezone": "Europe/London", "suggest": 3 }
// answer
{ "start": "…", "end": "…", "durationMinutes": 30, "hasConflicts": true, "conflictCount": 1,
  "attendees": [{ "userId": "…", "name": "Asha", "isOrganizer": false,
    "conflicts": [{ "meetingId": "…", "title": "Design review" /* null = "Busy" */, "busy": false,
                    "start": "…", "end": "…", "priority": "high", "status": "scheduled" }] }],
  "suggestions": [{ "start": "…", "end": "…", "allAvailable": true }] }   // free for everyone, working hours
```

Titles are shown only when the caller may open that meeting; otherwise `title: null, busy: true`.

### Save-time re-check (race safety)

`POST /api/scheduled-meetings` and a `PATCH` that moves the time save first, then re-check what is in the
database and mark the clash on **both** meetings (`conflicts[]`, an atomic "push unless already listed").
Two organisers booking the same person at the same moment are therefore both flagged, whatever the order.
The answer is `{ meeting, conflicts }`. Cancelling, deleting or moving a meeting removes it from every
other meeting's `conflicts`.

`meeting.conflicts` as served (per viewer):
`[{ meetingId, userIds, mine, busy, title /* only when mine */, priority, start, end }]`.

### Socket events

| Event | Room | Payload |
|---|---|---|
| `schedule:conflict` | `user:<id>` of each double-booked person | `{ meetingId, title, priority, start, end, clashesWith: { meetingId, title, priority, start, end } }` |
| `schedule:conflicts` | `workspace:<id>` | `{ meetingIds, resolved? }` — re-read those meetings |

### Invites

`schedule_created` notifications carry `meta.priority`; when the invitee is double-booked the title says
"… · it clashes with your calendar", the body names the other meeting and its priority, and
`meta.conflicts` lists them. A moved meeting sends the same notification with `meta.moved: true`.

---

## Migration notes

- **Records for huddles**: from now on every huddle run is linked to a meeting record (`HuddleSession.meeting`).
  Runs from before this change have none and keep their own notes / tasks / recording / transcript on the
  session (the `/api/v2/huddles/:id/*` routes still serve them). A `meeting-<id>` run always resolves to
  its meeting, old or new.
- **Shared notes → note**: `ScheduledMeeting.sharedNotes` is deprecated and read-only (still returned as
  `sharedNotes`). The first time the meeting's note is opened (`POST /:id/notes` or the huddle Notes tab),
  non-empty shared notes are copied into the note (paragraphs split on blank lines) — also into an existing
  but empty note — and `sharedNotesMigratedAt` is set so it happens once.
- **Old per-run huddle notes** stay as ordinary notes in the Notes app; they are not merged.
- **Action items**: new fields `dueDate`, `source`, `clientId`, `createdBy`, `createdAt`; the stored
  `assignedTo` / `status` stay (exposed as `assigneeId` / `done` too).
- **Summary**: stored as text in `summary` (unchanged) plus `summaryMeta { generatedAt, by, source, messageId, channelId, dmId }`;
  the API returns `summary` as the **object** above. Older clients that read `meeting.summary` as a string
  must switch to `meeting.summary.text` (`POST /:id/summarize` still answers `summary` as text).
- **Lists**: `GET /api/v2/meetings` without `status` and `GET /api/scheduled-meetings` list scheduled
  meetings only, as before.
- **Access**: meetings in a channel or DM are now limited to that conversation's members plus the
  organiser / invitees / participants (previously any workspace member).
- New fields on `ScheduledMeeting`: `kind`, `conversationName`, `huddleId`, `video`, `invitees`, `attendees`,
  `startedAt`, `endedAt`, `durationSec`, `hasContent`, `hasTranscript`, `noteId`, `summaryMeta`,
  `sharedNotesMigratedAt`. `Note.meeting` links a meeting's note back to it. Notification type `meeting_recap`.
