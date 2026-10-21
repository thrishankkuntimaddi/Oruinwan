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

## Client → server

| Event | Payload | Notes |
|---|---|---|
| `huddle:start` | `{ huddleId, channelId? \| dmId? \| workspaceId?, video?, device, switch? }` | Creates the call. If one is already live in that channel/DM the server answers `huddle:existing` and the client joins that one. |
| `huddle:join` | `{ huddleId, channelId? \| dmId? \| workspaceId?, audioEnabled, videoEnabled, device, switch?, transfer? }` | Joins. The answer is `huddle:roster` (or `huddle:error`). |
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

`huddle:ended` reasons:

| reason | Meaning | Extra |
|---|---|---|
| `empty`, `ended`, `time_limit` | The call is over for everyone | `meetingId, channelId, dmId, workspaceId`, `message` for `time_limit` |
| `joined_elsewhere` | Another tab of this device took the call | |
| `moved` | The call moved to another of my devices | `to`: that device's label |
| `switched` | I joined a different call on another device | |

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

## Typical flows

**Start a call from a channel:** `huddle:start {…, device}` → `huddle:started` → `huddle:join {…, device}`
→ `huddle:roster`; others get `huddle:joined` and send offers.

**Move laptop → phone:** phone gets `huddle:self_active { huddleId, device: laptop }` → shows "Move
here" → `huddle:join { huddleId, transfer: true, audioEnabled, videoEnabled, device: phone }` →
laptop gets `huddle:ended { reason: 'moved', to: 'Pixel 8' }`, peers get `huddle:left { reason:
'rejoined' }` then `huddle:joined` and offer to the phone.

**Second call:** `huddle:join` for another call → `huddle:error ALREADY_IN_CALL (sameCall: false)` →
user taps Switch → `huddle:join { …, switch: true }` → the other device gets `huddle:ended { reason:
'switched' }`.
