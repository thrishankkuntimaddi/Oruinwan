'use strict';

const http = require('http');
const { createRemoteGateway, wireContext, readSse } = require('../ai.remote');

function listen(server) {
    return new Promise((resolve) => server.listen(0, () => resolve(`http://127.0.0.1:${server.address().port}`)));
}

describe('wireContext', () => {
    test('drops transport objects and functions, turns a provider into a spec', () => {
        const out = wireContext({
            userId: 'u1', workspaceId: 'w1', remember: false, shared: true, memories: ['a'], knowledge: [{ id: 1 }],
            req: {}, io: {}, signal: new AbortController().signal, onToken: () => {}, onEvent: () => {},
            provider: { name: 'openai', apiKey: 'sk', baseUrl: 'http://x/v1', models: { chat: 'gpt', fast: 'gpt' } },
        });
        expect(out).toEqual({
            userId: 'u1', workspaceId: 'w1', remember: false, shared: true, memories: ['a'], knowledge: [{ id: 1 }],
            providerSpec: { name: 'openai', apiKey: 'sk', baseUrl: 'http://x/v1', defaultModels: { chat: 'gpt', fast: 'gpt' } },
        });
    });
});

describe('remote gateway', () => {
    let stub, url, requests;
    beforeEach(async () => {
        requests = [];
        stub = http.createServer((req, res) => {
            let body = '';
            req.on('data', (c) => { body += c; });
            req.on('end', () => {
                const parsed = JSON.parse(body || '{}');
                requests.push({ url: req.url, auth: req.headers.authorization, body: parsed });
                if (req.url === '/v1/run/summarize') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ summary: 'short', event: { payload: { provider: 'mock', model: 'm', agent: 'summarize' } } }));
                }
                if (req.url === '/v1/run/translate') {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ message: 'engine offline', code: 'AI_ENGINE_UNAVAILABLE' }));
                }
                if (req.url === '/v1/run/chat' && parsed.stream) {
                    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
                    res.write(': ping\n\n');
                    res.write('event: token\ndata: {"t":"Hel"}\n\n');
                    res.write('event: tool\ndata: {"name":"create_task","status":"running"}\n\n');
                    res.write('event: tool\ndata: {"name":"create_task","status":"done"}\n\nevent: token\ndata: {"t":"lo"}\n\n');
                    res.write('event: done\ndata: {"text":"Hello","actionsExecuted":null,"event":{"payload":{"provider":"mock"}}}\n\n');
                    return res.end();
                }
                if (req.url === '/v1/clear-memory') { res.writeHead(200); return res.end('{"ok":true}'); }
                res.writeHead(404); res.end('{}');
            });
        });
        url = await listen(stub);
    });
    afterEach(() => new Promise((r) => stub.close(r)));

    test('non-stream run posts payload + wire context with the service token', async () => {
        const gw = createRemoteGateway({ baseUrl: url, token: 'svc' });
        const usage = jest.fn();
        gw.configure({ onUsage: usage });
        const out = await gw.summarize({ text: 'long' }, { userId: 'u1', workspaceId: 'w1', req: {}, io: {} });
        expect(out.summary).toBe('short');
        expect(requests[0].url).toBe('/v1/run/summarize');
        expect(requests[0].auth).toBe('Bearer svc');
        expect(requests[0].body).toEqual({ payload: { text: 'long' }, context: { userId: 'u1', workspaceId: 'w1' } });
        expect(usage).toHaveBeenCalledWith(expect.objectContaining({ intent: 'summarize', provider: 'mock', model: 'm', agent: 'summarize', userId: 'u1', ok: true }));
    });

    test('streaming chat replays SSE frames into onToken / onEvent and resolves with done', async () => {
        const gw = createRemoteGateway({ baseUrl: url, token: 'svc' });
        const tokens = [];
        const events = [];
        const out = await gw.chat({ message: 'hi' }, { userId: 'u1', onToken: (t) => tokens.push(t), onEvent: (e) => events.push(e) });
        expect(tokens).toEqual(['Hel', 'lo']);
        expect(events).toEqual([{ type: 'tool', name: 'create_task' }, { type: 'tool_result', name: 'create_task', ok: true }]);
        expect(out.text).toBe('Hello');
        expect(requests[0].body.stream).toBe(true);
        expect(requests[0].body.context.onToken).toBeUndefined();
    });

    test('the controller writes identical browser frames from the remote callbacks', async () => {
        const gw = createRemoteGateway({ baseUrl: url, token: 'svc' });
        const frames = [];
        const send = (event, data) => frames.push(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        await gw.chat({ message: 'hi' }, {
            userId: 'u1',
            onToken: (t) => send('token', { t }),
            onEvent: (e) => { if (e.type === 'tool') send('tool', { name: e.name, status: 'running' }); else if (e.type === 'tool_result') send('tool', { name: e.name, status: e.ok ? 'done' : 'failed' }); },
        });
        expect(frames).toEqual([
            'event: token\ndata: {"t":"Hel"}\n\n',
            'event: tool\ndata: {"name":"create_task","status":"running"}\n\n',
            'event: tool\ndata: {"name":"create_task","status":"done"}\n\n',
            'event: token\ndata: {"t":"lo"}\n\n',
        ]);
    });

    test('service errors keep their code so sendError maps them', async () => {
        const gw = createRemoteGateway({ baseUrl: url, token: 'svc' });
        const usage = jest.fn();
        gw.configure({ onUsage: usage });
        await expect(gw.translate({ text: 'x', targetLang: 'fr' }, { userId: 'u1' })).rejects.toMatchObject({ code: 'AI_ENGINE_UNAVAILABLE', message: 'engine offline' });
        expect(usage).toHaveBeenCalledWith(expect.objectContaining({ intent: 'translate', ok: false, error: 'engine offline' }));
        const down = createRemoteGateway({ baseUrl: 'http://127.0.0.1:1', token: 'svc' });
        await expect(down.summarize({ text: 'x' }, {})).rejects.toMatchObject({ code: 'AI_ENGINE_UNAVAILABLE' });
    });

    test('clearMemory calls the service and never throws', async () => {
        const gw = createRemoteGateway({ baseUrl: url, token: 'svc' });
        await gw.clearMemory({ userId: 'u1', workspaceId: 'w1' });
        expect(requests[0]).toMatchObject({ url: '/v1/clear-memory', body: { userId: 'u1', workspaceId: 'w1' } });
        await expect(createRemoteGateway({ baseUrl: 'http://127.0.0.1:1', token: 'svc' }).clearMemory({})).resolves.toBeUndefined();
    });

    test('readSse handles frames split across chunks and ignores comments', async () => {
        const chunks = ['event: tok', 'en\ndata: {"t":"a"}\n\n: ping\n\nevent: done\nda', 'ta: {"x":1}\n\n'].map((s) => Buffer.from(s));
        async function* body() { for (const c of chunks) yield c; }
        const frames = [];
        await readSse(body(), (f) => frames.push(f));
        expect(frames).toEqual([{ event: 'token', data: '{"t":"a"}' }, { event: 'done', data: '{"x":1}' }]);
    });
});

describe('gateway resolver', () => {
    const saved = process.env.AI_SERVICE_URL;
    afterEach(() => {
        if (saved === undefined) delete process.env.AI_SERVICE_URL; else process.env.AI_SERVICE_URL = saved;
        require('../ai.gatewayResolver')._reset();
    });

    test('in-process gateway without AI_SERVICE_URL, remote client with it', () => {
        const resolver = require('../ai.gatewayResolver');
        delete process.env.AI_SERVICE_URL;
        resolver._reset();
        expect(resolver.gateway().isRemote).toBeUndefined();
        expect(typeof resolver.gateway().chat).toBe('function');
        process.env.AI_SERVICE_URL = 'http://ai.internal:8090/';
        expect(resolver.gateway().isRemote).toBe(true);
        expect(resolver.gateway().baseUrl).toBe('http://ai.internal:8090');
        expect(typeof resolver.chat).toBe('function'); // delegated method
        expect(resolver.getOrchestrator().listIntents()).toContain('chat');
    });
});
