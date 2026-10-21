# Integrations

GitHub pull requests, pushes, checks and issues show up as cards in a workspace channel. The
cards link to Oruinwan tasks, and Oruinwan AI can review a PR's diff. Jira issues sync with tasks.
Zoom creates meetings from chat. GitLab, Bitbucket, Linear, CI/CD, Slack, Microsoft Teams, Google
Drive, OneDrive, Dropbox, Notion, Confluence, Google Meet, Zapier, Make and n8n connect with a
pasted token or webhook URL (no OAuth app) — see section 5. The server code lives in
`server/src/features/integrations/`; the API is in [docs/api/integrations.md](api/integrations.md).

## 1. The feature flag

Everything under `/api/v2/integrations` (except outgoing webhooks and AI providers) sits behind the
`integrations` release flag. It is **on by default**: the integrations are launched and real. To
hide them (the routes then answer 404 and the settings disappear):

```bash
# server/.env
FEATURES_DISABLED=integrations
```

Restart the API afterwards. It doesn't hot-reload. `GET /api/flags` shows the resolved flags.

Optional keys are in `server/.env.example`: `INTEGRATIONS_PUBLIC_URL`, `GITHUB_API_URL`,
`INTEGRATIONS_AI_REVIEWS_PER_HOUR` and the others.

## 2. GitHub

### Personal access token

1. On GitHub, go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Under **Repository access**, pick the repos the workspace works on.
3. Under **Permissions → Repository**, set:
   - **Pull requests: Read**, so the PR viewer and AI review work.
   - **Contents: Read**, for whole-file view.
   - **Checks** and **Commit statuses: Read**, for check results.
   - **Issues: Read & write**, so `/github` can create issues.
   - **Metadata: Read**, which GitHub adds automatically.
   
   A classic token with the `repo` scope also works.
4. In Oruinwan, open **Integrations → GitHub**, paste the token and add routes. A route maps a repo
   (`owner/name`, or `*` for any repo) to a channel and a set of events. The API call is
   `PUT /api/v2/integrations/github/config`.
5. The response contains `webhookUrl` and `webhookSecret`. The secret is shown only this once, so
   copy it now. If you lose it, rotate it with `POST /api/v2/integrations/github/rotate-secret`.

### Webhook

In the repo (or the org), go to **Settings → Webhooks → Add webhook** and fill in:

| Field | Value |
|---|---|
| Payload URL | the `webhookUrl`, e.g. `https://<public-host>/api/v2/integrations/webhook/github?workspaceId=<id>` |
| Content type | `application/json` |
| Secret | the `webhookSecret` |
| Events | "Let me select individual events": **Pull requests**, **Pull request reviews**, **Issues**, **Pushes**, **Check suites**, **Workflow runs** |

The server checks every delivery's `X-Hub-Signature-256` header against the HMAC-SHA256 of the raw
body. It rejects the delivery with 401 if the signature is missing or wrong, or if the workspace has
no connected GitHub integration. The **Recent Deliveries** tab on GitHub shows the JSON result of
each delivery.

What arrives in the channel:

- **Cards.** There's one card per PR per channel. Later events update the card in place
  (synchronize, review, checks, merged or closed); the server emits `message:edited`.
- **Thread replies.** A reply is added only when a review is submitted, when checks fail and when
  the PR is merged.
- **Pushes.** Each push gets one compact card, with no thread.

Task keys (for example `ABC-12`) found in a PR's title, branch or body link the PR to those tasks:

- The task gets an `externalLinks` entry and an activity line.
- If `statusSync` is on, the task's status follows the PR:
  - Opening a PR (non-draft) moves the task to `review`, from backlog, todo or in_progress.
  - Opening a draft moves it to `in_progress`, from backlog or todo.
  - Merging moves it to `done`.
  - Closing without merging only adds an activity line.

The normal workflow rules still apply to every move.

If `autoReview` is on, Oruinwan AI reviews each PR when it's opened or marked ready for review.

### Exposing localhost for webhooks

GitHub can't reach `localhost`, so during development you need a tunnel to the API port:

```bash
ngrok http 8080                          # → https://abc123.ngrok-free.app
# or
cloudflared tunnel --url http://localhost:8080
```

Put the tunnel URL in `server/.env` so the app shows the right webhook URL, then restart the API:

```bash
INTEGRATIONS_PUBLIC_URL=https://abc123.ngrok-free.app
```

### Simulating a signed webhook with curl

```bash
API=http://localhost:8080
WS=<workspaceId>
SECRET=<webhookSecret>
BODY='{"action":"opened","pull_request":{"number":12,"title":"ABC-1: login form","body":"","state":"open","draft":false,"merged":false,"user":{"login":"octocat"},"head":{"ref":"feature/abc-1-login","sha":"abc123"},"base":{"ref":"main"},"html_url":"https://github.com/acme/web/pull/12","additions":40,"deletions":3,"changed_files":2,"commits":1},"repository":{"full_name":"acme/web","html_url":"https://github.com/acme/web"},"sender":{"login":"octocat"}}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')"

curl -sS -X POST "$API/api/v2/integrations/webhook/github?workspaceId=$WS" \
  -H 'Content-Type: application/json' \
  -H 'X-GitHub-Event: pull_request' \
  -H "X-Hub-Signature-256: $SIG" \
  --data-binary "$BODY"
```

The signature must be computed over exactly the bytes you send, which is why the command uses
`--data-binary` with the same `$BODY`. If you change the secret or a single byte, you get 401.

For the bot to post in a channel, the server has to hold that channel's key. The key is created the
first time a member sends a message in the channel from the app. Until then, the server logs
"cannot encrypt for channel" and skips the card; task linking still works.

### Endpoints used by the app

| Method and path | Who | Purpose |
|---|---|---|
| `GET /github/pr?workspaceId&repo&number` | members | PR, files and patches, checks, linked tasks. Cached for 60 s. |
| `GET /github/file?workspaceId&repo&ref&path` | members | Whole file as `text/plain`, capped at 1 MB. |
| `GET /github/prs?workspaceId&repo?` | members | Open PRs across the routed repos. |
| `POST /github/issue` | members | Create a GitHub issue and optionally link it to a task. |
| `POST /github/pr/review` | members, when AI is enabled | Oruinwan AI review. Uses only the local engine. Limited to 30 per hour per workspace. |

## 3. Jira (Cloud)

1. Create an API token at <https://id.atlassian.com/manage-profile/security/api-tokens>.
2. In Oruinwan, open **Integrations → Jira** and enter `baseUrl` (`https://your-team.atlassian.net`),
   your account `email`, the `apiToken`, and routes from a project key (or `*`) to a channel. The
   response includes a `webhookUrl` with the webhook token filled in; this is the only time it's
   shown in full. Later reads show `token=••••`. To get a new token, rotate it.
3. In Jira, go to **Settings → System → WebHooks → Create a WebHook**. Use the `webhookUrl` as the
   URL and tick the **Issue: created, updated, deleted** events.
4. **Test** calls `/rest/api/3/myself` to check the credentials.

What happens with Jira events:

- **Webhook check.** Deliveries without the correct `token` get 401 (compared in constant time).
- **New issues.** When `linkTasks` is on and a route exists for the issue's project, a new Jira
  issue creates a channel task in the routed channel. The task is linked back through
  `externalLinks`.
- **Status changes.** When `statusSync` is on, a Jira status change moves the linked tasks:
  To Do → todo, In Progress → in_progress, Done → done.
- **Creating issues from chat.** `/jira` calls `POST /api/v2/integrations/jira/issue`.

## 4. Zoom (Server-to-Server OAuth)

1. In the Zoom App Marketplace, go to **Develop → Build App → Server-to-Server OAuth**.
2. Add the scope `meeting:write:meeting:admin` (or `meeting:write:admin` on older apps) and activate the app.
3. In Oruinwan, open **Integrations → Zoom** and enter the **Account ID**, **Client ID** and
   **Client Secret**. **Test** fetches an access token to check them.
4. `/zoom` calls `POST /api/v2/integrations/zoom/meeting` with `{ workspaceId, topic, start?, durationMinutes? }`
   and gets back `{ id, joinUrl, startUrl, password }`. Without `start`, it creates an instant meeting.

## 5. Token-based connectors

Every connector is set up in **Settings → Integrations** by a workspace owner or admin: paste the
token / URL, **Test**, **Save**. Saving new credentials makes a real API call first and refuses
to store credentials the provider rejects. Secrets are sealed with `SERVER_KEK` and never sent
back (the UI sees `••••`). Generated webhook secrets are shown once; rotate to see a new one.
The settings page is driven by `GET /api/v2/integrations/catalog`, which carries each connector's
form, setup steps, routes and bridge options.

Webhook results are **applied**, not just parsed:

- **Cards** are posted by the provider's bot account (GitLab, Bitbucket, Linear, CI/CD, Slack,
  Microsoft Teams, Zapier, Make, n8n, Incoming webhook) in the channel picked by the connector's
  **routes** (`match` → channel, optional event filter; `*` matches everything) or its default
  channel. One card per object per channel, updated in place.
- **Tasks**: task keys (`ABC-12`) in merge/pull request titles, branches and descriptions link them
  to tasks; with **Move linked tasks** on, opening/merging moves them (review, done). With
  **Create a task for each new issue** on, new GitLab / Bitbucket / Linear issues become tasks in
  the routed channel, linked back to the issue; closing the issue moves the task to done.
- **Automations**: every delivery fires `webhook.received` with `webhookType` = the connector type.

As with GitHub, a bot can post only in channels where someone has already sent a message (the
server needs that channel's key).

### GitLab

1. Create a personal / project / group access token with the `api` scope.
2. Enter the GitLab address (`https://gitlab.com` or your self-managed host) and the token.
3. In the project → **Settings → Webhooks**: the webhook URL shown, **Secret token** = the generated
   secret, events **Issues**, **Merge requests**, **Push**, **Pipeline**. Oruinwan checks
   `X-Gitlab-Token`.
4. Routes: `group/project` (or `*`) → channel.

Chat: `/gitlab issue group/project <title>`. API actions: `projects`, `issues`, `issue` (with an
optional `taskId` to link the new issue to a task).

### Bitbucket Cloud

1. Create an API token (Atlassian account) or an app password with Repositories read, Issues
   read/write, Pull requests read — enter it with your username / e-mail. A repository or workspace
   access token works too; leave the username empty (Bearer auth).
2. Repository → **Repository settings → Webhooks**: the URL shown, **Secret** = the generated
   secret (deliveries are checked with the `X-Hub-Signature` sha256 HMAC), events Push, Pull
   request (created, updated, merged, declined), Issue (created, updated), Build status.
3. Routes: `workspace/repo` → channel.

Chat: `/bitbucket issue workspace/repo <title>`.

### Linear

1. **Settings → Security & access → Personal API keys** → create a key, paste it.
2. **Settings → API → Webhooks** → URL shown, tick **Issues**; paste the signing secret Linear shows
   (checked against `Linear-Signature`, deliveries older than 5 minutes are refused).
3. Routes: team key (`ENG`) → channel. State changes move linked tasks (started → in progress,
   completed → done).

Chat: `/linear issue ENG <title>`.

### CI/CD (GitHub Actions, GitLab CI, Jenkins, CircleCI, anything)

Save to get a URL with a token, choose a default channel (and optional routes by repo / pipeline
name) and whether to post finished builds, failures only or every update.

| System | Setup |
|---|---|
| GitHub Actions | Repository webhook, content type JSON, secret = token, event **Workflow runs** (`X-Hub-Signature-256` is checked) |
| GitLab CI | Project webhook, secret token = token, **Pipeline events** |
| Jenkins | Notification plugin, JSON over HTTP to the URL (token in the URL) |
| CircleCI | Project settings → Webhooks, secret = token, **Workflow completed** (`circleci-signature` is checked) |
| Other | `POST <url>` with `{"name","status","url","branch","repo","commit"}` |

The build is posted as a status card and handed to automations as
`{ webhookType: 'cicd', system, pipeline, repo, status: success|failure|cancelled|running, url, branch, commit, number }`,
so an automation "When a webhook is received" with condition `status equals failure` can, for
example, create a task.

### Slack bridge — and why outgoing is special

**Incoming (Slack → Oruinwan).** Create a Slack app, add bot scopes `channels:history`,
`groups:history`, `users:read`, `chat:write` (+ `chat:write.customize` to show the sender's
name), install it, and paste the **Bot token** and **Signing secret**. Under **Event
Subscriptions** use the request URL shown (Slack's `url_verification` is answered once the
signature checks out) and subscribe to `message.channels` / `message.groups`. Invite the app to
the Slack channels you bridge. Add bridges: Slack channel ID (or `*`) → Oruinwan channel →
direction. Messages arrive from the **Slack** bot with the Slack author's name and the label
"Via Slack · not end-to-end encrypted". Bot messages and Slack retries are ignored (no loops, no
duplicates).

**Outgoing (Oruinwan → Slack).** Oruinwan messages are end-to-end encrypted; the server cannot
read them and therefore cannot forward them by itself. The design:

1. An admin must explicitly switch a bridge to **Out** or **Both**. The UI shows a warning that
   copies leave end-to-end encryption and are stored by Slack, and the API refuses the change
   without `acknowledgeOutgoing: true`. Who enabled it and when is recorded.
2. Every member's app shows a notice above the composer in that channel: "Messages you send here
   are also copied to Slack. Those copies are not end-to-end encrypted."
3. When someone sends a message there, **their own app** — which has the plaintext — calls
   `POST /bridge/relay` with the text right after sending. The server checks the caller sent that
   message (in the last 10 minutes, once) in a channel they belong to, then posts it with
   `chat.postMessage` as "<name> (Oruinwan)" (bot token + channel ID) or to the Slack incoming
   webhook URL.
4. Nothing else is ever copied: other channels, edits, attachments and messages sent before the
   bridge was enabled stay end-to-end encrypted. (The server cannot prove the relayed text equals
   the encrypted message; only the sender can relay, so this is the sender choosing to share
   their own words.)

An incoming-webhook URL alone is enough for outgoing only (it is checked on save without posting:
Slack answers `no_text` to an empty message).

### Microsoft Teams bridge

- **Outgoing**: in the Teams channel add an **Incoming Webhook** connector, or a **Workflows** flow
  "Post to a channel when a webhook request is received", and paste its URL. Same E2EE rules as
  Slack. **Send test message** posts a visible test message.
- **Incoming**: Teams → **Apps → Manage your apps → Create an outgoing webhook** with the URL
  shown as callback; paste the security token. People @mention it in Teams; the request is checked
  with `Authorization: HMAC …` and Teams shows "Posted to Oruinwan."

### Google Drive, OneDrive, Dropbox

| App | Credential |
|---|---|
| Google Drive | A **service account JSON key** (Drive API enabled; share folders with the service account's e-mail) — recommended, keeps working. Or an OAuth access token with `drive.readonly` (expires in about an hour). A Google **API key cannot** read private files and is rejected. |
| OneDrive / SharePoint | A Microsoft Graph access token with `Files.Read.All` (e.g. Graph Explorer; expires in about an hour). |
| Dropbox | An app's **Generated access token** (scopes `files.metadata.read`, `sharing.read`, `sharing.write`). |

Use them from chat with `/drive`, `/onedrive`, `/dropbox [search]`: a picker searches / browses the
app and posts the file's link as your (encrypted) message — Dropbox files get a shared link. In a
task's detail panel, **Attach from …** adds the file to the task's linked items (the server fetches
it again by id, so only real files are linked). When a token expires, the UI shows the provider's
"rejected the token" message; paste a new one.

### Notion and Confluence

- **Notion**: an internal integration secret (notion.so/profile/integrations); share pages or
  teamspaces with the integration (••• → Connections).
- **Confluence Cloud**: site address, account e-mail and an API token.

`/notion` and `/confluence [search]` open the picker: **Share** posts the page link, **Import to
Knowledge** copies the page into Knowledge as Markdown (headings, lists, to-dos, code, quotes,
links, images, tables) with an "Imported from …" link back, created as you. Pages can also be
attached to tasks.

### Google Meet

Google Meet links are created for real through the Calendar API (an event with a Meet conference)
with a pasted OAuth access token that has the `calendar.events` scope. `/gmeet [title]` creates
one; without a connected token Oruinwan says so and `/gmeet https://meet.google.com/abc-defg-hij`
shares a link you paste (validated). Links are never invented.

### Zapier, Make, n8n

Save to get an inbound URL (token included). In the tool, POST JSON to it:

```json
{ "text": "Deploy finished", "channel": "deploys", "title": "v2.3", "url": "https://…",
  "task": { "title": "Check the release notes", "description": "…", "dueDate": "2026-11-01" } }
```

- `text` is posted by the tool's bot in the route named by `channel` (routes map names to
  channels) or the default channel, marked as not end-to-end encrypted.
- `task` creates a channel task in that channel.
- The whole payload goes to automations (`webhook.received`, `webhookType` = `zapier`/`make`/`n8n`).

Tool steps: Zapier — **Webhooks by Zapier → POST**, payload type JSON. Make — **HTTP → Make a
request**, POST, body Raw/JSON. n8n — **HTTP Request** node, POST, JSON body.

**Outbound** (Oruinwan → the tool) uses **Outgoing webhooks** on the same page: add the tool's
catch-hook URL (Zapier "Catch Hook", Make "Custom webhook", n8n "Webhook" node) and pick events
(`task.created`, `task.completed`, `message.sent` metadata, …). Requests are signed with
`X-Chttrix-Signature: sha256=<HMAC of the body>`.

### Incoming webhooks (Slack-compatible)

**Settings → Integrations → Incoming webhooks** creates a secret URL per channel:

```bash
curl -X POST -H 'Content-Type: application/json' -d '{"text":"Hello from a script"}' \
  https://api.example.com/api/v2/integrations/hooks/<id>/<token>
```

It accepts Slack's `text`, `username`, `attachments` and `blocks` text and answers `ok`. Messages
come from the **Incoming webhook** bot (or the `username` you send), labelled as not end-to-end
encrypted: they were written outside Oruinwan. Rotate the URL if it leaks; pause or delete it any
time.

### AI providers

Workspace AI engines (Claude, ChatGPT, Gemini, Grok, or a local LLM by base URL) are configured
under AI settings; they are separate from these connectors.

## 6. Tests

```bash
cd server && npx jest src/features/integrations
cd client && npx vitest run src/__tests__/integrationConnectors.test.jsx src/__tests__/integrationChatConnectors.test.jsx
```

The suites mock every provider API (axios), Mongo and the identity store: connectors
(`connectors.test.js`), routes / applying results / bridge / incoming webhooks
(`connectorRoutes.test.js`), and the GitHub, Jira and Zoom suites.
