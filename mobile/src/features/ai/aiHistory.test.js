import { beforeEach, describe, expect, test, vi } from 'vitest';

const store = new Map();
const remote = { chats: [], fail: false };
const adapter = {
  aiChats: vi.fn(async () => { if (remote.fail) throw new Error('offline'); return remote.chats.map((c) => ({ ...c })); }),
  aiChat: vi.fn(async (_ws, id) => remote.chats.find((c) => c.id === id) || null),
  saveAiChat: vi.fn(async (_ws, id, chat) => {
    if (remote.fail) throw new Error('offline');
    remote.chats = [{ id, title: chat.title || chat.messages[0].text, updatedAt: new Date().toISOString(), messages: chat.messages }, ...remote.chats.filter((c) => c.id !== id)];
  }),
  renameAiChat: vi.fn(async () => {}),
  deleteAiChat: vi.fn(async (_ws, id) => { remote.chats = remote.chats.filter((c) => c.id !== id); }),
  clearAiChats: vi.fn(async () => { remote.chats = []; }),
};

vi.mock('../../native/storage.js', () => ({ prefs: { get: (k, d) => (store.has(k) ? store.get(k) : d), set: (k, v) => store.set(k, v) } }));
vi.mock('../../data/session.js', () => ({ api: () => adapter }));

import { clearConversations, deleteConversation, fromServer, listConversations, loadLocal, saveConversation, toServer } from './aiHistory.js';

const thread = (id, q = 'What is due?') => ({
  id, title: '', messages: [{ id: 'u', role: 'user', content: q, at: 1 }, { id: 'a', role: 'assistant', text: 'Two tasks.', at: 2 }],
});

describe('AI history on the phone', () => {
  beforeEach(() => {
    store.clear();
    remote.chats = [];
    remote.fail = false;
    vi.clearAllMocks();
  });

  test('maps to and from the server shape', () => {
    expect(toServer(thread('ai_1')).messages).toEqual([{ role: 'user', text: 'What is due?', at: 1 }, { role: 'assistant', text: 'Two tasks.', at: 2 }]);
    const back = fromServer({ id: 'ai_1', title: 'T', updatedAt: '2026-10-22T10:00:00Z', messages: [{ role: 'user', text: 'Q' }, { role: 'assistant', text: 'A' }] });
    expect(back.messages.map((m) => m.content || m.text)).toEqual(['Q', 'A']);
    expect(back.messages[1].done).toBe(true);
  });

  test('saves on the device and the server', async () => {
    await saveConversation('w1', thread('ai_1'));
    expect(loadLocal('w1').map((t) => t.id)).toEqual(['ai_1']);
    expect(remote.chats.map((c) => c.id)).toEqual(['ai_1']);
  });

  test('offline: kept on the device and listed from it', async () => {
    remote.fail = true;
    await saveConversation('w1', thread('ai_1'));
    const list = await listConversations('w1');
    expect(list).toEqual([expect.objectContaining({ id: 'ai_1', local: true })]);
  });

  test('uploads conversations saved before sync, once', async () => {
    store.set('ai.threads.w1', [{ ...thread('ai_old'), updatedAt: 5 }]);
    const list = await listConversations('w1');
    expect(list.map((c) => c.id)).toEqual(['ai_old']);
    expect(adapter.saveAiChat).toHaveBeenCalledTimes(1);
    await listConversations('w1');
    expect(adapter.saveAiChat).toHaveBeenCalledTimes(1);
  });

  test('delete and clear remove it everywhere', async () => {
    await saveConversation('w1', thread('ai_1'));
    await saveConversation('w1', thread('ai_2'));
    await deleteConversation('w1', 'ai_1');
    expect(loadLocal('w1').map((t) => t.id)).toEqual(['ai_2']);
    expect(remote.chats.map((c) => c.id)).toEqual(['ai_2']);
    await clearConversations('w1');
    expect(loadLocal('w1')).toEqual([]);
    expect(remote.chats).toEqual([]);
  });

  test('an empty conversation is never saved', async () => {
    await saveConversation('w1', { id: 'ai_x', messages: [] });
    expect(adapter.saveAiChat).not.toHaveBeenCalled();
  });
});
