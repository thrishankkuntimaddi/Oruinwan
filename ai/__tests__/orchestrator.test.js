const { Orchestrator } = require('../orchestrator');
const { MockProvider } = require('../providers');
const { ConversationMemory } = require('../memory');
const gateway = require('../api/ai.gateway');

function build(handler, actions) {
  const provider = new MockProvider(handler);
  const memory = new ConversationMemory({ maxTurns: 6, ttlMs: 60_000, maxConversations: 10 });
  const orchestrator = new Orchestrator({ provider, memory, actions, logger: { debug() {}, info() {}, warn() {}, error() {} } });
  return { provider, memory, orchestrator };
}

describe('Orchestrator', () => {
  test('chat returns text, records memory, and emits an activity event', async () => {
    const { orchestrator, memory, provider } = build(({ message }) => `echo:${message}`);
    const ctx = { userId: 'u1' };

    const first = await orchestrator.run('chat', { message: 'hello', workspaceId: 'w1' }, ctx);
    expect(first.text).toBe('echo:hello');
    expect(first.event).toMatchObject({ type: 'ai', subtype: 'chat', actor: 'u1', workspaceId: 'w1' });

    await orchestrator.run('chat', { message: 'again', workspaceId: 'w1' }, ctx);
    // Second call was given the remembered history.
    const secondCall = provider.calls.filter((c) => c.kind === 'chat')[1];
    expect(secondCall.history).toEqual([
      { role: 'user', text: 'hello' },
      { role: 'model', text: 'echo:hello' },
    ]);
    expect(memory.get(ConversationMemory.key('u1', 'w1'))).toHaveLength(4);
  });

  test('chat executes every tool call and sends all results back', async () => {
    const createTaskForUser = jest.fn(async (args) => ({ success: true, id: 't-' + args.title }));
    const getCurrentWorkspace = jest.fn(async () => ({ id: 'w1', name: 'Eng' }));
    const { orchestrator, provider } = build(({ kind }) => {
      if (kind !== 'chat') return 'n/a';
      return {
        text: '',
        functionCalls: [
          { name: 'create_task', args: { title: 'Ship it' } },
          { name: 'get_current_workspace', args: {} },
          { name: 'unknown_tool', args: {} },
        ],
        next: (results) => ({ text: `done:${results.length}` }),
      };
    }, { createTaskForUser, getCurrentWorkspace });

    const out = await orchestrator.run('chat', { message: 'create a task' }, { userId: 'u1', workspaceId: 'w1' });
    expect(out.text).toBe('done:3');
    expect(createTaskForUser).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ship it', userId: 'u1', workspaceId: 'w1' }));
    expect(out.actionsExecuted).toHaveLength(3);
    expect(out.actionsExecuted[2].result).toEqual({ success: false, error: 'Unknown function: unknown_tool' });
    const toolRound = provider.calls.find((c) => c.kind === 'tool-results');
    expect(toolRound.toolResults.map((r) => r.name)).toEqual(['create_task', 'get_current_workspace', 'unknown_tool']);
  });

  test('chat folds system history entries into the system instruction and repairs alternation', async () => {
    const { orchestrator, provider } = build(() => 'ok');
    await orchestrator.run('chat', {
      message: 'hi',
      history: [
        { role: 'system', content: 'Reply in JSON' },
        { sender: 'ai', text: 'stray model turn first' },
        { sender: 'user', text: 'a' },
        { sender: 'user', text: 'b' },
        { sender: 'ai', text: 'c' },
      ],
    }, { userId: 'system' });
    const call = provider.calls[0];
    expect(call.systemInstruction).toContain('Reply in JSON');
    expect(call.history).toEqual([
      { role: 'user', text: 'a\nb' },
      { role: 'model', text: 'c' },
    ]);
  });

  test('tool rounds are capped', async () => {
    const { orchestrator, provider } = build(() => ({
      text: '',
      functionCalls: [{ name: 'get_current_workspace', args: {} }],
      next: () => ({ text: '', functionCalls: [{ name: 'get_current_workspace', args: {} }], next: () => ({ text: 'loop' }) }),
    }), { getCurrentWorkspace: async () => ({}) });
    const out = await orchestrator.run('chat', { message: 'x' }, { userId: 'u1' });
    expect(out.actionsExecuted.length).toBeLessThanOrEqual(4);
    expect(provider.calls.filter((c) => c.kind === 'tool-results').length).toBeLessThanOrEqual(4);
  });

  test('summarize and generate_task parse provider output', async () => {
    const { orchestrator } = build(({ prompt }) =>
      prompt.startsWith('Extract') ? '```json\n{"title":"Fix login","description":"bug","priority":"high","dueDate":"2026-10-01"}\n```' : 'A summary.');
    const s = await orchestrator.run('summarize', { text: 'long text' }, { userId: 'u1' });
    expect(s.summary).toBe('A summary.');
    const t = await orchestrator.run('generate_task', { context: 'login is broken, urgent' }, { userId: 'u1' });
    expect(t).toMatchObject({ title: 'Fix login', description: 'bug', priority: 'high', dueDate: '2026-10-01' });
  });

  test('generate_task falls back on malformed output', async () => {
    const { orchestrator } = build(() => 'not json at all');
    const t = await orchestrator.run('generate_task', { context: 'do the thing' }, { userId: 'u1' });
    expect(t).toMatchObject({ title: 'New Task', priority: 'medium' });
  });

  test('unknown intent throws and empty message is rejected', async () => {
    const { orchestrator } = build(() => 'x');
    await expect(orchestrator.run('nope', {}, {})).rejects.toThrow('No agent registered');
    await expect(orchestrator.run('chat', { message: '  ' }, { userId: 'u1' })).rejects.toThrow('message is required');
  });
});

describe('ConversationMemory', () => {
  test('bounds turns, expires, and caps conversations', () => {
    const m = new ConversationMemory({ maxTurns: 2, ttlMs: 50, maxConversations: 2 });
    m.append('a', [{ role: 'user', text: '1' }, { role: 'model', text: '2' }, { role: 'user', text: '3' }]);
    expect(m.get('a').map((t) => t.text)).toEqual(['2', '3']);
    m.append('b', { role: 'user', text: 'x' });
    m.append('c', { role: 'user', text: 'y' });
    expect(m.size).toBe(2);
    expect(m.get('a')).toEqual([]);
  });

  test('entries expire after ttl', async () => {
    const m = new ConversationMemory({ maxTurns: 5, ttlMs: 10, maxConversations: 5 });
    m.append('k', { role: 'user', text: 'hi' });
    await new Promise((r) => setTimeout(r, 20));
    expect(m.get('k')).toEqual([]);
  });
});

describe('gateway', () => {
  test('delegates to an injected orchestrator and clears memory', async () => {
    const { orchestrator, memory } = build(({ message }) => `g:${message}`);
    gateway.setOrchestrator(orchestrator);
    const out = await gateway.chat({ message: 'yo', workspaceId: 'w' }, { userId: 'u9' });
    expect(out.text).toBe('g:yo');
    expect(memory.size).toBe(1);
    gateway.clearMemory({ userId: 'u9', workspaceId: 'w' });
    expect(memory.size).toBe(0);
  });
});
