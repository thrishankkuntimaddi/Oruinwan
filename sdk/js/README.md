# @chttrix/sdk

JavaScript client for the Chttrix API. Zero dependencies, works in Node 18+ and browsers.

```bash
npm install @chttrix/sdk            # from this repo: npm install ./sdk/js
npm install socket.io-client        # optional, for realtime
```

## Server-to-server (API key)

Create a key in the Developer Portal (`/workspace/:id/developer`). Keys are scoped to one workspace.

```js
const { ChttrixSDK } = require('@chttrix/sdk');

const chttrix = new ChttrixSDK({ baseUrl: 'https://api.example.com', apiKey: 'chx_...' });

const { tasks } = await chttrix.tasks.list({ status: 'todo', limit: 20 });
await chttrix.tasks.create({ title: 'Rotate credentials', priority: 'high' });   // needs tasks:write
const { messages } = await chttrix.messages.list({ channelId, limit: 50 });
const { users } = await chttrix.users.list();
```

Public endpoints are rate limited to 100 requests per minute per key. GET requests are retried on 429 and 5xx with backoff.

## On behalf of a user (JWT)

```js
const chttrix = new ChttrixSDK({ baseUrl, platform: 'sdk' });
await chttrix.auth.login('me@example.com', 'secret');   // stores accessToken (+ refreshToken when issued)

await chttrix.webhooks.subscribe({ workspaceId, url: 'https://hooks.example.com/chttrix', events: ['task.created', 'message.sent'] });
const { text } = await chttrix.ai.chat({ message: 'Summarise #general today', workspaceId });
```

Access tokens last 15 minutes. If the server issued a refresh token, a 401 triggers one automatic refresh and retry. In browsers the refresh cookie is used instead.

## Realtime

```js
const { io } = require('socket.io-client');
const socket = chttrix.realtime.connect({ io });
chttrix.realtime.joinWorkspace(workspaceId);
await chttrix.realtime.joinChannel(channelId);
chttrix.realtime.on('new-message', (msg) => console.log(msg));
```

## Errors

Every failure throws `ChttrixError` with `status`, `code` (when the server sends one), and `response` (parsed body).

## Raw requests

```js
await chttrix.request('/api/v2/tasks', { params: { workspaceId }, auth: 'bearer' });
```
