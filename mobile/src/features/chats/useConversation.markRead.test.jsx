// Reads are recorded whenever they happen, not only when the conversation opens: Message info
// on the sender's side depends on it.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { create } from 'zustand';

const fake = {
  messages: vi.fn(async () => ({ items: [{ id: 'm1', authorId: 'u1', text: 'Hi', state: 'ok', at: '2026-01-01T00:00:00Z', reactions: {} }], hasMore: false })),
  markRead: vi.fn(async () => {}),
};
vi.mock('../../data/session.js', () => ({ api: () => fake, useSession: create(() => ({ user: { id: 'me' }, workspaceId: 'w1' })) }));

const { useConversation } = await import('./useConversation.js');
const { clearQueries, setQueryData } = await import('../../data/query.js');
const { emit } = await import('../../lib/bus.js');

beforeEach(() => {
  clearQueries();
  vi.clearAllMocks();
});

describe('useConversation marks the conversation read', () => {
  it('on open, when someone else’s message arrives, and when the socket reconnects', async () => {
    const conv = { kind: 'dm', id: 'd1' };
    renderHook(() => useConversation(conv));
    await waitFor(() => expect(fake.markRead).toHaveBeenCalledTimes(2)); // open, then once the messages loaded
    const before = fake.markRead.mock.calls.length;

    // My own message doesn't need a read.
    act(() => setQueryData('messages:d1', (d) => ({ ...d, items: [...d.items, { id: 'm2', authorId: 'me', text: 'Mine', state: 'ok', at: '2026-01-01T00:01:00Z', reactions: {} }] })));
    expect(fake.markRead).toHaveBeenCalledTimes(before);

    act(() => setQueryData('messages:d1', (d) => ({ ...d, items: [...d.items, { id: 'm3', authorId: 'u1', text: 'New', state: 'ok', at: '2026-01-01T00:02:00Z', reactions: {} }] })));
    expect(fake.markRead).toHaveBeenCalledTimes(before + 1);

    act(() => emit('realtime', { connected: true }));
    expect(fake.markRead).toHaveBeenCalledTimes(before + 2);
    expect(fake.markRead).toHaveBeenLastCalledWith(conv);
  });

  it('not for a thread view', async () => {
    renderHook(() => useConversation({ kind: 'dm', id: 'd1' }, { threadOf: 'm1' }));
    await act(async () => {});
    expect(fake.markRead).not.toHaveBeenCalled();
  });
});
