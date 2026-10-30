// Quick search: tapping a person or chat opens the conversation.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { create } from 'zustand';

const me = { id: 'me', name: 'Me' };
const varsha = { id: 'u1', name: 'Varshitha Rao', username: 'varsha', presence: 'active' };
const ravi = { id: 'u2', name: 'Ravi Kumar', username: 'ravi', presence: 'offline' };
const fake = {
  channels: vi.fn(async () => []),
  dms: vi.fn(async () => [{ id: 'd1', user: varsha, participantIds: ['me', 'u1'], lastText: 'hi', at: '2026-10-30T09:00:00Z', unread: 0 }]),
  members: vi.fn(async () => [me, varsha, ravi]),
  agents: vi.fn(async () => []),
  tasks: vi.fn(async () => []),
  notes: vi.fn(async () => []),
  notifications: vi.fn(async () => []),
  openDm: vi.fn(async () => 'd2'),
};
const mockSession = create(() => ({ user: me, workspaceId: 'w1', workspaces: [{ id: 'w1', role: 'member' }], mode: 'live' }));
vi.mock('../../data/session.js', () => ({ api: () => fake, useSession: mockSession, useWorkspace: () => ({ id: 'w1', role: 'member' }) }));

const { QuickSearch } = await import('./QuickSearch.jsx');
const { useNav } = await import('../../app/nav.js');
const { clearQueries } = await import('../../data/query.js');

afterEach(() => {
  cleanup();
  clearQueries();
});

const top = () => {
  const s = useNav.getState();
  const stack = s.stacks[s.tab] || [];
  return stack[stack.length - 1];
};

describe('QuickSearch', () => {
  it('opens a chat with a person you already talk to', async () => {
    const onClose = vi.fn();
    render(<QuickSearch context="chats" query="varsh" onClose={onClose} />);
    fireEvent.click(await screen.findByText('Varshitha Rao'));
    await waitFor(() => expect(top()?.name).toBe('conversation'));
    expect(top().params).toMatchObject({ kind: 'dm', id: 'd1' });
    expect(onClose).toHaveBeenCalled();
  });

  it('starts a chat with someone new', async () => {
    render(<QuickSearch context="chats" query="ravi" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByText('Ravi Kumar'));
    await waitFor(() => expect(top()?.params).toMatchObject({ kind: 'dm', id: 'd2' }));
  });
});
