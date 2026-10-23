# Messages: idempotent sends (offline queue)

Phones (and any client) can queue messages while offline and resend them safely. Attach a
client-generated **`clientMessageId`** to the send; the server keeps one message per
(sender, clientMessageId), so a resend after a timeout, reconnect or app restart returns the
message that was already stored instead of creating a duplicate.

`clientMessageId`: 8–100 characters from `A–Z a–z 0–9 _ - : .` — a UUID is ideal. Generate it once
when the message is queued and reuse it for every retry. An invalid value is ignored (the send
still works, without dedupe). It is unique per sender, not per conversation.

## REST

`POST /api/v2/messages/channel` and `POST /api/v2/messages/direct`
accept `clientMessageId` in the body next to `ciphertext`, `messageIv`, `clientTempId`, ….

| Case | Response |
|---|---|
| first send | `201 { message }` — `message.clientMessageId` echoes the id |
| resend of a stored message | `200 { message, duplicate: true }` — the stored message; nothing is re-broadcast and no notifications are sent again |

`POST /api/threads/:messageId` (thread replies) behaves the same:
`201 { reply }` or `200 { reply, duplicate: true }`.

## Socket

`send-message` accepts `clientMessageId` in its payload.

- first send: as before — `new-message` / `thread-reply` to the conversation and
  `message-sent { message, clientTempId }` to the sender;
- resend: only the sender gets `message-sent { message, clientTempId, clientMessageId, duplicate: true }`;
  the conversation is not notified again.

## Client guidance

1. Queue: `{ clientMessageId: uuid(), clientTempId, conversation, ciphertext, messageIv, … }`.
2. On reconnect, resend each queued item in order. Treat both `201` and `200 duplicate` as delivered
   and replace the optimistic bubble (match on `clientTempId` or `clientMessageId`).
3. Drop the item from the queue only after a success response; retry network errors and 5xx.
   4xx other than 429 are permanent (e.g. no longer a channel member) — surface them.

# Thread replies: @mentions

Thread replies are end-to-end encrypted like other messages, so the client sends the plaintext
mention part separately as **`mentionText`** (same as channel sends):

- REST `POST /api/threads/:messageId` body: `{ ciphertext, messageIv, attachments?, clientTempId?, clientMessageId?, mentionText? }`
- socket `send-message` with `parentId`: add `mentionText`.

`@username` handles are resolved against the channel members (or DM participants); the replier is
ignored. Each mentioned person gets a `mention` notification ("X mentioned you in #channel"),
starts following the thread, and is left out of the generic `thread_reply` notification so they
are notified once. The reply's `mentions` field lists their ids. `@here` / `@channel` are not
expanded in threads.

## Group DMs

A group DM is a `DMSession` with `isGroup: true`: 3 to 10 people when created (`DMSession.MAX_GROUP_DM_MEMBERS`),
it stays a group if people leave. 1:1 DM lookups always skip groups (`isGroup: { $ne: true }`), so a group that
shrinks to two people is never reused as a 1:1 DM. Service: `server/src/modules/messages/groupDM.service.js`.

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/v2/dm/group` | `{ workspaceId, memberIds: [...], name? }` | Adds the creator. Same people and no name reopens the existing group (200), otherwise 201. 400 `TOO_FEW` / `GROUP_FULL`, 403 if someone isn't in the workspace. |
| GET | `/api/v2/dm/:dmId` | | `{ dm: { id, isGroup, name, displayName, createdBy, workspaceId, participants: [...] } }` (also works for 1:1 DMs). |
| PATCH | `/api/v2/dm/:dmId` | `{ name }` | Any member; an empty name clears it. |
| POST | `/api/v2/dm/:dmId/members` | `{ userIds: [...] }` | Any member; workspace members only. |
| DELETE | `/api/v2/dm/:dmId/members/:userId` | | `me` (or your own id) leaves; only the creator removes others (403 `NOT_CREATOR`). |

The DM list (`GET /api/v2/messages/workspace/:id/dms`) marks groups with `isGroup`, `name`, `displayName`
("Ben, Chen and 2 others" when unnamed), `members`, `memberCount` and `createdBy`. For older apps, `otherUser` is
`{ _id: null, username: displayName }`. Blocking (`/block`) is refused for groups (`NOT_FOR_GROUPS`).

**Encryption.** The conversation key is wrapped for every member (`ensureDMConversationKey`). Like channels, people
who are added get the existing key but the server only returns messages from when they joined (`memberSince`); their
unread counts start there too. People who leave or are removed lose their wrapped key copy and every server check
(they are no longer in `participants`); the key itself is not rotated.

**Socket.** Members' sockets join `dm:<id>` when added and leave it when removed. Events: `new-dm-session`
`{ dmSessionId, isGroup: true }` (to `user:<id>`, for created/added/removed people), `dm:members_updated`
`{ dmSessionId, name, participants }` (to `dm:<id>`), `dm:removed` `{ dmSessionId, left }` (to the removed person).
System lines (`type: 'system'`, plain `text` for every app): `group_created`, `group_member_added`,
`group_member_removed`, `group_member_left`, `group_renamed`.

**Calls.** A group DM huddle uses the DM scope; every member may join. The huddle check returns
`isGroup: true` and `channelName` (the group's name) for group DMs.
