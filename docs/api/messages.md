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
