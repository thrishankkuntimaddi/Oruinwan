import { describe, expect, it, vi } from 'vitest';

vi.mock('../../app/nav.js', () => ({ nav: { open: vi.fn(), openAi: vi.fn() } }));

describe('day blocks', () => {
  it('splits messages by day so each date chip only sticks over its own day', async () => {
    const { dayBlocks } = await import('./messages.jsx');
    const items = [
      { id: 'a', at: '2026-10-23T10:00:00' },
      { id: 'b', at: '2026-10-23T11:00:00' },
      { id: 'c', at: '2026-10-24T09:00:00' },
      { id: 'd', at: '2026-10-26T09:00:00' },
    ];
    expect(dayBlocks(items).map((d) => d.items.map((m) => m.id))).toEqual([['a', 'b'], ['c'], ['d']]);
  });
});

describe('quick AI → full screen', () => {
  it('carries the conversation and the question being typed', async () => {
    const { continueInAi, useAiUi } = await import('../ai/aiUi.js');
    continueInAi([{ q: 'What did I miss?', a: 'Two messages.', done: true }], 'And tasks?');
    const p = useAiUi.getState().pending;
    expect(p.prompt).toBe('And tasks?');
    expect(p.thread.messages.map((m) => [m.role, m.content || m.text])).toEqual([['user', 'What did I miss?'], ['assistant', 'Two messages.']]);
  });
});
