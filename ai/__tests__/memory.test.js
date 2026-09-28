const { Orchestrator } = require('../orchestrator');
const { MockProvider } = require('../providers');

const quiet = { debug() {}, info() {}, warn() {}, error() {} };

describe('Personal memory in the chat agent', () => {
  test('saved memories are added to the system instruction', async () => {
    const provider = new MockProvider(() => 'ok');
    const orchestrator = new Orchestrator({ provider, logger: quiet });
    await orchestrator.run('chat', { message: 'draft my standup' }, { userId: 'u1', memories: ['Leads the design team', 'Prefers short answers'] });
    const call = provider.calls.find((c) => c.kind === 'chat');
    expect(call.systemInstruction).toContain('- Leads the design team');
    expect(call.systemInstruction).toContain('- Prefers short answers');
  });

  test('no memory block when there are none', async () => {
    const provider = new MockProvider(() => 'ok');
    const orchestrator = new Orchestrator({ provider, logger: quiet });
    await orchestrator.run('chat', { message: 'hi' }, { userId: 'u1' });
    expect(provider.calls[0].systemInstruction).not.toContain('What you know about this user');
  });

  test('"remember that…" offers tools and passes the shared flag to them', async () => {
    const rememberAboutUser = jest.fn(async (_args, ctx) => (ctx.shared ? { success: false } : { success: true }));
    const provider = new MockProvider(({ kind }) => (kind !== 'chat' ? '' : {
      functionCalls: [{ name: 'remember_about_user', args: { fact: 'Timezone is IST' } }],
      next: 'Got it.',
    }));
    const orchestrator = new Orchestrator({ provider, actions: { rememberAboutUser }, logger: quiet });

    await orchestrator.run('chat', { message: 'remember that my timezone is IST' }, { userId: 'u1' });
    expect(rememberAboutUser).toHaveBeenLastCalledWith({ fact: 'Timezone is IST' }, expect.objectContaining({ userId: 'u1', shared: false }));

    await orchestrator.run('chat', { message: 'remember that my timezone is IST' }, { userId: 'u1', shared: true });
    expect(rememberAboutUser).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ shared: true }));
  });
});

describe('Memory command fallback', () => {
  const ChatAgent = require('../agents/chat.agent');

  test('toFact rewrites first-person statements as facts about the user', () => {
    expect(ChatAgent.toFact('I prefer short answers')).toBe('Prefers short answers');
    expect(ChatAgent.toFact('I am the design lead')).toBe('Is the design lead');
    expect(ChatAgent.toFact('my timezone is IST')).toBe('Timezone is IST');
  });

  test('"remember that…" is saved even when the model ignores the tool', async () => {
    const rememberAboutUser = jest.fn(async ({ fact }) => ({ success: true, remembered: fact, scope: 'everywhere' }));
    const provider = new MockProvider(() => 'Sure!');
    const orchestrator = new Orchestrator({ provider, actions: { rememberAboutUser }, logger: quiet });
    const tokens = [];
    const res = await orchestrator.run('chat', { message: 'Remember that I prefer short answers.' }, { userId: 'u1', onToken: (t) => tokens.push(t) });
    expect(rememberAboutUser).toHaveBeenCalledWith({ fact: 'Prefers short answers' }, expect.anything());
    expect(res.actionsExecuted.map((a) => a.function)).toEqual(['remember_about_user']);
    expect(res.text).toContain('Saved to memory: "Prefers short answers"');
    expect(tokens.join('')).toBe(res.text);
  });

  test('"forget …" deletes matching memories when the model does not', async () => {
    const forgetAboutUser = jest.fn(async () => ({ success: true, forgotten: ['Prefers short answers'], count: 1 }));
    const provider = new MockProvider(() => 'Okay.');
    const orchestrator = new Orchestrator({ provider, actions: { forgetAboutUser }, logger: quiet });
    const res = await orchestrator.run('chat', { message: 'Forget that I prefer short answers' }, { userId: 'u1' });
    expect(forgetAboutUser).toHaveBeenCalledWith({ about: 'I prefer short answers' }, expect.anything());
    expect(res.text).toContain('Forgotten: Prefers short answers.');
  });

  test('no fallback when the model already used the tool', async () => {
    const rememberAboutUser = jest.fn(async () => ({ success: true, remembered: 'x', scope: 'everywhere' }));
    const provider = new MockProvider(({ kind }) => (kind !== 'chat' ? '' : { functionCalls: [{ name: 'remember_about_user', args: { fact: 'Likes tea' } }], next: 'Noted.' }));
    const orchestrator = new Orchestrator({ provider, actions: { rememberAboutUser }, logger: quiet });
    await orchestrator.run('chat', { message: 'remember that I like tea' }, { userId: 'u1' });
    expect(rememberAboutUser).toHaveBeenCalledTimes(1);
  });
});
