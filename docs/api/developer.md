# Developer platform: app marketplace

Developers build apps for every Oruinwan workspace. An app goes through review by a platform admin
(role `oruinwan_admin`, the Platform admin console at `/platform-admin/marketplace`) before it is listed.
Installing an app gives it a workspace-scoped **app token** for the [public API](public-api.md).

Server: `server/src/features/developer/` (`app.model.js`, `appInstall.service.js`, `myApps.routes.js`,
`apps.routes.js`, `platformAdmin.middleware.js`) and `server/src/features/community/marketplace.routes.js`.
All routes need a signed-in user unless marked public. Errors are `{ message }`.

## Lifecycle

```
draft ──submit──▶ submitted ──approve──▶ approved (listed)
  ▲                  │   └────reject───▶ rejected ──submit──▶ submitted
  └────withdraw──────┘
approved ──edit──▶ submitted (hidden until approved again; existing installs keep working)
approved ──reject (take down)──▶ rejected (uninstalled everywhere, all tokens revoked)
```

Seeded first-party apps have no owner and count as approved (rows without `status` are approved).

## App object (owner view)

```json
{ "_id": "…", "name": "Standup", "description": "…", "category": "productivity|communication|developer|automation|analytics",
  "iconUrl": "https://…|null", "developer": "Display name", "version": "1.0.0",
  "status": "draft|submitted|approved|rejected",
  "homepageUrl": null, "webhookUrl": "https://…", "redirectUrl": null,
  "scopes": ["tasks:read", "tasks:write"],            // subset of messages:read tasks:read tasks:write files:read users:read channels:read
  "botUser": { "enabled": true, "name": "Standup" },
  "signingSecret": "whsec_…",                         // owner only
  "submittedAt": "…", "review": { "note": "…", "reviewedBy": "…", "reviewedAt": "…" },
  "installCount": 3, "createdAt": "…", "updatedAt": "…" }
```

Marketplace listings never include `installedIn`, `signingSecret` or URLs other than `homepageUrl`.

## My apps (developer)

| Method | Path | Body / notes | Response |
|---|---|---|---|
| GET | `/api/developer/my-apps` | | `{ apps: [App], scopes, categories }` |
| POST | `/api/developer/my-apps` | `{ name (2–60), description (10–1000), category?, iconUrl? (https), homepageUrl?, webhookUrl?, redirectUrl?, version? (x.y.z), developer?, scopes?, botUser?: { enabled, name? } }` | `201 { app }` (status `draft`, new signing secret). `409` duplicate name or >25 apps |
| PATCH | `/api/developer/my-apps/:id` | same fields, partial | `{ message, app }`. `409` while `submitted`. Editing an `approved` app sets it back to `submitted` |
| POST | `/api/developer/my-apps/:id/submit` | | `{ message, app }`. From `draft`/`rejected` only. An app with scopes needs a `webhookUrl` or `redirectUrl` (`400`) |
| POST | `/api/developer/my-apps/:id/withdraw` | | `{ message, app }` (`submitted` → `draft`) |
| POST | `/api/developer/my-apps/:id/rotate-secret` | | `{ message, signingSecret }` |
| DELETE | `/api/developer/my-apps/:id` | | `{ message, revokedTokens, revokedBots }`; deletes reviews too |

Non-owners get `404` for another developer's app.

## Review queue (platform admin)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/developer/admin/apps?status=submitted\|approved\|rejected\|draft\|all` | | `{ apps: [App + ownerId: { _id, username, email }], counts: { submitted: n, … } }` |
| POST | `/api/developer/admin/apps/:id/review` | `{ decision: 'approve'\|'reject', note }` (note required to reject) | `{ message, status, revokedTokens?, revokedBots? }` |

`approve` only from `submitted`. `reject` from `submitted` or `approved` (take-down). The developer is
emailed the outcome (best effort). Non-admins get `403`.

## Marketplace (workspace)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/marketplace/apps?workspaceId=&category=&q=&page=&limit=` | Public; with `workspaceId` (member) each app has `installed`. Approved apps only. Adds `avgRating`, `reviewCount`, `installCount`, `scopes`, `botUser` |
| POST | `/api/marketplace/install` `{ appId, workspaceId }` | Workspace owner/admin. Response below |
| POST | `/api/marketplace/uninstall` `{ appId, workspaceId }` | Workspace owner/admin. Revokes the app token and bot user in that workspace |
| GET/POST | `/api/developer/apps`, `/api/developer/apps/:id/install`, `DELETE /api/developer/apps/:id/uninstall` | Same, older paths |

Install response:

```json
{ "message": "Standup installed successfully", "appId": "…", "name": "Standup", "installed": true,
  "scopes": ["tasks:read"], "appToken": "chx_…|null", "botToken": "bot_…|null", "webhookDelivered": true }
```

- `appToken` is an API key (`ApiKey.appId` set) bound to the workspace with exactly the app's scopes.
  Use it as `X-Api-Key` on `/api/public/v1/*`. It is not listed or revocable under Developer → API keys
  (`409` there); uninstalling revokes it. `null` when the app declares no scopes.
- `botToken`: a `Bot` (`Bot.appId` set) when the app declares a bot user. Bot permissions are the app's
  `messages:*`/`tasks:*` scopes (a bot with `messages:read` also gets `messages:write`).
- Tokens are shown once to the installer and delivered to the app (below). `409` if already installed.

### Delivery to the app

When the app has a `webhookUrl` (public http(s) URL; private addresses are refused), Oruinwan POSTs:

```
POST <webhookUrl>
Content-Type: application/json
X-Oruinwan-Event: app.installed | app.uninstalled
X-Oruinwan-Signature: sha256=<hex HMAC-SHA256 of the raw body, keyed with the app's signingSecret>

{ "event": "app.installed", "appId": "…", "timestamp": "…",
  "data": { "workspaceId": "…", "installedBy": "…", "scopes": [...], "token": "chx_…", "botToken": "bot_…|null" } }
```

`app.uninstalled` data is `{ workspaceId }`. 8 s timeout, no retries; failure does not fail the
install (`webhookDelivered: false`, the admin can paste the token into the app instead).

## Reviews

| Method | Path | Notes |
|---|---|---|
| POST | `/api/marketplace/review` | `{ appId, rating (integer 1–5), comment? (≤1000), workspaceId }`. The caller must be an active member of `workspaceId` and the app installed there (`403`); owners can't review their own app. One review per user per app: posting again replaces it. `201 { message, review }` |
| GET | `/api/marketplace/reviews/:appId?page=&limit=` | Public. `{ reviews: [{ _id, userId: { username, profilePicture }, rating, comment, createdAt }], total, page, totalPages, avgRating }` |

## Public integrations directory

`GET /api/marketplace/integrations/public` (public, cached 5 min):

```json
{ "integrations": [{ "type": "github", "label": "GitHub", "category": "developer", "description": "…", "workspaceCount": 12 }] }
```

Every connector the server ships (GitHub, Jira, Zoom and the connector registry). `workspaceCount` is the
number of workspaces with it connected, or `null` below 5 so a count cannot identify a workspace. No
workspace ids, labels or settings are returned. Shown on the Apps page under **All integrations**.

## Web UI

- Developer portal (`/workspace/:id/developer`): **My apps** tab (`?tab=my-apps`) and **Docs → API Reference**
  (renders `/api/public/v1/openapi.json`).
- Apps page: marketplace cards show scopes / bot user; install shows the tokens once; reviews dialog.
- Platform admin: `/platform-admin/marketplace` (apps and community templates).
