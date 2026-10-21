# Realtime collaboration (Yjs over Socket.IO)

Notes, knowledge pages and meeting whiteboards can be edited by several people at
once. Each document is a [Yjs](https://docs.yjs.dev) CRDT. The server is a full Yjs
peer: it holds the merged document, relays changes between editors, enforces
access, and saves both the Yjs state and the plain content.

Everything runs over the app's existing authenticated Socket.IO connection (the
same socket used for chat). There are no new HTTP endpoints.

A ready-made client is in [`collab-provider.js`](./collab-provider.js) (plain ESM;
needs `yjs`, `y-protocols`, `lib0` and a socket.io-client `Socket`). Web and phone
copy it. The rest of this page is the protocol it speaks.

Server code: `server/src/modules/collab/`.

## Encryption

Note and knowledge-page content is **not** end-to-end encrypted: the REST APIs
store it as readable text (`Note.content`, `KnowledgePage.content`) and search, AI
summaries and version history read it on the server. So the server holds the
Yjs document in the clear, merges it, and writes the plain content back on every
save. Only messages are end-to-end encrypted, and they are not collaborative
documents.

If notes ever become E2EE, the server must switch to relay-only for them: forward
`collab:sync` updates without applying them and store the client-encrypted
update log, with clients doing the merge and writing an encrypted content blob.
That is not built today because there is nothing to encrypt against.

## Documents

| `docType`    | `docId`                | Who can open (read)                                                     | Who can write                                    |
|--------------|------------------------|-------------------------------------------------------------------------|--------------------------------------------------|
| `note`       | note `_id`             | Active workspace members who own it, are in `sharedWith`, or it is `isPublic` | Owner, or a `sharedWith` user when `allowEditing` |
| `knowledge`  | knowledge page `_id`   | Active members of the page's workspace                                  | Same                                             |
| `whiteboard` | scheduled meeting `_id`| Active members of the meeting's workspace                               | Same                                             |

These are the same rules as the REST APIs. Access is checked on join and again
at least once a minute while the socket is connected, so revoking a share takes
effect on a live editor (it gets `collab:closed` with `reason: "revoked"`).

### Y.Doc layout

Clients must use exactly these shared types.

**note**: `doc.getArray('blocks')`, a `Y.Array` of `Y.Map`, one per editor block:

| key       | type                | notes                                                   |
|-----------|---------------------|---------------------------------------------------------|
| `id`      | string              | block id (same ids as the REST block JSON)              |
| `type`    | string              | `text`, `heading`, `code`, `image`, ...                 |
| `content` | `Y.Text`            | block text (HTML for `text` blocks)                     |
| `meta`    | plain object / null | replaced as a whole when it changes                     |

On save this becomes `Note.content = JSON.stringify([{ id, type, content, meta }])`,
the same block JSON the REST API takes. Text blocks are run through the server's
HTML sanitiser before they are stored. The live Y.Doc can still hold whatever a
collaborator typed, so **clients must sanitise `text` block HTML before setting
`innerHTML`**, as the web editor already does.

**knowledge**: `doc.getText('content')` holds the page markdown, which is saved to `KnowledgePage.content`.
The page title, icon, tags and category stay REST fields (`PUT /api/v2/knowledge/pages/:id`).

**whiteboard**: `doc.getArray('strokes')` is a `Y.Array` of plain objects
`{ id, tool, color, lineWidth, points: [{ x, y }] }`. Add a stroke with `push([stroke])`
when the pen lifts; erase one by deleting its index. On save it becomes `Whiteboard.strokes`
(still returned by `GET /api/v2/collaboration/whiteboard/:meetingId`).

## Socket events

All payloads carry `{ docType, docId }`. `msg` is binary (`Uint8Array` / `ArrayBuffer`;
Socket.IO sends it as a binary attachment). Messages for a document the socket has
not joined are ignored.

### Client → server

| Event              | Payload                         | Notes |
|--------------------|---------------------------------|-------|
| `collab:join`      | `{ docType, docId }` + ack      | Ack: `{ ok: true, docType, docId, readOnly }` or `{ ok: false, code, message }`. After `ok`, the server immediately sends `collab:sync` (its sync step 1) and, when others are present, `collab:awareness`. Re-joining a joined doc resets it. Limit: 20 open docs per socket. |
| `collab:sync`      | `{ docType, docId, msg }`       | A y-protocols **sync** message: step 1 (state vector), step 2 (missing updates), or an update. Read-only sockets may send only step 1. |
| `collab:awareness` | `{ docType, docId, msg }`       | A y-protocols **awareness** update (cursor, selection, `user` info). The server overwrites `state.user.id` with the authenticated user id. Max 64 KB. |
| `collab:leave`     | `{ docType, docId }`            | Stop editing. Disconnecting does the same for every joined doc. |

### Server → client

| Event              | Payload                                       | Notes |
|--------------------|-----------------------------------------------|-------|
| `collab:sync`      | `{ docType, docId, msg }`                     | Sync step 1 (after join), step 2 (reply to your step 1), or an update from another editor or a REST write. |
| `collab:awareness` | `{ docType, docId, msg }`                     | Awareness changes of other editors, including removals when they leave. |
| `collab:saved`     | `{ docType, docId, savedAt }`                 | The merged document was written to the database. Use it for a "Saved" indicator. |
| `collab:error`     | `{ docType, docId, code, message }`           | A message was refused. Codes: `READ_ONLY`, `BAD_MESSAGE`, `TOO_LARGE` (message over 2 MB), `DOC_TOO_LARGE` (document over 8 MB), `FORBIDDEN`, `NOT_FOUND`. |
| `collab:closed`    | `{ docType, docId, reason }`                  | You were removed from the document: `deleted` (the note or page was deleted) or `revoked` (access was lost). Rejoining will fail. |

Join error codes (`ack.code`): `BAD_REQUEST` (unknown `docType` or malformed id),
`NOT_FOUND`, `FORBIDDEN`, `WORKSPACE_ACCESS_DENIED`, `TOO_MANY_DOCS`, `SERVER_ERROR`.

## Client flow

```
client                                   server
  ── collab:join {docType, docId} ───────▶  authorize, load or seed the doc
  ◀──────────── ack {ok, readOnly} ──────
  ◀──── collab:sync (server step 1) ──────
  ── collab:sync (client step 1) ────────▶
  ◀──── collab:sync (step 2) ─────────────  now "synced": bind the editor
  ── collab:sync (step 2, writers only) ──▶  sends edits made offline
  ── collab:awareness (own state) ───────▶
  ... edits:  doc.on('update') → collab:sync (update) ──▶ applied, relayed, saved
  ◀── collab:sync (update) from others ───  Y.applyUpdate
  ── collab:leave ───────────────────────▶
```

1. Create the provider when the editor opens: `new CollabProvider(socket, 'note', noteId, { user: { name, color, avatar } })`.
2. **Do not put content into the Y.Doc yourself.** The server seeds it once from the
   stored content, so every client starts from the same Yjs items. Seeding on the
   client would duplicate the text.
3. Wait for `synced`, then bind the editor to the shared type: `doc.getArray('blocks')`,
   `doc.getText('content')` or `doc.getArray('strokes')`. Apply local edits as minimal Yjs
   operations (insert/delete ranges), not by replacing the whole text.
4. If `provider.readOnly` is true, keep the editor read-only. The provider does not send local edits.
5. Show other people's cursors from `provider.awareness.getStates()`. Each state's
   `user.id` is the real user id, set by the server.
6. Reconnects are automatic: on the socket's `connect` event the provider joins again
   and the step 1 / step 2 exchange merges edits made while offline.
7. While a document is open live, **do not also `PUT` its content over REST.** The
   server saves it (debounced, 2 s after the last change and at most 10 s apart, and
   at once when the last editor leaves). Keep using REST for title, sharing, tags and so on.
8. Call `provider.destroy()` when the editor closes.

## Saving and REST interplay

- The Yjs state is stored in the `collabdocs` collection (`{ docType, docId, state, rev }`).
  The owning record gets the plain content on every save, so search, AI summaries,
  exports and the REST `GET` endpoints always see current text.
- **Knowledge versions:** a live save adds the previous content to `versions` at most
  once every 10 minutes, so typing does not flood the history. REST `PUT` keeps
  snapshotting on every content change.
- **Note versions:** unchanged. They are still created explicitly with `POST /api/v2/notes/:id/versions`.
- **REST writes during a live session:** `PUT /api/v2/notes/:id` and
  `PUT /api/v2/knowledge/pages/:id` with `content`, and `POST /api/v2/collaboration/whiteboard/:meetingId`,
  are applied to the live document as a minimal diff. Open editors receive them as
  ordinary updates. A REST write replaces whatever it covers.
- Deleting a note permanently or deleting a knowledge page closes live sessions
  (`collab:closed`, `reason: "deleted"`) and drops the stored Yjs state.
- **Multiple server instances:** with `REDIS_URL` set, instances replicate updates and
  awareness over the Redis channel `collab:ops`. An instance that loads a document asks
  the others for their unsaved state first. Without Redis, everything stays in one process.

## Older knowledge events

`knowledge:join`, `knowledge:leave`, `knowledge:cursor` and `knowledge:presence` in
`server/src/socket/chatHandlers.js` still work but have been replaced by
`collab:*` awareness. New clients should not use them.
