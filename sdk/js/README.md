# @oruinwan/sdk

JavaScript client for the Oruinwan API. Zero dependencies, works in Node 18+ and browsers.

```bash
npm install @oruinwan/sdk            # from this repo: npm install ./sdk/js
npm install socket.io-client        # optional, for realtime
```

## Server-to-server (API key)

Create a key in the Developer Portal (`/workspace/:id/developer`). Keys are scoped to one workspace.

```js
const { OruinwanSDK } = require('@oruinwan/sdk');

const oruinwan = new OruinwanSDK({ baseUrl: 'https://api.example.com', apiKey: 'chx_...' });

const { tasks } = await oruinwan.tasks.list({ status: 'todo', limit: 20 });
await oruinwan.tasks.create({ title: 'Rotate credentials', priority: 'high' });   // needs tasks:write
const { messages } = await oruinwan.messages.list({ channelId, limit: 50 });
const { users } = await oruinwan.users.list();
```

Public endpoints are rate limited to 100 requests per minute per key. GET requests are retried on 429 and 5xx with backoff.

## On behalf of a user (JWT)

```js
const oruinwan = new OruinwanSDK({ baseUrl, platform: 'sdk' });
await oruinwan.auth.login('me@example.com', 'secret');   // stores accessToken (+ refreshToken when issued)

await oruinwan.webhooks.subscribe({ workspaceId, url: 'https://hooks.example.com/oruinwan', events: ['task.created', 'message.sent'] });
const { text } = await oruinwan.ai.chat({ message: 'Summarise #general today', workspaceId });
```

Access tokens last 15 minutes. If the server issued a refresh token, a 401 triggers one automatic refresh and retry. In browsers the refresh cookie is used instead.

## Realtime

```js
const { io } = require('socket.io-client');
const socket = oruinwan.realtime.connect({ io });
oruinwan.realtime.joinWorkspace(workspaceId);
await oruinwan.realtime.joinChannel(channelId);
oruinwan.realtime.on('new-message', (msg) => console.log(msg));
```

## Errors

Every failure throws `OruinwanError` with `status`, `code` (when the server sends one), and `response` (parsed body).

## Raw requests

```js
await oruinwan.request('/api/v2/tasks', { params: { workspaceId }, auth: 'bearer' });
```

## Webhook and SDK headers

Requests carry an `X-Chttrix-SDK: js/<version>` header, and webhook deliveries use `X-Chttrix-*` headers. These names predate the rename to Oruinwan and are kept as-is because they are part of the wire contract with the server.

## Deprecated names

`ChttrixSDK`, `ChttrixError` (and the `ChttrixSDKOptions` type) are still exported as deprecated aliases of `OruinwanSDK`, `OruinwanError` and `OruinwanSDKOptions`. In the browser build both `window.OruinwanSDK` and `window.ChttrixSDK` are set. New code should use the Oruinwan names.
