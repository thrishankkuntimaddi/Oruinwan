const { OruinwanSDK, OruinwanError } = require('../js/oruinwan-sdk');

function mockFetch(routes) {
  const calls = [];
  const fetchImpl = jest.fn(async (url, init) => {
    calls.push({ url, init });
    const handler = routes.find((r) => (typeof r.match === 'string' ? url.includes(r.match) : r.match.test(url)));
    const out = handler ? await handler.respond(url, init, calls) : { status: 404, body: { message: 'nope' } };
    const body = out.body;
    return {
      ok: out.status >= 200 && out.status < 300,
      status: out.status,
      statusText: 'x',
      headers: { get: (k) => (out.headers && out.headers[k.toLowerCase()]) || (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  });
  return { fetchImpl, calls };
}

describe('OruinwanSDK', () => {
  test('uses X-Api-Key for public resources and builds query strings', async () => {
    const { fetchImpl, calls } = mockFetch([{ match: '/api/public/tasks', respond: () => ({ status: 200, body: { tasks: [], count: 0 } }) }]);
    const sdk = new OruinwanSDK({ baseUrl: 'https://api.test/', apiKey: 'chx_1', fetch: fetchImpl });
    const out = await sdk.tasks.list({ status: 'todo', limit: 5, skip: undefined });
    expect(out.count).toBe(0);
    expect(calls[0].url).toBe('https://api.test/api/public/tasks?status=todo&limit=5');
    expect(calls[0].init.headers['X-Api-Key']).toBe('chx_1');
    expect(calls[0].init.headers.Authorization).toBeUndefined();
  });

  test('throws OruinwanError with status and body on failure', async () => {
    const { fetchImpl } = mockFetch([{ match: '/api/public/tasks', respond: () => ({ status: 403, body: { error: 'API key does not have tasks:write permission' } }) }]);
    const sdk = new OruinwanSDK({ baseUrl: 'https://api.test', apiKey: 'k', fetch: fetchImpl });
    await expect(sdk.tasks.create({ title: 'x' })).rejects.toMatchObject({ name: 'OruinwanError', status: 403 });
  });

  test('login stores tokens, bearer calls use them, and 401 triggers one refresh + retry', async () => {
    let meCalls = 0;
    const { fetchImpl, calls } = mockFetch([
      { match: '/api/auth/login', respond: () => ({ status: 200, body: { accessToken: 'a1', refreshToken: 'r1', user: { id: 'u' } } }) },
      { match: '/api/auth/refresh', respond: (_u, init) => ({ status: 200, body: { accessToken: 'a2', refreshToken: JSON.parse(init.body).refreshToken + '-rot' } }) },
      { match: '/api/auth/me', respond: (_u, init) => { meCalls += 1; return init.headers.Authorization === 'Bearer a2' ? { status: 200, body: { _id: 'u' } } : { status: 401, body: { message: 'expired' } }; } },
    ]);
    const onTokens = jest.fn();
    const sdk = new OruinwanSDK({ baseUrl: 'https://api.test', fetch: fetchImpl, platform: 'ios', onTokens });
    await sdk.auth.login('e', 'p');
    expect(sdk.accessToken).toBe('a1');
    expect(calls[0].init.headers['x-client-platform']).toBe('ios');

    const me = await sdk.auth.me();
    expect(me._id).toBe('u');
    expect(meCalls).toBe(2);
    expect(sdk.accessToken).toBe('a2');
    expect(sdk.refreshToken).toBe('r1-rot');
    expect(onTokens).toHaveBeenLastCalledWith({ accessToken: 'a2', refreshToken: 'r1-rot' });
  });

  test('concurrent refreshes are deduplicated', async () => {
    let refreshes = 0;
    const { fetchImpl } = mockFetch([{ match: '/api/auth/refresh', respond: async () => { refreshes += 1; await new Promise((r) => setTimeout(r, 5)); return { status: 200, body: { accessToken: 'n' } }; } }]);
    const sdk = new OruinwanSDK({ baseUrl: 'https://api.test', fetch: fetchImpl, refreshToken: 'r' });
    await Promise.all([sdk.auth.refresh(), sdk.auth.refresh(), sdk.auth.refresh()]);
    expect(refreshes).toBe(1);
  });

  test('retries GET on 429 honoring retry-after, never retries POST', async () => {
    let gets = 0; let posts = 0;
    const { fetchImpl } = mockFetch([
      { match: /public\/files/, respond: () => { gets += 1; return gets < 2 ? { status: 429, body: { error: 'slow down' }, headers: { 'retry-after': '0' } } : { status: 200, body: { files: [] } }; } },
      { match: /public\/tasks/, respond: () => { posts += 1; return { status: 503, body: { error: 'down' } }; } },
    ]);
    const sdk = new OruinwanSDK({ baseUrl: 'https://api.test', apiKey: 'k', fetch: fetchImpl, retries: 2 });
    await expect(sdk.files.list()).resolves.toEqual({ files: [] });
    expect(gets).toBe(2);
    await expect(sdk.tasks.create({ title: 't' })).rejects.toBeInstanceOf(OruinwanError);
    expect(posts).toBe(1);
  });

  test('webhooks.subscribe sends one request per event with the server field name', async () => {
    const { fetchImpl, calls } = mockFetch([{ match: '/api/v2/integrations/webhooks', respond: (_u, init) => ({ status: 201, body: { webhook: { _id: 'w', event: JSON.parse(init.body).event } } }) }]);
    const sdk = new OruinwanSDK({ baseUrl: 'https://api.test', accessToken: 't', fetch: fetchImpl });
    const out = await sdk.webhooks.subscribe({ workspaceId: 'ws', url: 'https://h.test', events: ['a.b', 'c.d'] });
    expect(out.map((w) => w.event)).toEqual(['a.b', 'c.d']);
    expect(JSON.parse(calls[0].init.body)).toEqual({ workspaceId: 'ws', url: 'https://h.test', event: 'a.b' });
    expect(calls[0].init.headers.Authorization).toBe('Bearer t');
  });

  test('realtime requires io and a token, then wires the socket', async () => {
    const sdk = new OruinwanSDK({ baseUrl: 'https://api.test', fetch: jest.fn() });
    expect(() => sdk.realtime.connect()).toThrow(/io\(\)/);
    sdk.auth.setAccessToken('tok');
    const fakeSocket = { auth: {}, on: jest.fn(), off: jest.fn(), emit: jest.fn((e, p, ack) => ack && ack({ success: true })), removeAllListeners: jest.fn(), disconnect: jest.fn() };
    const io = jest.fn(() => fakeSocket);
    const s = sdk.realtime.connect({ io });
    expect(io).toHaveBeenCalledWith('https://api.test', expect.objectContaining({ auth: { token: 'tok' } }));
    expect(s).toBe(fakeSocket);
    await expect(sdk.realtime.joinChannel('c1')).resolves.toEqual({ success: true });
    sdk.auth.setAccessToken('tok2');
    expect(fakeSocket.auth.token).toBe('tok2');
    sdk.realtime.disconnect();
    expect(fakeSocket.disconnect).toHaveBeenCalled();
    expect(sdk.realtime.socket).toBeNull();
  });
});

describe('deprecated Chttrix aliases', () => {
  const mod = require('../js/oruinwan-sdk');

  test('ChttrixSDK / ChttrixError point at the Oruinwan classes', () => {
    expect(mod.ChttrixSDK).toBe(OruinwanSDK);
    expect(mod.ChttrixError).toBe(OruinwanError);
    expect(mod.default).toBe(OruinwanSDK);
    const sdk = new mod.ChttrixSDK({ baseUrl: 'https://api.test', fetch: jest.fn() });
    expect(sdk).toBeInstanceOf(OruinwanSDK);
    expect(new mod.ChttrixError('x')).toBeInstanceOf(OruinwanError);
  });

  test('still sends the legacy X-Chttrix-SDK header', async () => {
    const { fetchImpl, calls } = mockFetch([{ match: '/api/public/tasks', respond: () => ({ status: 200, body: { tasks: [] } }) }]);
    const sdk = new mod.ChttrixSDK({ baseUrl: 'https://api.test', apiKey: 'k', fetch: fetchImpl });
    await sdk.tasks.list();
    expect(calls[0].init.headers['X-Chttrix-SDK']).toMatch(/^js\//);
  });

  test('browser build exposes both globals', () => {
    const fs = require('fs');
    const src = fs.readFileSync(require.resolve('../js/oruinwan-sdk'), 'utf8');
    const root = {};
    new Function('self', 'module', 'define', src)(root, undefined, undefined);
    expect(typeof root.OruinwanSDK).toBe('function');
    expect(root.ChttrixSDK).toBe(root.OruinwanSDK);
  });
});
