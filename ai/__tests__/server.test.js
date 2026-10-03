'use strict';

const http = require('http');
const { createAIServer, contextFromWire, tokenMatches } = require('../server');
const { createActionsProxy, plainCtx } = require('../service/actionsProxy');

const TOKEN = 'test-token';

function stubOrchestrator(overrides = {}) {
  return {
    provider: { name: 'mock', isConfigured: true },
    listIntents: () => ['chat', 'summarize'],
    clearMemory: jest.fn(),
    run: jest.fn(async (intent, payload, ctx) => {
      if (intent === 'chat' && ctx.onToken) {
        ctx.onToken('Hel');
        ctx.onEvent({ type: 'tool', name: 'create_task' });
        ctx.onEvent({ type: 'tool_result', name: 'create_task', ok: true });
        ctx.onToken('lo');
        return { text: 'Hello', actionsExecuted: [{ function: 'create_task' }], event: { payload: { provider: 'mock' } } };
      }
      if (intent === 'summarize') return { summary: `sum:${payload.text}`, event: { payload: { provider: 'mock', model: 'mock' } } };
      throw Object.assign(new Error('engine down'), { code: 'AI_ENGINE_UNAVAILABLE' });
    }),
    ...overrides,
  };
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, () => resolve(`http://127.0.0.1:${server.address().port}`)));
}

async function post(url, path, body, headers = {}) {
  const res = await fetch(`${url}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return res;
}

describe('ai/server.js', () => {
  let server, url, orch;
  beforeEach(async () => {
    orch = stubOrchestrator();
    server = createAIServer({ orchestrator: orch, token: TOKEN, log: { error() {} } });
    url = await listen(server);
  });
  afterEach(() => new Promise((r) => server.close(r)));

  test('rejects requests without the service token', async () => {
    const res = await fetch(`${url}/health`);
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('AI_UNAUTHORIZED');
    const bad = await post(url, '/v1/run/summarize', {}, { Authorization: 'Bearer nope' });
    expect(bad.status).toBe(401);
  });

  test('health reports intents and provider', async () => {
    const res = await fetch(`${url}/health`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.intents).toEqual(['chat', 'summarize']);
    expect(body.provider).toEqual({ name: 'mock', configured: true });
  });

  test('runs a non-stream intent and returns the agent result as JSON', async () => {
    const res = await post(url, '/v1/run/summarize', { payload: { text: 'abc' }, context: { userId: 'u1', workspaceId: 'w1' } }, { Authorization: `Bearer ${TOKEN}` });
    expect(res.status).toBe(200);
    expect((await res.json()).summary).toBe('sum:abc');
    expect(orch.run).toHaveBeenCalledWith('summarize', { text: 'abc' }, expect.objectContaining({ userId: 'u1', workspaceId: 'w1' }));
  });

  test('maps agent failures to the { message, code } error shape', async () => {
    const res = await post(url, '/v1/run/translate', { payload: {} }, { Authorization: `Bearer ${TOKEN}` });
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ code: 'AI_ENGINE_UNAVAILABLE', message: 'engine down' });
  });

  test('streams chat as SSE token/tool/done frames', async () => {
    const res = await post(url, '/v1/run/chat', { stream: true, payload: { message: 'hi' }, context: { userId: 'u1' } }, { Authorization: `Bearer ${TOKEN}` });
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    const text = await res.text();
    expect(text).toBe([
      'event: token\ndata: {"t":"Hel"}\n\n',
      'event: tool\ndata: {"name":"create_task","status":"running"}\n\n',
      'event: tool\ndata: {"name":"create_task","status":"done"}\n\n',
      'event: token\ndata: {"t":"lo"}\n\n',
      'event: done\ndata: {"text":"Hello","actionsExecuted":[{"function":"create_task"}],"event":{"payload":{"provider":"mock"}}}\n\n',
    ].join(''));
  });

  test('clear-memory forwards to the orchestrator', async () => {
    const res = await post(url, '/v1/clear-memory', { userId: 'u1', workspaceId: 'w1' }, { Authorization: `Bearer ${TOKEN}` });
    expect(res.status).toBe(200);
    expect(orch.clearMemory).toHaveBeenCalledWith({ userId: 'u1', workspaceId: 'w1' });
  });

  test('providerSpec on the wire becomes a provider instance', () => {
    const ctx = contextFromWire({ userId: 'u', providerSpec: { name: 'local_llm', baseUrl: 'http://engine/v1', apiKey: 'k', defaultModels: { chat: 'm', fast: 'm' } } });
    expect(ctx.providerSpec).toBeUndefined();
    expect(ctx.provider.name).toBe('local_llm');
    expect(ctx.provider.baseUrl).toBe('http://engine/v1');
    expect(ctx.provider.models.chat).toBe('m');
    expect(tokenMatches('Bearer abc', 'abc')).toBe(true);
    expect(tokenMatches('Bearer abcd', 'abc')).toBe(false);
  });
});

describe('actions proxy', () => {
  let api, apiUrl, received;
  beforeEach(async () => {
    received = [];
    api = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        received.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
        if (req.url.endsWith('/unknownAction')) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Unknown action' })); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result: { success: true, taskId: 't1' } }));
      });
    });
    apiUrl = await listen(api);
  });
  afterEach(() => new Promise((r) => api.close(r)));

  test('forwards args and a plain ctx to the internal endpoint with the token', async () => {
    const actions = createActionsProxy({ apiUrl, token: 'svc' });
    expect(typeof actions.createTaskForUser).toBe('function');
    expect(typeof actions.searchWorkspace).toBe('function');
    const out = await actions.createTaskForUser({ title: 'Ship' }, { userId: 'u1', workspaceId: 'w1', req: { secret: 1 }, io: {}, provider: {} });
    expect(out).toEqual({ success: true, taskId: 't1' });
    expect(received[0].url).toBe('/api/internal/ai-actions/createTaskForUser');
    expect(received[0].auth).toBe('Bearer svc');
    expect(received[0].body).toEqual({ args: { title: 'Ship' }, ctx: { userId: 'u1', workspaceId: 'w1' } });
  });

  test('a failed call becomes a tool failure, not a thrown error', async () => {
    const actions = createActionsProxy({ apiUrl: 'http://127.0.0.1:1', token: 'svc', timeoutMs: 500 });
    const out = await actions.listMyTasks({}, { userId: 'u1' });
    expect(out.success).toBe(false);
    expect(out.error).toMatch(/unavailable/);
    expect(plainCtx({ userId: 7, workspaceId: null })).toEqual({ userId: '7', workspaceId: null });
  });

  test('no API configured means no tools', () => {
    expect(createActionsProxy({ apiUrl: '', token: '' })).toEqual({});
  });
});
