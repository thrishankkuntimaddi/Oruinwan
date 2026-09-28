const { Orchestrator } = require('../orchestrator');
const { MockProvider, OpenAIProvider } = require('../providers');
const { ConversationMemory } = require('../memory');

const quiet = { debug() {}, info() {}, warn() {}, error() {} };

/** Build a fetch Response whose body yields the given SSE text in small chunks. */
function sseResponse(lines, chunkSize = 7) {
  const text = lines.map((l) => `data: ${typeof l === 'string' ? l : JSON.stringify(l)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  async function* body() {
    for (let i = 0; i < bytes.length; i += chunkSize) yield bytes.slice(i, i + chunkSize);
  }
  return { ok: true, status: 200, body: body(), json: async () => ({}) };
}

const delta = (d) => ({ choices: [{ delta: d }] });

describe('OpenAI-compatible provider streaming', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('forwards text deltas and returns the full message', async () => {
    global.fetch = jest.fn(async (_url, init) => {
      expect(JSON.parse(init.body).stream).toBe(true);
      return sseResponse([delta({ role: 'assistant' }), delta({ content: 'Hel' }), delta({ content: 'lo ' }), delta({ content: 'there' }), '[DONE]']);
    });
    const provider = new OpenAIProvider({ name: 'local_llm', baseUrl: 'http://engine/v1' });
    const tokens = [];
    const reply = await provider.chat({ message: 'hi', onToken: (t) => tokens.push(t) });
    expect(tokens.join('')).toBe('Hello there');
    expect(reply.text).toBe('Hello there');
    expect(reply.functionCalls).toEqual([]);
  });

  test('reassembles tool calls that arrive in fragments', async () => {
    global.fetch = jest.fn(async () => sseResponse([
      delta({ tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name: 'create_task', arguments: '{"ti' } }] }),
      delta({ tool_calls: [{ index: 0, function: { arguments: 'tle":"Ship' } }] }),
      delta({ tool_calls: [{ index: 0, function: { arguments: ' it"}' } }] }),
      '[DONE]',
    ]));
    const provider = new OpenAIProvider({ name: 'local_llm', baseUrl: 'http://engine/v1' });
    const reply = await provider.chat({ message: 'make a task', tools: [{ name: 'create_task', description: 'x', parameters: {} }], onToken: () => {} });
    expect(reply.functionCalls).toEqual([{ name: 'create_task', args: { title: 'Ship it' } }]);
  });

  test('non-streaming requests are unchanged', async () => {
    global.fetch = jest.fn(async (_url, init) => {
      expect(JSON.parse(init.body).stream).toBeUndefined();
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'plain' } }] }) };
    });
    const provider = new OpenAIProvider({ name: 'local_llm', baseUrl: 'http://engine/v1' });
    expect(await provider.generateText({ prompt: 'x' })).toBe('plain');
  });

  test('an unreachable local engine reports AI_ENGINE_UNAVAILABLE', async () => {
    global.fetch = jest.fn(async () => { throw new TypeError('fetch failed'); });
    const provider = new OpenAIProvider({ name: 'local_llm', baseUrl: 'http://engine/v1' });
    await expect(provider.generateText({ prompt: 'x' })).rejects.toMatchObject({ code: 'AI_ENGINE_UNAVAILABLE' });
  });

  test('an aborted request reports AI_ABORTED', async () => {
    global.fetch = jest.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('The operation was aborted')));
    }));
    const provider = new OpenAIProvider({ name: 'local_llm', baseUrl: 'http://engine/v1' });
    const controller = new AbortController();
    const pending = provider.chat({ message: 'long answer', onToken: () => {}, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'AI_ABORTED' });
  });
});

describe('Chat agent streaming through the orchestrator', () => {
  function build(handler, actions) {
    const provider = new MockProvider(handler);
    const memory = new ConversationMemory({ maxTurns: 6, ttlMs: 60_000, maxConversations: 10 });
    return new Orchestrator({ provider, memory, actions, logger: quiet });
  }

  test('streams answer text via onToken', async () => {
    const orchestrator = build(() => 'Here is your summary of today');
    const tokens = [];
    const result = await orchestrator.run('chat', { message: 'summarize' }, { userId: 'u1', onToken: (t) => tokens.push(t) });
    expect(tokens.length).toBeGreaterThan(1);
    expect(tokens.join('')).toBe(result.text);
  });

  test('reports tool steps via onEvent and still streams the final answer', async () => {
    const createTaskForUser = jest.fn(async () => ({ success: true, id: 't1' }));
    const orchestrator = build(({ kind }) => (kind !== 'chat' ? '' : {
      text: '',
      functionCalls: [{ name: 'create_task', args: { title: 'Ship it' } }],
      next: 'Created the task "Ship it".',
    }), { createTaskForUser });
    const events = [];
    const tokens = [];
    const result = await orchestrator.run('chat', { message: 'add task ship it' }, {
      userId: 'u1', onToken: (t) => tokens.push(t), onEvent: (e) => events.push(e),
    });
    expect(events.map((e) => `${e.type}:${e.name}`)).toEqual(['tool:create_task', 'tool_result:create_task']);
    expect(events[1].ok).toBe(true);
    expect(tokens.join('')).toBe('Created the task "Ship it".');
    expect(result.actionsExecuted).toHaveLength(1);
  });

  test('providers without native streaming emit the final text once', async () => {
    const provider = new MockProvider(() => 'whole answer');
    provider.supportsStreaming = false;
    const orchestrator = new Orchestrator({ provider, logger: quiet });
    const tokens = [];
    await orchestrator.run('chat', { message: 'q' }, { userId: 'u1', onToken: (t) => tokens.push(t) });
    expect(tokens).toEqual(['whole answer']);
  });
});

describe('Tool gating for small local models', () => {
  const ChatAgent = require('../agents/chat.agent');

  test.each([
    ['give me a 3-item checklist for shipping a release', false],
    ['explain what a race condition is', false],
    ['review this code: function a(){}', false],
    ['summarize this conversation', false],
    ['create a task to write the rollback runbook', true],
    ['send a message to #general saying hi', true],
    ['what are my tasks this week', true],
    ['Which channels am I in?', true],
  ])('%s -> tools offered: %s', (message, expected) => {
    expect(ChatAgent.wantsTools(message)).toBe(expected);
  });

  test('tools are only sent to the provider when the request needs them', async () => {
    const provider = new MockProvider(() => 'ok');
    const orchestrator = new Orchestrator({ provider, actions: { createTaskForUser: jest.fn(async () => ({ success: true })) }, logger: quiet });
    await orchestrator.run('chat', { message: 'write a haiku about releases' }, { userId: 'u1' });
    await orchestrator.run('chat', { message: 'create a task to ship v2' }, { userId: 'u2' });
    const [plain, action] = provider.calls.filter((c) => c.kind === 'chat');
    expect(plain.tools).toBeUndefined();
    expect(action.tools.length).toBeGreaterThan(0);
  });
});

describe('Tool selection per request', () => {
  const ChatAgent = require('../agents/chat.agent');
  test.each([
    ['what are my tasks this week', 'list_my_tasks'],
    ['create a task to write the runbook', 'create_task'],
    ['send a message to #general saying hi', 'send_message_to_channel'],
    ['Search the workspace for billing', 'search_workspace'],
    ['remember that I prefer short answers', 'remember_about_user'],
    ['schedule a meeting with Maya tomorrow', 'schedule_meeting'],
  ])('%s includes %s', (message, tool) => {
    expect(ChatAgent.toolsFor(message).has(tool)).toBe(true);
  });
});

describe('Code review mode', () => {
  const ChatAgent = require('../agents/chat.agent');

  test('detects code review requests only when code is present', () => {
    expect(ChatAgent.isCodeReview('review this:\n```js\nfunction add(a,b){return a-b}\n```')).toBe(true);
    expect(ChatAgent.isCodeReview('what is wrong with\nconst x = await fetch(url)')).toBe(true);
    expect(ChatAgent.isCodeReview('review the pricing page copy')).toBe(false);
    expect(ChatAgent.isCodeReview('what is a closure?')).toBe(false);
  });

  test('reviews get the review guide and no tools', async () => {
    const provider = new MockProvider(() => '**Summary** ok');
    const orchestrator = new Orchestrator({ provider, actions: { createTaskForUser: jest.fn() }, logger: quiet });
    await orchestrator.run('chat', { message: 'please review and fix bugs:\n```js\nfunction add(a,b){return a-b}\n```' }, { userId: 'u1' });
    const call = provider.calls.find((c) => c.kind === 'chat');
    expect(call.systemInstruction).toContain('The user wants a code review');
    expect(call.tools).toBeUndefined();
  });
});
