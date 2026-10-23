# Calls protocol (huddles over Socket.IO)

How an app starts, joins, leaves and moves a call. Server: `server/src/modules/huddles/huddles.socket.js`.
Web client: `client/src/features/huddles/useHuddle.js` and `HuddleContext.jsx`. Calls are a WebRTC
mesh: the server relays signalling only; media goes peer to peer (STUN/TURN from
`GET /api/v2/huddles/ice-servers`).

Recordings, transcripts and summaries are in [meetings.md](meetings.md).

## Rules

- **One call per person.** Someone in a call (on any of their devices) is asked before they start or
  join another one, and can "switch" (leave the old call, join the new one).
- **Moving a call between your devices.** Joining the call you are already in, from a different
  device, asks "Move it here?"; moving hands the call to the new device (about a second of silence
  while peers reconnect) and tells the old device it moved.
- **Same device** (another tab of the same browser, or the app reconnecting): replaces the old
  connection without asking.
- **Older apps** that send no `device` keep the old behaviour: a new join silently replaces the old
  one, and joining another call leaves the first.
- Nobody is rung or notified about a new call while they are already in one.
- **Ringing.** A call in a DM or group DM rings everyone else in it on every device (incoming-call
  screen + phone push) for 45 seconds. A channel huddle never rings: members get a "Join" banner and
  a "huddle started" notification. See [Ringing](#ringing).
- **1:1 calls end like a phone call.** Once both people in a 1:1 DM call have joined, the call ends
  for both (`huddle:ended { reason: 'ended' }`) as soon as one of them leaves. A dropped connection
  (`disconnected`) doesn't end it, so they can reconnect. Group DM, channel and workspace huddles
  stay open while anyone is in them.

## Client → server

| Event | Payload | Notes |
|---|---|---|
| `huddle:start` | `{ huddleId, channelId? \| dmId? \| workspaceId?, video?, device, switch? }` | Creates the call. If one is already live in that channel/DM the server answers `huddle:existing` and the client joins that one. |
| `huddle:join` | `{ huddleId, channelId? \| dmId? \| workspaceId?, audioEnabled, videoEnabled, device, switch?, transfer?, rejoin? }` | Joins. The answer is `huddle:roster` (or `huddle:error`). Send `rejoin: true` when reconnecting to the call you were in: if it ended while you were offline the answer is `huddle:ended { reason: 'ended' }` instead of bringing it back. |
| `huddle:leave` | `{ huddleId }` | Only counts from the connection that is in the call. |
| `huddle:end` | `{ huddleId }` | Ends it for everyone (participants only). |
| `huddle:audio_toggle` | `{ huddleId, audioEnabled }` | |
| `huddle:video_toggle` | `{ huddleId, videoEnabled }` | Screen sharing counts as video. |
| `huddle:hand` | `{ huddleId, raised }` | |
| `huddle:offer` / `huddle:answer` / `huddle:ice-candidate` | `{ huddleId, targetUserId, offer \| answer \| candidate }` | Relayed to the target's registered connection. Existing members send the offers to a newcomer. |
| `huddle:mine` | `{}` + ack | Ack: `{ active: SelfActive \| null }` — my call on any device. Ask on every (re)connect. |
| `huddle:active` | `{ channelId \| dmId }` + ack | Ack: `{ huddle }` — the live call of a conversation. |
| `huddle:list` | `{ workspaceId }` + ack | Ack: `{ huddles: [...] }`. |
| `huddle:notes_op` | `{ huddleId, op }` + ack | Shared huddle notes. |
| `huddle:decline` | `{ huddleId }` | Decline a call ringing for me (all my devices stop ringing). |

HTTP: `POST /api/v2/huddles/:huddleId/decline` (signed in) does the same as `huddle:decline`.
`404` when nothing is ringing.

HTTP without signing in: `POST <declineUrl>` — the link in each ring,
`/api/v2/huddles/:huddleId/decline-ring?token=<userId>.<expiresMs>.<signature>` (HMAC-SHA256 with a
key derived from the server secret; valid for that one person and call until the ring's
`expiresAt`). For the phone's ring notification Decline button while the app is closed and has no
sign-in token. `200 { ok: true }`; `401` expired; `403` forged / another call or person; `404`
already stopped ringing.

`device` is `{ id, label, platform }`:

- `id`: a stable id for this install or browser (the web client uses its device id; apps should use
  a value kept in app storage, the same one every launch).
- `label`: what other devices show, e.g. `"Desktop app on Mac"`, `"Chrome on Windows"`, `"Pixel 8"`
  (max 80 characters).
- `platform`: `web` | `desktop` | `android` | `ios`.

## Server → client

| Event | To | Payload |
|---|---|---|
| `huddle:started` | conversation room (DM: both people) | `{ huddleId, scope, channelId, dmId, workspaceId, channelName, startedBy: { _id, username }, video, meetingId, timestamp }` |
| `huddle:existing` | the starter | `{ requestedId, huddleId, video, meetingId }` |
| `huddle:roster` | the joiner | `{ huddleId, meetingId, participants: [{ userId, username, audioEnabled, videoEnabled, handRaised, joinedAt }], maxParticipants, video, timeLimit }` |
| `huddle:joined` | the call | `{ huddleId, meetingId, userId, username, audioEnabled, videoEnabled, timestamp }` |
| `huddle:left` | the call | `{ huddleId, userId, reason, timestamp }` — reason `left`, `disconnected`, `rejoined` (moved: reconnect to the new device), `switched` |
| `huddle:ended` | the call, the conversation, or one connection | `{ huddleId, reason, … }` — see below |
| `huddle:audio_changed` / `huddle:video_changed` / `huddle:hand_changed` | the call | `{ huddleId, userId, audioEnabled \| videoEnabled \| raised }` |
| `huddle:self_active` | all my devices (`user:<id>`) | `SelfActive`, or the same shape with `huddleId: null` when I'm in no call |
| `huddle:error` | the asking connection | `{ huddleId, code, message, … }` |
| `huddle:ring` | each callee's devices (`user:<id>`) | `Ring` — see [Ringing](#ringing) |
| `huddle:ring_cancel` | the callee's devices | `{ huddleId, reason }` — `answered_elsewhere`, `declined`, `ended`, `timeout` |
| `huddle:declined` | the caller's devices | `{ huddleId, userId, name }` — someone declined |
| `huddle:no_answer` | the caller's devices | `{ huddleId }` — the ring ran out and nobody answered |

`huddle:ended` reasons:

| reason | Meaning | Extra |
|---|---|---|
| `empty`, `ended`, `time_limit` | The call is over for everyone | `meetingId, channelId, dmId, workspaceId`, `message` for `time_limit` |
| `joined_elsewhere` | Another tab of this device took the call | |
| `moved` | The call moved to another of my devices | `to`: that device's label |
| `switched` | I joined a different call on another device | |
| `declined` | A 1:1 call: the other person declined before anyone answered | |
| `no_answer` | A 1:1 call: nobody answered within 45 seconds | |

`SelfActive`:

```json
{
  "huddleId": "…", "channelId": "…" , "dmId": null, "workspaceId": "…",
  "channelName": "general", "meetingId": "…", "video": false,
  "device": { "id": "…", "label": "Pixel 8", "platform": "android" },
  "socketId": "…", "audioEnabled": true, "videoEnabled": false
}
```

A device whose own socket id is not `socketId` shows "In a call on <label> · Move here".

### `ALREADY_IN_CALL`

```json
{
  "huddleId": "<the call asked for>",
  "code": "ALREADY_IN_CALL",
  "sameCall": true,
  "message": "You're in this call on Pixel 8.",
  "current": {
    "huddleId": "…", "channelId": "…", "dmId": null, "workspaceId": "…",
    "channelName": "general", "meetingId": "…",
    "device": { "id": "…", "label": "Pixel 8", "platform": "android" }
  }
}
```

- `sameCall: true` → ask "Move the call here?"; on yes, join again with `transfer: true` and the
  mute/camera state from `huddle:self_active` (`audioEnabled`, `videoEnabled`).
- `sameCall: false` → ask "Switch calls?"; on yes, start/join again with `switch: true`.

`huddle:start` only refuses for a different call (`sameCall: false`); the join that follows a
"switch" moves the person.

## Ringing

Server: `server/src/modules/huddles/huddleRinging.js`. Rings start when a call is **started** (not
when one is re-created by a join), and skip anyone already in a call.

`Ring`:

```json
{
  "huddleId": "…",
  "kind": "dm",
  "dmId": "…",
  "workspaceId": "…",
  "title": "Ben",
  "from": { "id": "…", "name": "Ben Ito", "avatar": "https://…" },
  "video": false,
  "meetingId": "…",
  "ring": true,
  "expiresAt": 1792677645000,
  "declineUrl": "https://api.example.com/api/v2/huddles/…/decline-ring?token=…"
}
```

- `kind`: `dm` (1:1), `group_dm` (3+ people; `title` is the group's name), or `channel`
  (`channelId` instead of `dmId`, `title` is `#name`, `ring: false`: show a "Join" banner, don't ring).
- `title`: what the incoming-call screen shows as the heading (the caller for a 1:1 call).
- `expiresAt`: when the ring stops, in milliseconds since 1970.
- `declineUrl`: this callee's own decline link (POST, no sign-in), valid until `expiresAt`; absent
  for channel huddles.
- Answer = an ordinary `huddle:join { huddleId, dmId, device, … }`. Decline = `huddle:decline`.
- The ring stops (`huddle:ring_cancel`) when the callee joins on any device (`answered_elsewhere`;
  the device that joined ignores it), declines (`declined`), the call ends (`ended`), or at
  `expiresAt` (`timeout`).
- Everyone who never answered (timeout, or the caller hung up first) gets a stored `missed_call`
  notification: "Missed call from Ben" (link `/dm/<id>`).
- 1:1 call: a decline, or no answer, hangs up the caller's call (`huddle:ended` with `declined` /
  `no_answer`). In a group call the others keep ringing and the call stays up.

### Desktop app

The web client tells the desktop app about rings with window events (no-ops in a browser):
`oruinwan:ring` `{ huddleId, title, body, video }` when a ring starts, `oruinwan:ring-end`
`{ huddleId }` when it stops, and it listens for `oruinwan:ring-action`
`{ huddleId, action: 'accept' | 'decline' | 'open' }` from the app's ring notification
(`client/src/features/huddles/call/ringBridge.js`).

### Phone push for calls

The server sends a **data-only, high-priority** push (FCM `android.priority: HIGH`, `ttl: 45s`, no
`notification` block) so the Android app shows its own incoming-call screen (Accept / Decline) even
when it was closed:

| `data.type` | Other fields (all strings) |
|---|---|
| `call` | `huddleId`, `call` = the `Ring` JSON (with this person's `declineUrl`), `declineUrl` |
| `call_cancel` | `huddleId`, `call` = `{ huddleId, reason }`, `reason` |

iPhone gets an alert push that expires with the ring (no VoIP push yet) and nothing for a cancel.

## Typical flows

**Start a call from a channel:** `huddle:start {…, device}` → `huddle:started` → `huddle:join {…, device}`
→ `huddle:roster`; others get `huddle:joined` and send offers.

**Move laptop → phone:** phone gets `huddle:self_active { huddleId, device: laptop }` → shows "Move
here" → `huddle:join { huddleId, transfer: true, audioEnabled, videoEnabled, device: phone }` →
laptop gets `huddle:ended { reason: 'moved', to: 'Pixel 8' }`, peers get `huddle:left { reason:
'rejoined' }` then `huddle:joined` and offer to the phone.

**Incoming DM call:** Ben `huddle:start {dmId}` → Ana's devices get `huddle:ring` (+ phone push) →
Ana taps Accept on her phone → `huddle:join` → her laptop gets `huddle:ring_cancel {reason:
'answered_elsewhere'}`. If she taps Decline instead: `huddle:decline` → Ben gets `huddle:declined`
and `huddle:ended {reason: 'declined'}`.

**Second call:** `huddle:join` for another call → `huddle:error ALREADY_IN_CALL (sameCall: false)` →
user taps Switch → `huddle:join { …, switch: true }` → the other device gets `huddle:ended { reason:
'switched' }`.
