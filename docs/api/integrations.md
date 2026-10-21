# Integrations API

Base path: `/api/v2/integrations`. All routes except the incoming webhook
endpoints need a signed-in user (`Authorization: Bearer …`) and a
`workspaceId` (query for GET/DELETE, body otherwise). "Member" means an
active member of that workspace, "admin" an owner or admin.

Provider routes are behind the `integrations` release flag, which is **on by
default** (`FEATURES_DISABLED=integrations` turns it off; the routes then
answer `404 FEATURE_DISABLED`). Outgoing webhooks and AI providers are always on.

Errors: `{ message, code? }`. Common codes: `INTEGRATION_NOT_CONNECTED` (404),
`INTEGRATION_NOT_CONFIGURED` (400), `<PROVIDER>_BAD_TOKEN` (502 — the provider
rejected the token), `<PROVIDER>_FORBIDDEN` (403), `<PROVIDER>_NOT_FOUND`
(404), `<PROVIDER>_RATE_LIMITED` (429), `<PROVIDER>_INVALID` (400),
`BRIDGE_ACK_REQUIRED` (400).

Connector types: `gitlab`, `bitbucket`, `linear`, `cicd`, `slack`, `teams`,
`google_meet`, `google_drive`, `onedrive`, `dropbox`, `notion`, `confluence`,
`zapier`, `make`, `n8n`. GitHub, Jira and Zoom keep their own routes (see
`docs/integrations.md`) but share `/:type/config`, `/:type/test`,
`/:type/rotate-secret` and `/disconnect`.

## Catalog

`GET /catalog?workspaceId=` (member) →
```json
{ "connectors": [{
  "type": "gitlab", "label": "GitLab", "category": "developer|communication|files|docs|automation",
  "description": "…", "setup": ["step", "…"],
  "form": [{ "key": "token", "label": "Access token", "kind": "secret|text|url|email|textarea|select", "required": true, "placeholder": "…", "hint": "…", "options": [{ "value", "label" }], "secret": true }],
  "toggles": [{ "key": "createTasks", "label": "…", "description": "…" }],
  "routes": { "label": "Project", "placeholder": "group/project or *", "hint": "…", "events": [{ "id": "issues", "label": "Issues" }] | null, "wildcard": true } | null,
  "defaultChannel": false,
  "bridge": { "remoteLabel": "Slack channel ID", "remotePlaceholder": "C0123ABCD or *", "remoteRequired": true } | null,
  "webhook": { "how": "…", "tokenInUrl": false, "generatedSecret": true } | null,
  "actions": { "projects": { "method": "GET", "admin": false, "linksTask": false, "importsPage": false } },
  "canAttach": false
}] }
```
The settings UI renders every connector from this.

## Config

- `GET /:type/config?workspaceId=` (member) →
  `{ type, label, connected, status, configured, config, webhookUrl, lastEventAt }`.
  `config` has secrets masked as `"••••"` plus `has<Field>` booleans, `account`
  (who the token belongs to, from the last verification) and `verifiedAt`.
  Members don't get `routes`, `webhookUrl` or hidden fields.
- `PUT /:type/config` (admin) body `{ workspaceId, label?, …fields }`:
  secrets (omit or send `"••••"` to keep, `""`/`null` to clear), plain fields,
  toggles, `routes: [{ match, channelId, events? }]`, `defaultChannelId`,
  `bridges: [{ remote, channelId, direction: "in"|"out"|"both", acknowledgeOutgoing? }]`.
  New credentials are **verified with a real API call before saving** (400 with
  the provider's reason otherwise). Response = GET shape for admins plus
  `webhookSecret` once when Oruinwan generated a secret (for `tokenInUrl`
  connectors the `webhookUrl` then contains the token; later it is masked).
  Turning on `out`/`both` for a bridge needs `acknowledgeOutgoing: true` (the
  messages leave end-to-end encryption); `outEnabledAt`/`outEnabledBy` are stored.
- `POST /:type/test` (admin) body `{ workspaceId, …unsaved fields }` →
  `{ ok: true, account }` or `{ ok: false, message, code }`. Does not save.
- `POST /:type/rotate-secret` (admin) → GET shape + new `webhookSecret` (once).
- `POST /disconnect` (admin) `{ workspaceId, type }` — deletes the stored config.
- `GET /?workspaceId=` (member) → `{ integrations: [{ type, status, label, lastEventAt, … }] }` (no config).

## Actions

`GET /:type/actions/:action?workspaceId=&…` and `POST /:type/actions/:action`
`{ workspaceId, … }` (member; `admin: true` actions need an admin). The
integration must be connected (except `google_meet/check-link`).

| type | action | method | input | result |
|---|---|---|---|---|
| gitlab | `projects` | GET | `q?` | `{ projects: [{ id, path, name, url }] }` |
| gitlab | `issues` | GET | `project`, `q?` | `{ issues: [{ id, number, title, url, state, author }] }` |
| gitlab | `issue` | POST | `project, title, description?, taskId?` | `{ issue: { id, number, url, title, repo }, task? }` |
| bitbucket | `repos` | GET | `q?` | `{ repos: [{ id, path, name, url, hasIssues }] }` |
| bitbucket | `issues` / `pullrequests` | GET | `repo` (workspace/repo) | `{ issues }` / `{ pullRequests }` |
| bitbucket | `issue` | POST | `repo, title, description?, taskId?` | `{ issue, task? }` |
| linear | `teams` | GET | – | `{ teams: [{ id, key, name }] }` |
| linear | `issues` | GET | `team?`, `q?` | `{ issues: [{ id, key, title, url, state, assignee }] }` |
| linear | `issue` | POST | `teamId` or `team` (key), `title, description?, taskId?` | `{ issue: { id, key, url, title, team }, task? }` |
| slack | `channels` (admin) | GET | – | `{ channels: [{ id, name, isPrivate, isMember }] }` (needs bot token) |
| teams | `send-test` (admin) | POST | – | `{ ok: true }` — posts a visible test message to Teams |
| google_drive, onedrive, dropbox | `search` | GET | `q?`, `folder?` | `{ items: [Item] }` (empty `q` browses recent / root) |
| google_drive, onedrive, dropbox, notion, confluence | `item` | GET | `id` | `{ item: Item }` (Dropbox: `url` is a shared link, created if needed) |
| notion, confluence | `search` | GET | `q?` | `{ items: [Item] }` |
| google_meet | `meeting` | POST | `title?, start? (ISO), durationMinutes?` | `{ meeting: { joinUrl, eventId, eventUrl, title, start, durationMinutes } }` |
| google_meet | `check-link` | POST | `url` | `{ meeting: { joinUrl } }` or 400 — for "paste a Meet link" |

`Item = { id, title, url, kind: 'file'|'folder'|'page'|'database', mimeType, modifiedAt, owner, path }`.
With `taskId`, created issues are linked to that task (`externalLinks` + activity),
like GitHub/Jira.

- `POST /:type/attach` (member) `{ workspaceId, itemId, taskId }` — fetches the
  item again by id and adds it to the task's `externalLinks`
  (`provider: <type>, kind: 'file'|'page'`). → `{ item, task: { id, issueKey } }`.
  To attach to a **message**, the client puts `item.url` (for Dropbox, from the
  `item` action) into the message text so it stays end-to-end encrypted.
- `POST /:type/import` (member; notion, confluence) `{ workspaceId, id, parentId?, categoryId? }`
  — `id` may be a Notion page URL. Creates a Knowledge page (Markdown, with a
  "Imported from …" footer, tag = type) as the caller. → 201 `{ page: { id, title }, source: Item }`.

## Slack / Teams bridge

- `GET /bridge/channels?workspaceId=` (member) →
  `{ channels: [{ channelId, outgoing, providers: [{ type, label, direction }] }] }`.
  Clients show a "messages here are copied to Slack/Teams and leave end-to-end
  encryption" notice in channels with `outgoing: true`.
- `POST /bridge/relay` (member) `{ workspaceId, channelId, messageId, text }` —
  called by the **sender's client right after it sent** a message in a channel
  with an outgoing bridge, with the plaintext it has. The server checks the
  caller is a channel member and the sender of `messageId` (≤ 10 minutes old,
  relayed once), then forwards to every acknowledged `out`/`both` bridge
  (Slack `chat.postMessage` as "<name> (Oruinwan)" or the incoming-webhook URL;
  Teams webhook URL). → `{ relayed: [{ type, via }], failed: [{ type, message }], duplicate? }`.

## Incoming provider webhooks

`POST /webhook/:type?workspaceId=<id>[&token=…]` — no session; authenticated per provider:

| type | authentication |
|---|---|
| gitlab | `X-Gitlab-Token: <generated secret>` |
| bitbucket | `X-Hub-Signature: sha256=<HMAC-SHA256(body, generated secret)>` |
| linear | `Linear-Signature: <hex HMAC(body, pasted signing secret)>`, `webhookTimestamp` within 5 min |
| cicd | `?token=` / `X-Oruinwan-Token` / `X-Gitlab-Token` / `X-Hub-Signature-256` / `circleci-signature: v1=…` with the generated token |
| slack | `X-Slack-Signature: v0=HMAC("v0:"+ts+":"+body, signing secret)`, ts within 5 min; answers `url_verification` |
| teams | `Authorization: HMAC <base64 HMAC(body, base64-decoded security token)>`; the response body is shown in Teams |
| zapier, make, n8n | `?token=` or `X-Oruinwan-Token` (generated) |

Effects are applied: bot cards (`message.type = 'integration'`, card in
`message.integration`, summary line encrypted with the channel's server-held
key) in the routed / bridged / default channel, task create / link / status
moves, and automations (`webhook.received` with `webhookType` and the event —
for `cicd` the normalised build `{ system, pipeline, repo, status, url, branch, commit, number }`).
Response: `{ ok, posted, tasks, createdTasks }` (Teams: `{ type: 'message', text }`).

Automation tools' JSON: `{ text, channel?, title?, url?, username?, task?: { title, description?, dueDate? }, … }`.

Socket events: the usual `new-message` (via the messages service) for new cards,
`message:edited` when a card is updated in place, `task-created` for created tasks.

### Card shape (`message.integration`)

`{ provider, kind, action, repo, number, key, url, title, state, author, authorAvatar, branch, base, checks, taskIds, taskKeys, extra }`

- providers: `github, gitlab, jira, bitbucket, linear, cicd, slack, teams, zapier, make, n8n, webhook`
- kinds: `pull_request, pr_review, issue, push, checks, jira_issue, message`
- `kind: 'message'` = text from Slack/Teams/an automation tool/an incoming
  webhook; `author` is the remote sender, `extra.notE2EE === true`,
  `extra.bridged === true`. The text is the message summary.

## Generic incoming webhooks

Management (admin):

- `GET /incoming-webhooks?workspaceId=` → `{ webhooks: [Hook] }`
- `POST /incoming-webhooks` `{ workspaceId, channelId, name }` → 201 `{ webhook: Hook }`
- `PATCH /incoming-webhooks/:hookId` `{ workspaceId, name?, channelId?, isActive? }` → `{ webhook }`
- `POST /incoming-webhooks/:hookId/rotate` `{ workspaceId }` → `{ webhook }` (new URL; the old one stops working)
- `DELETE /incoming-webhooks/:hookId?workspaceId=`

`Hook = { id, name, channelId, isActive, lastUsedAt, useCount, createdAt, url }`
(`url` contains the secret; only admins get it).

Delivery (public): `POST /hooks/:hookId/:token` with Slack-compatible JSON
`{ text, username?, attachments?: [{ pretext, title, title_link, text, fallback }], blocks?: [{ text: { text }, fields }] }`
(or form-encoded `payload=<json>`). Answers `ok` (text/plain) like Slack;
errors: `no_text` 400, `no_service` 404, `webhook_disabled` 410,
`channel_not_ready` 409 (nobody has written in the channel yet, so the
server has no channel key), `rate_limited` 429 (120/min per hook).
Posted by the "Incoming webhook" bot as a `kind: 'message'` card, `author` =
`username` or the hook name, `extra.notE2EE: true`.
