# Developer integrations: GitHub, Jira, Zoom

GitHub pull requests, pushes, checks and issues show up as cards in a workspace channel. The
cards link to Oruinwan tasks, and Oruinwan AI can review a PR's diff. Jira issues sync with tasks.
Zoom creates meetings from chat. The server code lives in `server/src/features/integrations/`.

## 1. Enable the feature flag

Everything under `/api/v2/integrations` (except outgoing webhooks and AI providers) sits behind the
`integrations` release flag. While the flag is off, the routes answer 404.

```bash
# server/.env
FEATURES_ENABLED=integrations        # or a list: billing,integrations / or "all"
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

## 5. Tests

```bash
cd server && npx jest src/features/integrations
```

The suite mocks the GitHub, Jira and Zoom APIs and the AI gateway.
