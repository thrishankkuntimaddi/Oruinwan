import { describe, expect, test, vi } from 'vitest';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import { fromServerMessages, newChatId, toServerMessages } from '../components/ai/OruinwanAIChat/aiChatSync';

describe('AI history mapping', () => {
  test('keeps questions and finished answers, drops the welcome, errors and half-streamed text', () => {
    const msgs = toServerMessages([
      { id: 1, sender: 'ai', text: "Hi, I'm Oruinwan AI." },
      { id: 2, sender: 'user', text: 'What is due?' },
      { id: 3, sender: 'ai', text: 'Two tasks.' },
      { id: 4, sender: 'ai', text: 'Sorry', isError: true },
      { id: 5, sender: 'ai', text: 'partial', streaming: true },
      { id: 6, sender: 'user', text: '   ' },
    ]);
    expect(msgs.map((m) => [m.role, m.text])).toEqual([['user', 'What is due?'], ['assistant', 'Two tasks.']]);
  });

  test('server messages become panel messages', () => {
    const out = fromServerMessages({ id: 'ai_x', messages: [{ role: 'user', text: 'Q', at: '2026-10-22T10:00:00Z' }, { role: 'assistant', text: 'A', at: '2026-10-22T10:00:01Z' }] });
    expect(out.map((m) => [m.sender, m.text])).toEqual([['user', 'Q'], ['ai', 'A']]);
    expect(new Set(out.map((m) => m.id)).size).toBe(2);
  });

  test('ids are accepted by the server (6–64 letters, digits, _ or -)', () => {
    expect(newChatId()).toMatch(/^[A-Za-z0-9_-]{6,64}$/);
  });
});
