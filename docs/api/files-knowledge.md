# File library and knowledge categories API

All routes need `Authorization: Bearer <token>`. Errors are `{ message }`
(400 bad input, 403 not allowed, 404 not found / not visible, 409 conflict).

## File library — `/api/v2/files`

### Access model

- Only **active** members of the file's workspace can reach a file (suspended/removed members get 403;
  for restricted files 404).
- Per-user roles in `permissions[]`, ranked **view < download < edit**. The owner (`createdBy`) has every right.
- `access: 'workspace'` (default): every active member can see, preview, download and comment.
- `access: 'restricted'`: only the owner, workspace owners/admins and users listed in `permissions`
  see the file (list, get, versions, comments, preview). Everyone else gets 404 and the file is left
  out of `GET /`. Downloading a restricted file needs the `download` or `edit` role.
- Rename, move, retag, upload a version, restore a version: `edit` role or owner.
- Share (change roles / access) and delete: owner or workspace owner/admin.
- The storage proxy `GET /api/v2/uploads/file?path=…` applies the same rules to library objects
  (current content and every version), so a revoked grant or a removal from the workspace takes
  effect immediately, also for the person who uploaded the object.

Every file object returned by `GET /` and `GET /:id` carries `myRole`: `'owner' | 'edit' | 'download' | 'view'`.

### File fields

`{ _id, workspaceId, createdBy, updatedBy, name, description, mimeType, size, url, gcsPath, folderId,
tags: string[], permissions: [{ user, role }], access, currentVersion, currentVersionNote, isDeleted,
linkedTaskId, createdAt, updatedAt }` — `linkedTaskId` is the task made from the file (`POST /:id/task`, docs/api/tasks.md) — `updatedBy` is who uploaded/changed the current content (null on older files = owner).

### Routes

| method | path | body / query | response |
|---|---|---|---|
| POST | `/` (multipart) | `file`, `workspaceId`, `description?`, `folderId?`, `tags?` (JSON array or comma list) | 201 `{ file }` |
| GET | `/` | `workspaceId`, `folderId?` (`root` or id), `tags?` (comma list), `search?` | `{ files }` |
| GET | `/tags` | `workspaceId` | `{ tags: [{ tag, count }] }` |
| GET | `/:id` | | `{ file }` |
| GET | `/:id/download` | `versionId?` | `{ url, name, mimeType, expiresAt }` — short-lived signed URL (10 min) |
| PATCH | `/:id` | `{ name?, description?, folderId?, tags? }` | `{ file }` |
| DELETE | `/:id` | | `{ message }` (soft delete) |
| PATCH | `/:id/tags` | `{ tags: string[] }` | `{ file }` |
| GET | `/:id/versions` | | `{ versions, current, currentVersion }` |
| POST | `/:id/versions` (multipart) | `file`, `changeNote?` | 201 `{ file, version }` |
| POST | `/:id/versions/:vId/restore` | | `{ file, restoredFrom }` |
| GET | `/:id/comments` | | `{ comments }` |
| POST | `/:id/comments` | `{ content, parentId? }` | 201 `{ comment }` |
| PATCH | `/:id/comments/:commentId` | `{ content }` | `{ comment }` (author only; sets `editedAt`) |
| DELETE | `/:id/comments/:commentId` | | `{ message, commentId, fileId }` (author, file owner or workspace admin) |
| POST | `/:id/share` | `{ permissions?, remove?, access? }` | `{ file }` |

**Tags**: lower-cased, trimmed, de-duplicated; at most 30 tags of ≤ 50 characters; non-strings are a 400.

**Versions**: uploading a new version first stores the new content, then snapshots the previous
content as a `FileVersion` (`versionNumber` = the old `currentVersion`, `createdBy` = whoever had
uploaded that content, `changeNote` = the note it was uploaded with), then bumps `currentVersion`.
The new upload's `changeNote` and uploader are on the file (`currentVersionNote`, `updatedBy`).
`GET /:id/versions` returns the stored versions newest first plus `current` (the live content as a
version entry: `{ versionNumber, url, size, mimeType, createdBy, changeNote, createdAt, isCurrent: true }`).
Restoring copies a version's content back as a **new** current version (the content it replaces is
snapshotted first, so nothing is lost); `currentVersionNote` becomes `Restored version N`.

**Comments**: any member who can see the file may comment. Replies are one level deep: replying to
a reply attaches to the thread root. A `parentId` that is not a live comment on this file is a 400.
Content: 1..5000 characters.

**Share**: each `permissions` entry is `{ user, role }` with role `view | download | edit`; role
`null` or `'none'` removes that user's grant, as does listing their id in `remove: [userId]`.
Grants go only to active workspace members (400 otherwise). `access: 'workspace' | 'restricted'`
switches the file's visibility. The owner can't be given a role (ignored).

### Socket events

Rooms: `workspace:<workspaceId>` (library views) and `file:<fileId>` (join with `file:join { fileId }`).

| event | room(s) | payload |
|---|---|---|
| `file:uploaded` | workspace | `{ file }` |
| `file:updated` | workspace + file | `{ file, reason? }` — reason `version`, `restore`, `share`, `tags` (none for PATCH) |
| `file:deleted` | workspace + file | `{ fileId }` |
| `file:comment` | file | `{ comment }` |
| `file:comment_updated` | file | `{ comment }` |
| `file:comment_deleted` | file | `{ fileId, commentId }` |
| `file:presence` | file | `{ fileId, userId, action: 'viewing' | 'left' }` (existing) |
| `file:task_created` | workspace + file | `{ fileId, taskId, taskTitle }` |

Note: `file:updated` goes to the whole workspace room, so for restricted files clients should
re-check with `GET /:id` (a 404 means hide it) instead of trusting the payload for visibility.

## Knowledge categories — `/api/v2/knowledge/categories`

Any active member of the workspace can manage categories. Categories outside the caller's
workspaces answer 404.

| method | path | body / query | response |
|---|---|---|---|
| GET | `/categories` | `workspaceId` | `{ categories }` sorted by `order`, then name |
| POST | `/categories` | `{ workspaceId, name, color?, icon? }` | 201 `{ category }` |
| PATCH / PUT | `/categories/:id` | `{ name?, color?, icon? }` | `{ category }` |
| DELETE | `/categories/:id` | | `{ message, categoryId, workspaceId, pagesUncategorised }` |
| PUT | `/categories/reorder` | `{ workspaceId, order: [categoryId, …] }` | `{ categories }` |

- `name`: 1..80 characters, unique per workspace (409 on a duplicate).
- `color`: a hex colour (`#c8a274`) or a theme token name (`accent`, `gl-accent`, …). Default is the
  theme's gold accent `#c8a274` (was the off-palette indigo `#6366f1`; existing categories keep their stored colour).
- `icon`: a short string (emoji), ≤ 16 characters. Default `📂`.
- Deleting a category keeps its pages; they become uncategorised (`categoryId: null`).
- Reorder: listed ids get positions 0..n-1; categories left out keep their relative order after them.
  An id from another workspace is a 400.

Socket events (room `workspace:<workspaceId>`): `knowledge:category_created { category }`,
`knowledge:category_updated { category }`, `knowledge:category_deleted { categoryId }`,
`knowledge:categories_reordered { categories }`.
