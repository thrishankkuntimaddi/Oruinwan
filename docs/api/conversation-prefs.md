# Chat list: pins, archive, previews, scheduled messages (3.1)

## Pinned and archived chats

Per person, per workspace. Nobody else sees them.

```
GET  /api/v2/conversation-prefs/:workspaceId
  → { prefs: [{ kind: 'channel' | 'dm', id, pinnedAt, archivedAt }], maxPins: 3 }

PUT  /api/v2/conversation-prefs
  { workspaceId, kind, id, pinned?: boolean, archived?: boolean } → { pref }
```

- At most 3 pinned chats per workspace; a fourth answers `409 { code: 'PIN_LIMIT' }`.
- Pinning un-archives a chat; archiving unpins it.
- Only conversations you are in (channel member, DM participant); otherwise `404`.

## Last message in the channel list

`GET /api/workspaces/:workspaceId/channels` now adds, for channels you are in:
`lastMessageAt`, `lastMessage` (a label such as "📷 Photo"), `lastMessagePreview`
(`{ ciphertext, messageIv }` for text, decrypted on the device), `lastMessageSender`
(`{ _id, name }`) and `isMuted`. 1:1 DM rows also carry `lastMessageSender`.
Public channels are always listed for workspace members; private ones only for members.

## Scheduled messages and Sent

The text is end-to-end encrypted on the sender's device before it is scheduled.

```
GET    /api/v2/scheduled-messages?workspaceId=   → { scheduled: [...], max: 50 }
POST   /api/v2/scheduled-messages                { workspaceId, kind, conversationId, sendAt, body }
PATCH  /api/v2/scheduled-messages/:id            { sendAt }
DELETE /api/v2/scheduled-messages/:id
POST   /api/v2/scheduled-messages/:id/send-now
GET    /api/v2/scheduled-messages/sent?workspaceId= → { messages: [{ id, kind, conversationId, payload, attachments, at }] }
```

- `body` holds what the send endpoints take: `ciphertext`, `messageIv`, `isEncrypted`, `type`,
  `attachments`, `quotedMessageId`, `mentionText`. Anything else is dropped.
- `sendAt` must be at least ~20 seconds and at most a year ahead. Up to 50 pending per person.
- A job (every 30 s, one instance fleet-wide) sends due messages through the normal send
  controller as their author, so access checks, notifications and realtime events are the same.
  Each message is claimed atomically before sending. A refused send is kept as `failed` with
  the reason. The author gets `scheduled-message:sent` or `scheduled-message:failed`.

## Reactions and read receipts

- Several reactions per person (each emoji once). `DELETE /v2/messages/:id/react { emoji }` removes one.
- Someone with read receipts off is hidden from other people's `readBy`, and no longer sees
  other people's reads either.

## Adding people to a call

Socket `huddle:invite { huddleId, userIds }` with an acknowledgement `{ ok, invited } | { ok: false, message }`.
Only someone in the call may invite, and only members of the call's workspace can be invited.
They get `huddle:ring` (and a phone push) with `invited: true`, and `huddle:join` lets them in
even when they aren't in the call's DM or channel. The call's room gets `huddle:invited`.

## Note pages (3.1.1)

A note can have more pages. Each page is a Note with `parentNote` (the first page) and
`pageOrder`. `GET /api/v2/notes` lists first pages only; `GET /api/v2/notes/:id` adds
`pages: [{ _id, title, pageOrder }]` (first page first). Add one with
`POST /api/v2/notes { workspaceId, parentNoteId, title? }` (anyone who may edit the note;
max 100 pages). Pages take the first page's sharing; sharing, archive and permanent delete
of the first page apply to all its pages. `PUT /api/v2/notes/:id { pageOrder }` reorders a page.

## Note reminders (3.1.1)

```
POST   /api/v2/notes/:id/remind        { remindAt, note? } → { reminder }   (one per person per note)
GET    /api/v2/notes/reminders?workspaceId=               → { reminders: [{ id, noteId, noteTitle, remindAt, note }] }
DELETE /api/v2/notes/reminders/:reminderId
```

The reminders job (every minute) turns due ones into a `note_reminder` notification
(Activity and a phone push), each claimed once.

## Whiteboard pages (3.1.1)

Page 1 is the meeting's board (`/api/v2/collaboration/whiteboard/:meetingId`, live docId =
meetingId). More pages:

```
GET    /api/v2/collaboration/whiteboard/:meetingId/pages            → { pages: [{ id, title, order }] }
POST   /api/v2/collaboration/whiteboard/:meetingId/pages  { title? } → { page }   (max 30)
PATCH  /api/v2/collaboration/whiteboard/:meetingId/pages/:pageId { title }
DELETE /api/v2/collaboration/whiteboard/:meetingId/pages/:pageId
GET    /api/v2/collaboration/whiteboard/:meetingId/pages/:pageId    → { strokes }
POST   /api/v2/collaboration/whiteboard/:meetingId/pages/:pageId { strokes }
```

Each page syncs live with `collab:join { docType: 'whiteboard', docId: <pageId> }`; access is
the meeting's. Changes to the page list emit `whiteboard:pages { meetingId }` to the meeting room.
