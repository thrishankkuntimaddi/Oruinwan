# Design review API

Reviews of file-library files (images, PDFs, videos) with pinned, threaded comments ("annotations"),
reviewer decisions, rounds per file version and a version compare view.

Server code: `server/src/features/design-review/`. REST base: `/api/v2/design-reviews` (Bearer auth).
Errors are `{ message }` (+ `errors: [ids]` for rejected reviewer ids).

## Versions

Library files (`/api/v2/files`) carry `currentVersion` (number); older versions are `FileVersion` rows with the same
`versionNumber`. Reviews and annotations reference versions by **`versionNumber`**. `fileVersionId` is the
`FileVersion` id for that number when the version was already archived when the review / annotation was created,
otherwise `null` (it was the file's current version). To display a version use the `url` returned by
`GET /:id` (`review.version.url`) or by `/compare` — both go through `/api/v2/uploads/file`, which checks membership.

Reviewable types (`mimeType`): `image/*` → kind `image`, `application/pdf` → `pdf`, `video/*` → `video`. Others → 400.

## Models

**DesignReview**

```jsonc
{
  "_id", "workspaceId", "fileId",
  "fileVersionId": null, "versionNumber": 2,
  "rounds": [{ "versionNumber": 1, "startedAt" }, { "versionNumber": 2, "startedAt" }],
  "title": "Home screen", "description": "",
  "createdBy": { "_id", "username", "profilePicture" },
  "reviewers": [{ "user": { "_id", "username", "profilePicture" }, "decision": "pending|approved|changes_requested", "note": "", "decidedAt": null }],
  "status": "open|changes_requested|approved",
  "dueDate": null, "createdAt", "updatedAt",
  "annotationCounts": { "total": 3, "open": 1 }   // list responses only
}
```

Status rule: any reviewer `changes_requested` → `changes_requested`; all reviewers `approved` → `approved`; else `open`.

**Annotation**

```jsonc
{
  "_id", "reviewId", "workspaceId", "fileId", "fileVersionId", "versionNumber": 2,
  "page": 1,            // 1-based; PDFs only (must be 1 otherwise)
  "x": 0.42, "y": 0.18, // top-left, normalised 0..1 of the rendered page / frame
  "w": 0.1,  "h": 0.05, // optional box, 0 = pin; x + w <= 1, y + h <= 1
  "timeMs": null,       // videos only: playback position in ms
  "authorId": { "_id", "username", "profilePicture" },
  "body": "Align with the grid",
  "resolved": false, "resolvedBy": null, "resolvedAt": null,
  "replies": [{ "_id", "authorId": {...}, "body", "createdAt", "updatedAt" }],
  "createdAt", "updatedAt"
}
```

## Permissions

All require active membership of the file's workspace (others get 404).

| Action | Who |
| --- | --- |
| list / read reviews, annotations, compare | any member |
| create a review | any member |
| add an annotation, reply | any member |
| edit an annotation | its author |
| resolve / reopen | annotation author, review creator, any reviewer |
| delete an annotation | its author, review creator, workspace admin |
| decide (approve / request changes) | reviewers only |
| edit review, change reviewers, new round, delete review | review creator or workspace owner/admin |

## Routes

| Method | Path | Body / query | Response |
| --- | --- | --- | --- |
| GET | `/` | `?workspaceId=` or `?fileId=`; optional `status`, `mine=true` (I created or review) | `{ reviews: [DesignReview] }` (≤ 200, newest activity first) |
| POST | `/` | `{ fileId, title?, description?, reviewers: [userId], dueDate?, versionNumber? }` (title defaults to file name, version to current) | 201 `{ review }` |
| GET | `/compare` | `?fileId=&from=&to=&reviewId?` (defaults: `to` = current, `from` = to − 1) | `{ file: { _id, name, mimeType, kind, currentVersion }, from: Version, to: Version }` where `Version = { versionNumber, fileVersionId, url, mimeType, size, createdAt, current, annotations: [Annotation], summary: { total, open, resolved } }` |
| GET | `/:id` | | `{ review: DesignReview & { file: { _id, name, mimeType, currentVersion, kind }, version: { versionNumber, url, mimeType, size, current, ... }, permissions: { canManage, canDecide } }, annotations: [Annotation] }` |
| PATCH | `/:id` | any of `title, description, dueDate, reviewers` | `{ review }` (new reviewers are notified; existing decisions kept) |
| DELETE | `/:id` | | `{ message }` |
| POST | `/:id/decision` | `{ decision: 'approved' \| 'changes_requested' \| 'pending', note? }` | `{ review }` |
| POST | `/:id/rounds` | `{ versionNumber? }` (default: file's current version) | `{ review }` — moves the review to that version, appends to `rounds`, resets decisions to pending, status `open` |
| GET | `/:id/annotations` | `?versionNumber=&resolved=true\|false` | `{ annotations }` |
| POST | `/:id/annotations` | `{ x, y, w?, h?, page?, timeMs?, body, versionNumber? }` (version defaults to the review's) | 201 `{ annotation }` |
| PATCH | `/:id/annotations/:annotationId` | any of `body, x, y, w, h, page, timeMs` | `{ annotation }` |
| DELETE | `/:id/annotations/:annotationId` | | `{ message }` |
| POST | `/:id/annotations/:annotationId/resolve` | `{ resolved?: boolean }` (default `true`; `false` reopens) | `{ annotation }` |
| POST | `/:id/annotations/:annotationId/replies` | `{ body }` | 201 `{ annotation, reply }` |

## Realtime (Socket.IO, same connection as chat)

Client → server:

| Event | Payload | Ack |
| --- | --- | --- |
| `design-review:join` | `{ reviewId }` | `{ ok: true, viewers: [userId] }` or `{ ok: false, message }` (same access as `GET /:id`) |
| `design-review:leave` | `{ reviewId }` | — |
| `design-review:pointer` | `{ reviewId, x, y, page?, timeMs? }` | — (volatile, relayed to others in the room; only after join) |

Server → clients in room `design-review:<reviewId>`:

| Event | Payload |
| --- | --- |
| `design-review:annotation` | `{ reviewId, action: 'created' \| 'updated' \| 'resolved' \| 'reopened' \| 'reply' \| 'deleted', annotation, reply? }` (`deleted` carries `annotation: { _id }`) |
| `design-review:updated` | `{ reviewId, review }` (edit, decision, new round) |
| `design-review:deleted` | `{ reviewId }` |
| `design-review:presence` | `{ reviewId, userId, action: 'joined' \| 'left' }` |
| `design-review:pointer` | `{ reviewId, userId, page, x, y, timeMs }` |

Also `design-review:created { reviewId, fileId }` goes to `workspace:<workspaceId>` so file lists can show a badge.

Client flow: open review → `GET /:id` → emit `design-review:join` → apply `design-review:annotation` events by
`annotation._id` (upsert; remove on `deleted`) → emit `design-review:leave` on close.

## Notifications

Type `design_review` (in-app + push via `notificationService.createMany`); `link` is
`/workspace/<workspaceId>/files?file=<fileId>&review=<reviewId>`; `meta = { kind, reviewId, fileId, ... }` with `kind`:

* `review_requested` → reviewers (on create, and reviewers added later)
* `approved` / `changes_requested` → review creator (`meta.status`, `meta.previousStatus`)
* `new_round` → reviewers (`meta.versionNumber`)
* `annotation` → creator and reviewers except the author (`meta.annotationId`)
* `reply` → annotation author, review creator and earlier repliers except the replier
