# Meetings & huddles API

> **Unified model:** every call (scheduled meeting or ad-hoc huddle) now has one meeting record with one
> notes store, action-item list and summary. See [meetings-unified.md](./meetings-unified.md); it wins where
> it differs from this page (access rules, the summary shape, shared notes, huddle aliases).

Two kinds of calls exist:

| Kind | Model | Id | Base path |
|---|---|---|---|
| **Scheduled meeting** (calendar entry, agenda, action items) | `ScheduledMeeting` (Mongo) | 24-hex `meetingId` | `/api/v2/meetings/:id` (and `/api/scheduled-meetings` for create/list/cancel) |
| **Huddle** (the live voice/video call; one huddle id can run many times, each run is a `HuddleSession`) | `HuddleSession` (Mongo) + in-memory registry | client uuid, or `meeting-<meetingId>` when a scheduled meeting is held as a huddle | `/api/v2/huddles/:huddleId` |

All routes need `Authorization: Bearer <token>` unless marked **signed**. Errors are `{ message }` with
400 (bad input), 403 (no access), 404 (not found), 409 (limit reached), 413/415 (upload size/type).

Access: scheduled meeting routes require an active member of the meeting's workspace
(`requireMeetingAccess`). Huddle routes require being able to see the huddle (participant, channel/DM
member, or workspace member for workspace huddles); writes require having been in the call.

> Transcripts are stored server-side (unlike chat messages, they are **not** end-to-end encrypted). The
> clients produce them with on-device speech-to-text and send segments while the call runs.

---

## Availability finder

### `POST /api/v2/meetings/suggest-time`

Finds the earliest slots where every attendee is free and inside their working hours.

Body:

```json
{
  "participantIds": ["<userId>", "..."],   // the caller is always added
  "durationMinutes": 30,                   // 5–480, default 30
  "workspaceId": "<id>",                   // optional; when given, non-members are dropped (403 if caller isn't a member)
  "from": "2026-10-22T00:00:00Z",          // optional, default now (never in the past)
  "to": "2026-10-29T00:00:00Z",            // optional, default from + 7 days (max 14 days)
  "limit": 5,                              // 1–20
  "stepMinutes": 30,                       // slot grid, 5–120
  "timezone": "Europe/London"              // optional: used for attendees whose timezone is unset/'auto'
}
```

Rules:
- Busy time = the attendee's `scheduled`/`live` meetings (organised or invited).
- Working hours = `user.preferences.workingHours` (`{ start: "HH:MM", end: "HH:MM", days: [0-6] }`, 0 = Sunday) if stored,
  else **09:00–18:00 Mon–Fri**, in `user.preferences.region.timezone` (else `timezone` from the body, else UTC).
  A slot must fit in one working day for every attendee.
- If no slot fits everyone, the best partial slots (most attendees free, then earliest) are returned with `allAvailable: false`.

Response `200`:

```json
{
  "suggestedStart": "2026-10-22T13:00:00.000Z",   // = slots[0].start (kept for older clients), null when none
  "suggestedEnd":   "2026-10-22T13:30:00.000Z",
  "durationMinutes": 30,
  "slots": [
    { "start": "...", "end": "...", "score": 1, "allAvailable": true, "availableCount": 3, "attendeeCount": 3, "unavailable": [] }
  ],
  "window": { "from": "...", "to": "..." },
  "note": "No time suits everyone; showing the slots most attendees can make"   // only when relevant
}
```

---

## Recordings

Accepted files: `.webm` (`video/webm`, `audio/webm`), `.mp4` (`video/mp4`, `audio/mp4`), `.m4a`
(`audio/mp4`, `audio/x-m4a`, `audio/m4a`, `audio/aac`). `application/octet-stream` is accepted when the
extension matches. Max size `MAX_RECORDING_BYTES` (default **500 MB**). Objects are stored in the shared
object storage (S3/RustFS, or local disk in development) under `recordings/<workspaceId>/...`. Uploading
again replaces (and deletes) the previous recording.

### Scheduled meeting

| Method | Path | Who | Notes |
|---|---|---|---|
| `POST` | `/api/v2/meetings/:id/recording` | organizer, invited participant, workspace admin | multipart: `file` (required), `durationSec` (optional, 0–86400) |
| `GET` | `/api/v2/meetings/:id/recording` | any workspace member | returns a signed playback URL (10 min) |
| `GET` | `/api/v2/meetings/:id/recording/stream?u=&exp=&sig=` | **signed** | streams the file (HTTP Range supported); access re-checked |
| `DELETE` | `/api/v2/meetings/:id/recording` | uploader, organizer, workspace admin | deletes the object, clears `recording`/`recordingUrl` |

`POST` response `201`:

```json
{
  "recording": { "mimeType": "video/webm", "size": 1234567, "durationSec": 1520, "originalName": "call.webm", "uploadedBy": "<userId>", "uploadedAt": "..." },
  "recordingUrl": "/api/v2/meetings/<id>/recording"
}
```

The meeting document gets `recordingUrl` (stable API path above) and `recording` (same shape plus the
internal object `path`). `PATCH /:id/end { recordingUrl }` still accepts an external link.

`GET` response `200`:

```json
{ "recording": { ... }, "url": "/api/v2/meetings/<id>/recording/stream?u=<userId>&exp=1792560000&sig=...", "expiresAt": "..." }
```

Use `url` (prefixed with the API origin) directly as the `<video>/<audio>` `src`.

### Huddle

Same rules; the recording attaches to the running run of the huddle, else the latest one. Pass
`?sessionId=<HuddleSession id>` to target a specific past run.

| Method | Path | Who |
|---|---|---|
| `POST` | `/api/v2/huddles/:huddleId/recording` | someone who was in the call |
| `GET` | `/api/v2/huddles/:huddleId/recording` | anyone who can see the huddle |
| `GET` | `/api/v2/huddles/:huddleId/recording/stream?s=<sessionId>&u=&exp=&sig=` | **signed** |
| `DELETE` | `/api/v2/huddles/:huddleId/recording` | uploader, the person who started the huddle, workspace admin |

`POST` → `201 { sessionId, recording }`; `GET` → `200 { sessionId, recording, url, expiresAt }`;
`DELETE` → `200 { message }`. `GET /api/v2/huddles/:huddleId/session` and `/history` now include
`recording` (or `null`) and, on `/session`, `transcriptSegmentCount`.

---

## Transcript segments

Segment: `{ speakerId?: userId, speakerName?: string, text: string (≤4000), startedAt: ISO, endedAt?: ISO (≥ startedAt) }`.
Up to 200 segments per request, 5000 per meeting/huddle run (then `409`).

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/v2/meetings/:id/transcript/segments` | `{ segments: [...] }` or one segment object | `201 { added }` |
| `GET` | `/api/v2/meetings/:id/transcript` | – | `200 { meetingId, segments: [...], text }` |
| `POST` | `/api/v2/huddles/:huddleId/transcript/segments` | same (caller must be/have been in the call) | `201 { sessionId, added }` |
| `GET` | `/api/v2/huddles/:huddleId/transcript[?sessionId=]` | – | `200 { huddleId, sessionId, segments, text }` |

`segments` come back sorted by `startedAt` with `speakerName` resolved from the user's username.
`text` is the rendered transcript, one line per segment: `[mm:ss] name: text` (offset from the meeting
start / huddle run start). For meetings without segments, `text` is the legacy `transcript` string
(`PATCH /:id/transcript` still works). Meeting documents returned by the other routes no longer embed
`transcriptSegments` (use this endpoint).

### Recording / captions notices (client convention)

There is no separate "recording is on" socket event. Clients announce capture to everyone in the call by
posting a transcript segment from the person who turned it on, with exactly one of these texts:

| Text | Meaning |
|---|---|
| `(started recording the call)` / `(stopped recording the call)` | that person's recorder started / stopped |
| `(turned on live captions)` / `(turned off live captions)` | that person's captions (their own mic) started / stopped |

The segment reaches everyone through `huddle:transcript_segments` / `meeting:transcript_segments`, and people who
join later read it from `GET …/transcript`. The latest notice per person decides whether they are recording or
transcribing (ignore people no longer in the call). Clients show a banner while anything is on and ask each
participant to acknowledge (or leave) once per person and kind. The web client's implementation is
`client/src/features/huddles/capture/captions.js` (`CAPTURE_MARKERS`, `captureStateFromSegments`, `pendingConsent`).
Calls that hold a scheduled meeting (`meeting-<id>`) post segments and recordings to the meeting endpoints.

---

## Summary & action items (transcript first)

### `POST /api/v2/meetings/:id/summarize`
Unchanged response `{ summary }`. The source is now: transcript segments → legacy `transcript` → `sharedNotes`.

### `POST /api/v2/meetings/:id/action-items/extract`
Body `{ apply?: boolean }`. Rule-based extraction from the transcript (falls back to the legacy transcript /
shared notes): explicit "Action item: / TODO: / Follow up:" lines, "I'll … / I will … / let me …"
(assigned to the speaker), "can you … / please …" and "we need to … / let's …" (unassigned).

```json
{
  "extracted": [{ "text": "Send the deck to marketing", "assigneeId": "<userId>|null", "speakerId": "<userId>|null", "at": "..." }],
  "added": 1,                // with apply: true, new items (by text) appended to meeting.actionItems
  "source": "transcript",    // transcript | notes | none
  "meeting": { ... } | null  // updated meeting when items were added
}
```

### `POST /api/v2/huddles/:huddleId/summarize[?sessionId=]`
Draft for the huddle wrap-up. Uses the transcript, else the huddle's shared notes. The client still posts the
wrap-up message itself (E2EE) and then calls `POST /:huddleId/wrap-up { messageId }` as before.

```json
{ "huddleId": "h1", "sessionId": "...", "source": "transcript", "summary": "...", "aiFallback": false,
  "actionItems": [{ "text": "...", "assigneeId": "...", "speakerId": "...", "at": "..." }] }
```

`aiFallback: true` means no AI provider was configured/reachable and `summary` is a plain excerpt.

---

## Socket events (server → client)

| Event | Room | Payload |
|---|---|---|
| `meeting:recording_ready` | `meeting:<id>` | `{ meetingId, recording, recordingUrl }` |
| `meeting:recording_deleted` | `meeting:<id>` | `{ meetingId }` |
| `meeting:transcript_segments` | `meeting:<id>` | `{ meetingId, segments: [...] }` |
| `meeting:action_items_updated` | `meeting:<id>` | `{ meetingId, actionItems }` (after extract with `apply`) |
| `huddle:recording_ready` | `huddle:<huddleId>` | `{ huddleId, sessionId, recording }` |
| `huddle:recording_deleted` | `huddle:<huddleId>` | `{ huddleId, sessionId }` |
| `huddle:transcript_segments` | `huddle:<huddleId>` | `{ huddleId, sessionId, segments: [...] }` |

---

## `meeting.completed` (internal event)

Emitted on the notification event emitter (`src/modules/notifications/notificationEventEmitter.js`), which
feeds automations (`trigger.type = "meeting.completed"`). Metadata only — never the transcript, notes or summary.

```js
{
  kind: 'scheduled' | 'huddle',
  workspaceId, meetingId,          // scheduled: ScheduledMeeting id; huddle: HuddleSession id
  huddleId,                        // huddle id (scheduled: the huddle it ended with, if any)
  title, durationMinutes, participantCount, actionItemCount,
  hasTranscript, hasRecording, channelId,
  createdBy                        // scheduled only
  // + io (server internal)
}
```

When it fires:
- `PATCH /api/v2/meetings/:id/end` — once, when the meeting was not already completed.
- A huddle ends and completes the live scheduled meetings it held (`kind: 'scheduled'`).
- Any other huddle ends (last person leaves / ended) — `kind: 'huddle'`. Huddles with id `meeting-<id>`
  are reported only as the scheduled meeting, so an automation never fires twice for one call.
