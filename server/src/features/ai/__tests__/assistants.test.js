'use strict';

const mockRecords = [];
jest.mock('../../integrations/ai-provider.model', () => ({
  find: jest.fn(() => ({ lean: async () => mockRecords.filter((r) => r.status === 'active') })),
  findOne: jest.fn((q) => ({
    lean: async () => mockRecords.find((r) => r.status === 'active' && (q.provider.$in || [q.provider]).includes(r.provider)) || null,
  })),
}));
jest.mock('../../../modules/conversations/cryptoUtils', () => ({ openSecret: (v) => `open:${v}` }));
jest.mock('../../../identity', () => ({ workspaces: { findById: jest.fn(async () => ({ settings: {} })) } }));

const { assistantForMention, listAssistants } = require('../assistants');
const resolver = require('../ai.provider.resolver');

beforeEach(() => {
  mockRecords.length = 0;
  resolver.invalidate();
});

describe('assistant mentions', () => {
  test('pick the assistant a message addresses', () => {
    expect(assistantForMention('@claude summarise this')).toBe('anthropic');
    expect(assistantForMention('hey @ChatGPT and @claude')).toBe('openai');
    expect(assistantForMention('@gpt draft a reply')).toBe('openai');
    expect(assistantForMention('ask @Grok')).toBe('xai');
    expect(assistantForMention('@gemini?')).toBe('gemini');
    expect(assistantForMention('@ai what is due')).toBe('default');
    expect(assistantForMention('@oruinwan help')).toBe('default');
    expect(assistantForMention('mail me@claude.com')).toBeNull();
    expect(assistantForMention('@claudia hi')).toBeNull();
  });
});

describe('assistants a workspace can use', () => {
  test('Oruinwan AI first, then each connected model with its name and @mention', async () => {
    mockRecords.push(
      { provider: 'anthropic', status: 'active', config: { model: 'claude-opus-4-1' } },
      { provider: 'openai', status: 'inactive', config: {} },
      { provider: 'xai', status: 'active', config: {} },
    );
    const list = await listAssistants('ws1', { defaultProvider: 'local_llm', defaultModel: 'qwen' });
    expect(list.map((a) => [a.id, a.name, a.mention])).toEqual([
      ['default', 'Oruinwan AI', 'ai'],
      ['anthropic', 'Claude', 'claude'],
      ['xai', 'Grok', 'grok'],
    ]);
    expect(list[1].model).toBe('claude-opus-4-1');
    expect(list[2].model).toBe('grok-4');
  });

  test('a connected assistant answers when asked for; an unconnected one says how to connect it', async () => {
    mockRecords.push({ provider: 'anthropic', status: 'active', apiKey: 'sealed', config: {} });
    const ctx = await resolver.contextFor('ws1', 'anthropic');
    expect(ctx.assistant).toBe('anthropic');
    expect(ctx.provider.name).toBe('anthropic');

    await expect(resolver.contextFor('ws1', 'openai')).rejects.toMatchObject({
      code: 'AI_ASSISTANT_NOT_CONNECTED',
      message: expect.stringMatching(/ChatGPT isn't connected/),
    });
  });

  test('Grok talks to the xAI API with the workspace key', async () => {
    mockRecords.push({ provider: 'xai', status: 'active', apiKey: 'sealed', config: {} });
    const ctx = await resolver.contextFor('ws1', 'xai');
    expect(ctx.provider.baseUrl).toBe('https://api.x.ai/v1');
    expect(ctx.provider.apiKey).toBe('open:sealed');
  });
});
