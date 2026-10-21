# Community templates

Workspace admins share a workspace's **structure** in a public gallery; platform admins moderate it;
any workspace admin can import it. A template holds only public channel names and descriptions (up to
50), the workspace settings that templates support and the feature toggles. Never messages, files,
members or private channels.

Server: `server/src/features/workspace-templates/community.controller.js`, routes in
`workspace-templates.routes.js`, model fields `WorkspaceTemplate.community` and `TemplateRating`.
Errors are `{ message }`.

## Card object

```json
{ "_id": "…", "name": "Product squad", "description": "…", "icon": "📁", "color": "#2563eb",
  "category": "general|engineering|design|marketing|sales|hr|finance|support|product|custom",
  "channels": [{ "name": "general", "description": "…", "isDefault": true }],
  "featureToggles": { "tasks": true, "ai": false },
  "importCount": 12, "ratingAvg": 4.3, "ratingCount": 7,
  "publisher": { "_id": "…", "username": "alice" }, "publishedAt": "…",
  "status": "pending|approved|hidden" }      // status only in /mine and /admin
```

## Endpoints (`/api/workspace-templates`)

| Method | Path | Who | Body / query | Response |
|---|---|---|---|---|
| GET | `/community` | public | `category`, `q`, `sort=popular\|rating\|new`, `page`, `limit` (≤60) | `{ templates: [Card], total, page, totalPages, categories }` (approved only) |
| GET | `/community/mine` | signed in | | `{ templates: [Card + moderationNote] }` |
| POST | `/community/publish` | owner/admin of `workspaceId` | `{ workspaceId, name (3–80), description (10–1000), category?, icon?, color? }` | `201 { message, template }`, status `pending`. `400` if the workspace has no public channels; `409` with 5 pending |
| PATCH | `/community/:id` | publisher | `{ name?, description?, category?, icon?, color? }` | an approved template goes back to `pending` |
| DELETE | `/community/:id` | publisher or platform admin | | removed from the gallery (workspaces that applied it keep their channels) |
| POST | `/community/:id/rate` | signed in, not the publisher | `{ rating: 1–5 }` | `{ ratingAvg, ratingCount, yourRating }`; one rating per user (again = replace) |
| POST | `/community/:id/report` | signed in | `{ reason (3–500) }` | once per user (`409` again) |
| GET | `/community/admin` | platform admin | `status=pending\|approved\|hidden\|reported` | `{ templates: [Card + status, reportCount, reports: [{ reason, at, by }], moderationNote], counts: { pending, approved, hidden, reported } }` |
| POST | `/community/admin/:id/moderate` | platform admin | `{ action: 'approve'\|'hide'\|'dismiss_reports', note? }` (note required to hide) | `{ message, status, isPublic }` |

Import is the existing `POST /api/workspace-templates/:id/import { workspaceId }` (workspace admin);
it increments `importCount` (`usageCount`). Approved community templates also appear in
`GET /api/workspace-templates/public`; pending and hidden ones never do.

Company templates (`POST /api/workspace-templates`, company admins) can no longer be made public
directly (`isPublic` is ignored): public sharing always goes through moderation.

## Web UI

- Workspace → Apps → **Templates** (`/workspace/:id/templates`): tabs *All templates*, *Community*
  (sort, channel preview, ratings, import counts, rate, report) and *My submissions*; **Share this
  workspace** (admins) publishes.
- Platform admin → **Marketplace review** → *Community templates*.
