# Public API

REST API for workspace integrations, authenticated with a workspace API key
(created in **Developer → API keys**, `/api/developer/api-keys`).

## Versioning

| Path | Status | Headers on every response |
|---|---|---|
| `/api/public/v1/*` | **Current.** Use this. | `API-Version: v1` |
| `/api/public/*` (no version) | **Deprecated alias** of v1. It behaves exactly like v1 and will be removed in a later release. | `API-Version: v1`, `Deprecation: @1792540800` (RFC 9745, 2026-10-21T00:00:00Z), `Link: </api/public/v1/<path>>; rel="successor-version"` |
| `/api/public/v<N>/*` for any other N | Not supported | `404 { "message": "Unsupported public API version. Use /api/public/v1." }` |

Unknown endpoints under `/api/public/v1/` return `404 { "message": "Unknown public API endpoint" }`.
Both paths share one router, so the per-key rate limit is shared too.

Server: `server/src/features/developer/publicApi.versioning.js` (mount) and
`publicApi.routes.js` (v1 endpoints).

## Authentication and limits

- Header `X-Api-Key: <key>`. Missing/invalid/revoked key, or a key whose workspace is no longer active → `401 { message }`.
- Every route needs a key permission (scope). The key has the scope, or `*`. Otherwise `403 { message: "API key does not have the <scope> permission" }`.
- Rate limit: 100 requests per minute per key → `429 { message }`. Standard `RateLimit-*` headers are sent.
- Errors are always `{ "message": string }`.

## Endpoints (v1)

`limit` query params default to 50; the maximum is 100.

### `GET /api/public/v1/messages` (scope `messages:read`)
Messages in public, non-archived channels, newest first. Messages are end-to-end encrypted, so
**only metadata is returned**, never content.

Query: `channelId?` (must be a public channel: `400` if malformed, `404` if not public), `limit?`.

```json
{ "messages": [{ "id": "…", "channelId": "…", "sender": { "id": "…", "username": "sam" },
  "type": "message", "parentId": null, "replyCount": 0, "attachmentCount": 1,
  "isEncrypted": true, "createdAt": "…", "editedAt": null }], "count": 1 }
```

### `GET /api/public/v1/tasks` (scope `tasks:read`)
Query: `status?` (one of the task statuses; invalid → `400`), `limit?`.
Response: `{ "tasks": [ { …task, "assignedTo": [{ "_id", "username" }] } ], "count": n }`.

### `POST /api/public/v1/tasks` (scope `tasks:write`)
Creates a task as the key's creator (who must still be a workspace member).

Body: `{ "title": string (required, ≤500), "description"?: string, "priority"?: "lowest"|"low"|"medium"|"high"|"highest",
"status"?: task status (not "blocked"), "dueDate"?: ISO date, "assigneeIds"?: string[] }`
(`assigneeId` is accepted as a single-id legacy form).

Response `201 { "task": { … } }`. Validation errors → `400`; service permission errors pass through (`403`, …).

### `GET /api/public/v1/files` (scope `files:read`)
Non-deleted workspace files. Query: `limit?`. Response: `{ "files": [...], "count": n }`.

### `GET /api/public/v1/users` (scope `users:read`)
Active members. Response: `{ "users": [...], "count": n }`.

### `GET /api/public/v1/channels` (scope `channels:read`)
Non-private, non-archived channels. Response: `{ "channels": [...], "count": n }`.

## Migrating clients

Replace the `/api/public/` base with `/api/public/v1/`. Nothing else changes. Clients can detect the
deprecated path by the `Deprecation` response header. (The web Developer portal and docs pages under
`client/src/pages/developer`, `client/src/content/docs/developers.js` and
`client/src/pages/docs/DocsFigures.jsx` still show the unversioned base URL and should be updated.)
