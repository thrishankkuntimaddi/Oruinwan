'use strict';

/**
 * Oruinwan AI as its own process.
 *
 *   AI_STANDALONE=1 AI_SERVICE_TOKEN=… node ai/server.js
 *
 * Plain Node http (no framework). The API server is the only caller; it uses
 * server/src/features/ai/ai.remote.js. Every request needs
 * `Authorization: Bearer <AI_SERVICE_TOKEN>`.
 *
 *   GET  /health                   { ok, intents, provider }
 *   POST /v1/run/:intent           { payload, context, stream? } -> agent result (JSON)
 *                                  chat + stream:true -> text/event-stream:
 *                                    event: token  {"t":"…"}
 *                                    event: tool   {"name","status":"running"|"done"|"failed"}
 *                                    event: done   { …full agent result }
 *                                    event: error  {"message","code"}
 *   POST /v1/clear-memory          { userId, workspaceId }
 *
 * Tool actions are proxied back to the API (service/actionsProxy.js). The
 * conversation memory is in-process (ai/memory); one AI process at a time
 * keeps it consistent, a Redis store would be the next step for several.
 */

const http = require('http');
const crypto = require('crypto');
const logger = require('./utils/logger');
const gateway = require('./api/ai.gateway');
const { createProvider } = require('./providers');
const { createActionsProxy } = require('./service/actionsProxy');

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const PING_MS = 15_000;

function tokenMatches(header, token) {
  if (!token || typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7));
  const want = Buffer.from(token);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { reject(Object.assign(new Error('Body too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

/** The error shape the API's controller already understands ({ message, code, status }). */
function errorBody(err) {
  return { message: err?.message || 'AI request failed', code: err?.code || 'AI_FAILED', status: err?.status || null };
}

/**
 * Rebuild the run context from the wire. `providerSpec` (a per-workspace
 * provider chosen by the API) becomes a provider instance; callbacks and the
 * abort signal are attached by the caller.
 */
function contextFromWire(context = {}) {
  const { providerSpec, ...rest } = context;
  const ctx = { ...rest };
  if (providerSpec && providerSpec.name) {
    ctx.provider = createProvider(providerSpec.name, {
      apiKey: providerSpec.apiKey || undefined,
      baseUrl: providerSpec.baseUrl || undefined,
      defaultModels: providerSpec.defaultModels || undefined,
    });
  }
  return ctx;
}

/**
 * @param {object} [opts]
 * @param {object} [opts.orchestrator]  injected for tests (run / listIntents / clearMemory / provider)
 * @param {string} [opts.token]
 */
function createAIServer({ orchestrator, token = process.env.AI_SERVICE_TOKEN, log = logger } = {}) {
  const orch = () => orchestrator || gateway.getOrchestrator();

  async function handle(req, res) {
    const url = new URL(req.url, 'http://ai');
    if (!tokenMatches(req.headers.authorization, token)) return sendJson(res, 401, { message: 'Unauthorized', code: 'AI_UNAUTHORIZED' });

    if (req.method === 'GET' && url.pathname === '/health') {
      const o = orch();
      return sendJson(res, 200, {
        ok: true,
        service: 'oruinwan-ai',
        intents: o.listIntents(),
        provider: { name: o.provider?.name || null, configured: !!o.provider?.isConfigured },
        uptime: process.uptime(),
      });
    }

    if (req.method === 'POST' && url.pathname === '/v1/clear-memory') {
      const body = await readJson(req);
      orch().clearMemory({ userId: body.userId, workspaceId: body.workspaceId });
      return sendJson(res, 200, { ok: true });
    }

    const run = url.pathname.match(/^\/v1\/run\/([a-z_]+)$/);
    if (req.method === 'POST' && run) {
      const intent = run[1];
      const body = await readJson(req);
      const payload = body.payload || {};
      const ctx = contextFromWire(body.context);
      if (body.stream === true && intent === 'chat') return streamChat(req, res, payload, ctx);
      const result = await orch().run(intent, payload, ctx);
      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, { message: 'Not found', code: 'AI_NOT_FOUND' });
  }

  async function streamChat(req, res, payload, ctx) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    const abort = new AbortController();
    let closed = false;
    // The API drops this connection when the browser does; stop generating.
    req.on('close', () => { closed = true; if (!res.writableEnded) abort.abort(); });
    const send = (event, data) => { if (!closed && !res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
    const ping = setInterval(() => { if (!closed) res.write(': ping\n\n'); }, PING_MS);
    try {
      const result = await orch().run('chat', payload, {
        ...ctx,
        signal: abort.signal,
        onToken: (t) => send('token', { t }),
        onEvent: (e) => {
          if (e.type === 'tool') send('tool', { name: e.name, status: 'running' });
          else if (e.type === 'tool_result') send('tool', { name: e.name, status: e.ok ? 'done' : 'failed' });
        },
      });
      send('done', result);
    } catch (err) {
      if (err?.code !== 'AI_ABORTED' && !abort.signal.aborted) send('error', errorBody(err));
    } finally {
      clearInterval(ping);
      if (!res.writableEnded) res.end();
    }
  }

  return http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (res.headersSent) { if (!res.writableEnded) res.end(); return; }
      const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500;
      if (status >= 500) log.error('[AI service] request failed:', err?.message || err);
      sendJson(res, status, errorBody(err));
    });
  });
}

function main() {
  const token = process.env.AI_SERVICE_TOKEN;
  if (!token) { log('AI_SERVICE_TOKEN is required'); process.exit(1); }
  if (process.env.AI_STANDALONE !== '1') logger.warn('[AI service] AI_STANDALONE=1 is recommended when running ai/server.js on its own');
  gateway.configure({ actions: createActionsProxy() });
  const server = createAIServer({ token });
  const port = Number(process.env.AI_PORT) || 8090;
  server.listen(port, () => {
    const o = gateway.getOrchestrator();
    logger.info(`[AI service] listening on :${port} — provider ${o.provider.name}, tools ${o.tools.length ? 'via ' + process.env.API_INTERNAL_URL : 'off (set API_INTERNAL_URL)'}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  function log(msg) { logger.error(`[AI service] ${msg}`); }
}

if (require.main === module) main();

module.exports = { createAIServer, contextFromWire, tokenMatches };
