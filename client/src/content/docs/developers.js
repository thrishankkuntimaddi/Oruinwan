// Developer platform: portal, API keys, public API, SDK, webhooks, bots, limits.
const TASKS_CURL = `curl https://YOUR-SERVER/api/public/tasks?status=todo&limit=20 \\
  -H "X-Api-Key: $ORUINWAN_API_KEY"`;

const TASKS_SDK = `const { OruinwanSDK } = require('@oruinwan/sdk');

const oruinwan = new OruinwanSDK({
  baseUrl: 'https://YOUR-SERVER',
  apiKey: process.env.ORUINWAN_API_KEY, // chx_…
});

const { tasks, count } = await oruinwan.tasks.list({ status: 'todo', limit: 20 });
console.log(count, tasks.map((t) => \`\${t.issueKey} \${t.title}\`));`;

const TASKS_PY = `import os, requests

r = requests.get(
    "https://YOUR-SERVER/api/public/tasks",
    headers={"X-Api-Key": os.environ["ORUINWAN_API_KEY"]},
    params={"status": "todo", "limit": 20},
    timeout=15,
)
r.raise_for_status()
for t in r.json()["tasks"]:
    print(t["issueKey"], t["title"])`;

const CREATE_CURL = `curl -X POST https://YOUR-SERVER/api/public/tasks \\
  -H "X-Api-Key: $ORUINWAN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Rotate staging credentials",
    "description": "Quarterly rotation",
    "priority": "high",
    "status": "todo",
    "dueDate": "2026-10-15"
  }'`;

const CREATE_SDK = `const { task } = await oruinwan.tasks.create({
  title: 'Rotate staging credentials',
  priority: 'high',        // lowest | low | medium | high | highest
  dueDate: '2026-10-15',
});
console.log(task.issueKey); // e.g. ENG-57`;

const VERIFY_NODE = `const crypto = require('crypto');
const express = require('express');
const app = express();

// Keep the raw body: the signature is computed over the exact bytes sent.
app.post('/oruinwan-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.ORUINWAN_WEBHOOK_SECRET)
    .update(req.body)                       // Buffer of the raw body
    .digest('hex');
  const got = req.get('X-Chttrix-Signature') || '';
  const ok = got.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  if (!ok) return res.status(401).send('bad signature');

  const { event, workspaceId, data, timestamp } = JSON.parse(req.body);
  console.log(event, workspaceId, data, timestamp);
  res.sendStatus(204);                      // answer 2xx quickly
});

app.listen(3001);`;

const VERIFY_PY = `import hmac, hashlib, os, json
from flask import Flask, request, abort

app = Flask(__name__)
SECRET = os.environ["ORUINWAN_WEBHOOK_SECRET"].encode()

@app.post("/oruinwan-webhook")
def hook():
    raw = request.get_data()  # raw bytes
    expected = "sha256=" + hmac.new(SECRET, raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, request.headers.get("X-Chttrix-Signature", "")):
        abort(401)
    payload = json.loads(raw)
    print(payload["event"], payload["data"])
    return "", 204`;

export default {
    id: 'developers',
    title: 'Developer platform',
    icon: 'Code2',
    blurb: 'API keys, the public REST API, the JavaScript SDK, signed webhooks and bots: build on top of your workspace.',
    pages: [
        {
            id: 'overview',
            title: 'Developer platform overview',
            summary: 'What you can build, where the Developer portal is, and which tool to use.',
            keywords: 'developer platform portal overview build plugin integration api sdk webhooks bots apps',
            blocks: [
                'Everything for developers lives in the **Developer portal** of each workspace: `/workspace/WORKSPACE_ID/developer` (Settings → Integrations → **Developer portal**). It has tabs for **API Keys**, **Webhooks**, **Bots**, **App Market** and **Docs**. Only workspace owners and admins can create keys, webhooks and bots.',
                { table: { caption: 'Developer tools', head: ['I want to…', 'Use'], rows: [
                    ['Read tasks, channels, files or people from a script or service', '[Public API](/docs/developers/public-api) with an [API key](/docs/developers/api-keys)'],
                    ['Create tasks from another system (CI, forms, monitoring)', '`POST /api/public/tasks` (scope `tasks:write`)'],
                    ['React when something happens in Oruinwan', '[Outgoing webhooks](/docs/developers/webhooks)'],
                    ['Use JavaScript instead of raw HTTP', 'The [SDK](/docs/developers/sdk) (`@oruinwan/sdk`)'],
                    ['Act as a signed-in user (AI, realtime, anything the app does)', 'The SDK with `auth.login` (a user access token)'],
                ] } },
                { figure: 'api-flow', caption: 'Your code calls /api/public with an API key; the key decides which workspace and what it may do.' },
                { h: 'Quick start' },
                { steps: [
                    'Open the Developer portal and create an API key. Copy it: it is shown only once.',
                    'Call the API with the `X-Api-Key` header.',
                    'Add a webhook if you want to be told about changes instead of polling.',
                ] },
                { codeTabs: [
                    { label: 'curl', lang: 'bash', code: TASKS_CURL },
                    { label: 'JavaScript SDK', lang: 'js', code: TASKS_SDK },
                    { label: 'Python', lang: 'python', code: TASKS_PY },
                ] },
            ],
        },
        {
            id: 'api-keys',
            title: 'API keys and scopes',
            summary: 'Workspace-scoped keys (chx_…), shown once, hashed at rest, with scopes and no expiry until revoked.',
            keywords: 'api key keys token chx scope scopes permissions revoke create hashed security',
            blocks: [
                { h: 'Create a key' },
                { steps: [
                    'In the Developer portal open **API Keys** and choose to create one.',
                    'Name it after what will use it (for example “CI task bot”).',
                    'Copy the key. It looks like `chx_` followed by 64 hex characters, and it will **not be shown again**.',
                ] },
                { list: [
                    'A key belongs to **one workspace**; you never pass a workspace id to the public API.',
                    'Oruinwan stores only a SHA-256 hash of the key and its first characters (for display), plus when it was last used and how often.',
                    'Keys do not expire. **Revoke** a key in the portal as soon as it is no longer needed or may have leaked.',
                    'Requests stop working if the workspace is deactivated.',
                ] },
                { h: 'Scopes' },
                { table: { caption: 'API key scopes', head: ['Scope', 'Allows'], rows: [
                    ['`messages:read`', '`GET /api/public/messages` (metadata only)'],
                    ['`channels:read`', '`GET /api/public/channels`'],
                    ['`tasks:read`', '`GET /api/public/tasks`'],
                    ['`tasks:write`', '`POST /api/public/tasks`'],
                    ['`files:read`', '`GET /api/public/files`'],
                    ['`users:read`', '`GET /api/public/users`'],
                    ['`webhooks:read`, `webhooks:write`', 'Accepted for future use; no public endpoint checks them yet.'],
                    ['`*`', 'Everything.'],
                ] } },
                'Keys created in the portal get the default scopes: `messages:read`, `tasks:read`, `tasks:write`, `files:read`, `users:read`, `channels:read`. To create a narrower key, call the key API with `permissions` using a signed-in admin session:',
                { code: `curl -X POST https://YOUR-SERVER/api/developer/api-keys \\
  -H "Authorization: Bearer $ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"workspaceId":"WORKSPACE_ID","name":"Read-only reporting","permissions":["tasks:read","channels:read"]}'

# → 201 { "key": { "name", "keyPrefix", "permissions", "createdAt" }, "rawKey": "chx_…", "message": "Store this key securely — it will not be shown again." }`, lang: 'bash', title: 'Create a key with chosen scopes' },
                { callout: 'warning', text: 'Treat keys like passwords: keep them in a secret manager or environment variable, never in client-side code or a repository.' },
            ],
        },
        {
            id: 'public-api',
            title: 'Public REST API reference',
            summary: 'Base URL /api/public, X-Api-Key auth, six endpoints, JSON in and out.',
            keywords: 'rest api reference endpoints public messages tasks files users channels json get post pagination limit',
            blocks: [
                { table: { caption: 'Basics', head: ['', ''], rows: [
                    ['Base URL', '`https://YOUR-SERVER/api/public`'],
                    ['Auth', 'Header `X-Api-Key: chx_…` (not a Bearer token)'],
                    ['Format', 'JSON request and response bodies'],
                    ['Paging', '`limit` (default 50, max 100); newest first. There is no cursor or offset.'],
                    ['Rate limit', '100 requests per minute per key'],
                ] } },
                { h: 'Endpoints' },
                { table: { caption: 'Endpoints', head: ['Method and path', 'Scope', 'Parameters', 'Returns'], rows: [
                    ['`GET /messages`', '`messages:read`', '`limit`, `channelId` (a public channel)', '`{ messages: [{ id, channelId, sender, type, parentId, replyCount, attachmentCount, isEncrypted, createdAt, editedAt }], count }`'],
                    ['`GET /tasks`', '`tasks:read`', '`limit`, `status` (`backlog`, `todo`, `in_progress`, `review`, `blocked`, `done`, `cancelled`)', '`{ tasks: [{ _id, title, description, status, priority, assignedTo, dueDate, createdAt, issueKey }], count }`'],
                    ['`POST /tasks`', '`tasks:write`', 'body below', '`201 { task }`'],
                    ['`GET /files`', '`files:read`', '`limit`', '`{ files: [{ _id, name, mimeType, size, url, folderId, createdAt }], count }`'],
                    ['`GET /users`', '`users:read`', '(none)', '`{ users: [{ id, username, firstName, lastName, avatarUrl, role }], count }`'],
                    ['`GET /channels`', '`channels:read`', '(none)', '`{ channels: [{ _id, name, description, topic, isDefault, membersCount, createdAt }], count }` (public, not archived)'],
                ] } },
                { callout: 'note', title: 'No message text, by design', text: 'Messages are end-to-end encrypted, so `/messages` returns metadata only: ids, sender, type, reply and attachment counts, timestamps. Private channels, system messages and deleted messages are excluded.' },
                { h: 'Create a task' },
                { table: { caption: 'POST /tasks body', head: ['Field', 'Type', 'Notes'], rows: [
                    ['`title`', 'string', 'Required, up to 500 characters.'],
                    ['`description`', 'string', 'Optional.'],
                    ['`priority`', 'string', '`lowest`, `low`, `medium` (default), `high`, `highest`.'],
                    ['`status`', 'string', 'Any status except `blocked`; default `todo`.'],
                    ['`dueDate`', 'date string', 'Optional, e.g. `2026-10-15`.'],
                    ['`assigneeIds`', 'string[]', 'Optional user ids (from `GET /users`).'],
                ] } },
                'The task is created on behalf of the person who created the API key, and fires the `task.created` webhook with `via: "api"`.',
                { codeTabs: [
                    { label: 'curl', lang: 'bash', code: CREATE_CURL },
                    { label: 'JavaScript SDK', lang: 'js', code: CREATE_SDK },
                ] },
                { h: 'Errors' },
                'Errors are always JSON: `{ "message": "…" }`.',
                { table: { caption: 'Error codes', head: ['Status', 'When'], rows: [
                    ['400', 'A bad parameter, e.g. `Invalid channelId` or an unknown `status`.'],
                    ['401', '`Missing X-Api-Key header`, or `Invalid or revoked API key`.'],
                    ['403', '`API key does not have the <scope> permission`.'],
                    ['404', 'The channel (or workspace) was not found.'],
                    ['429', '`Rate limit exceeded. Max 100 requests/minute per API key.`'],
                    ['500', 'Something went wrong on the server; retry later.'],
                ] } },
            ],
        },
        {
            id: 'sdk',
            title: 'JavaScript SDK',
            summary: '@oruinwan/sdk for Node 18+ and browsers: API-key calls, user sessions, webhooks, AI and realtime.',
            keywords: 'sdk javascript node npm oruinwan sdk client library typescript realtime socket',
            blocks: [
                { code: 'npm install @oruinwan/sdk        # from the repository: npm install ./sdk/js\nnpm install socket.io-client      # optional, for realtime', lang: 'bash', title: 'Install' },
                { h: 'With an API key (server to server)' },
                { code: TASKS_SDK + `

await oruinwan.tasks.create({ title: 'Rotate credentials', priority: 'high' }); // tasks:write
const { channels } = await oruinwan.channels.list();
const { messages } = await oruinwan.messages.list({ channelId: channels[0]._id, limit: 50 });
const { users } = await oruinwan.users.list();
const { files } = await oruinwan.files.list();`, lang: 'js' },
                { h: 'As a user (access token)' },
                'For anything beyond the public API, sign in as a user. Access tokens last 15 minutes; the SDK refreshes once automatically on a 401 when it has a refresh token.',
                { code: `const oruinwan = new OruinwanSDK({ baseUrl: 'https://YOUR-SERVER', platform: 'sdk' });
await oruinwan.auth.login('me@example.com', process.env.ORUINWAN_PASSWORD);

// Subscribe a webhook (one subscription per event; each returns its secret once)
await oruinwan.webhooks.subscribe({
  workspaceId, url: 'https://hooks.example.com/oruinwan', events: ['task.created', 'message.sent'],
});

// Ask Oruinwan AI
const { text } = await oruinwan.ai.chat({ message: 'Summarise my open tasks', workspaceId });`, lang: 'js' },
                { h: 'Realtime' },
                { code: `const { io } = require('socket.io-client');
oruinwan.realtime.connect({ io });
oruinwan.realtime.joinWorkspace(workspaceId);
await oruinwan.realtime.joinChannel(channelId);
oruinwan.realtime.on('new-message', (msg) => console.log(msg)); // encrypted payloads`, lang: 'js' },
                { h: 'Reference' },
                { table: { caption: 'SDK', head: ['Part', 'Details'], rows: [
                    ['Constructor', '`new OruinwanSDK({ baseUrl, apiKey, accessToken, refreshToken, fetch, timeoutMs = 15000, retries = 2, io, platform, onTokens })`'],
                    ['Public API', '`messages.list(params)`, `tasks.list(params)`, `tasks.create(data)`, `files.list()`, `users.list()`, `channels.list()`'],
                    ['Auth', '`auth.login(email, password)`, `auth.refresh()`, `auth.me()`, `auth.logout()`, `auth.setAccessToken(t)`, `auth.setApiKey(k)`'],
                    ['Webhooks', '`webhooks.list(workspaceId)`, `webhooks.subscribe({ workspaceId, url, events })`, `webhooks.unsubscribe(id)`'],
                    ['AI', '`ai.chat`, `ai.summarize`, `ai.smartReplies`, `ai.translate`, `ai.extractTasks`, `ai.noteAssist`, `ai.taskAssist`, `ai.usage`…'],
                    ['Raw', '`request(path, { method, body, params, auth: "auto" | "apiKey" | "bearer" | "none" })`'],
                    ['Errors', 'Every failure throws `OruinwanError` with `status`, `code` and `response`. GET requests retry on 408/425/429/5xx, honouring `Retry-After`.'],
                ] } },
                { callout: 'note', text: 'The SDK sends `X-Chttrix-SDK: js/1.0.0` with each request. Older code can keep using the `ChttrixSDK` alias.' },
            ],
        },
        {
            id: 'webhooks',
            title: 'Webhooks: payloads and signatures',
            summary: 'Signed JSON POSTs with X-Chttrix-Signature (HMAC-SHA256); how to verify them and how retries work.',
            keywords: 'webhook webhooks signature verify hmac sha256 x-chttrix-signature payload retries events secret',
            blocks: [
                { figure: 'webhook-flow' },
                { h: 'Subscribe' },
                'Create a webhook in the Developer portal (**Webhooks**) or **Settings → Integrations → Outgoing webhooks**, or with the API (`POST /api/v2/integrations/webhooks` as a signed-in admin, body `{ workspaceId, url, events }`). The **signing secret is returned only once**.',
                { h: 'The request Oruinwan sends' },
                { code: `POST /your/endpoint HTTP/1.1
Content-Type: application/json
X-Chttrix-Event: task.created
X-Chttrix-Signature: sha256=5d7f…c1
X-Chttrix-Delivery: 66f1…   (the webhook subscription id)

{
  "event": "task.created",
  "workspaceId": "66e0…",
  "data": { "taskId": "66f2…", "title": "Rotate credentials", "priority": "high", "createdBy": "66d9…", "via": "api" },
  "timestamp": "2026-09-28T10:15:02.114Z"
}`, lang: 'http', title: 'Example delivery' },
                { table: { caption: 'Event data', head: ['Event', '`data`'], rows: [
                    ['`task.created`', '`{ taskId, title, priority, createdBy }` (+ `via: "api"` from the public API)'],
                    ['`task.updated`, `task.completed`', '`{ taskId, title, status, updatedBy }`'],
                    ['`message.sent`', '`{ messageId, channelId, senderId, type, parentId, hasAttachments, createdAt }` (public channels only)'],
                    ['`integration.connected`', '`{ type, integrationId }`'],
                    ['`integration.disconnected`', '`{ type }`'],
                    ['`webhook.test`', '`{ webhookId, message, triggeredBy }`'],
                ] } },
                { h: 'Verify the signature' },
                '`X-Chttrix-Signature` is `sha256=` followed by the hex HMAC-SHA256 of the request body, keyed with your secret. Compute it over the **raw** body and compare in constant time:',
                { codeTabs: [
                    { label: 'Node (Express)', lang: 'js', code: VERIFY_NODE },
                    { label: 'Python (Flask)', lang: 'python', code: VERIFY_PY },
                ] },
                { h: 'Delivery and retries' },
                { list: [
                    'Each delivery waits up to **8 seconds** for your response. Answer `2xx` quickly and do slow work afterwards.',
                    'Failed deliveries are tried **3 times** in total, 1 and 3 seconds apart.',
                    'If every attempt fails, the workspace’s integration admins get a notification. The webhook shows its last status code and failure count.',
                    'Deliveries are not strictly ordered; use `timestamp`, and make your handler safe to run twice.',
                ] },
            ],
        },
        {
            id: 'bots',
            title: 'Bots',
            summary: 'Named bot identities with tokens and scopes; what they can and cannot do today.',
            keywords: 'bot bots token bot_ scopes message post test preview',
            blocks: [
                'In the Developer portal’s **Bots** tab an admin can create a bot with a name, description and scopes (`messages:read`, `messages:write`, `tasks:read`, `tasks:write`, or `*`). You get a token that starts with `bot_`; it is shown only once and stored only as a hash.',
                { list: [
                    'The **Test** button posts a message to a channel as “🤖 BotName: your text” (up to 4,000 characters). It is sent by the admin who pressed the button, encrypted with the channel key.',
                    'Deactivate a bot from the same tab.',
                ] },
                { callout: 'warning', title: 'Preview', text: 'Bot tokens are not accepted by any API endpoint yet, so a bot cannot post on its own. For automation today, use an [API key](/docs/developers/api-keys) with the public API and [webhooks](/docs/developers/webhooks).' },
            ],
        },
        {
            id: 'limits',
            title: 'Rate limits and good practice',
            summary: '100 requests a minute per key, standard RateLimit headers, and how to stay well within them.',
            keywords: 'rate limit limits 429 retry-after headers ratelimit throttle best practice',
            blocks: [
                { table: { caption: 'Limits', head: ['What', 'Limit'], rows: [
                    ['Public API', '100 requests per minute per API key (per IP when the header is missing). 429 when exceeded.'],
                    ['Page size', '`limit` up to 100.'],
                    ['Webhook delivery', '8-second timeout, 3 attempts.'],
                    ['AI (user sessions)', '40 requests per minute per person by default.'],
                    ['GitHub webhooks into Oruinwan', '600 per minute per workspace by default.'],
                ] } },
                'Responses carry the standard `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` and `RateLimit-Policy` headers.',
                { list: [
                    'Prefer webhooks to polling.',
                    'On 429, wait and retry with backoff (the SDK does this for GET requests).',
                    'Use one key per integration, with only the scopes it needs, so you can revoke it alone.',
                ] },
            ],
        },
    ],
};
