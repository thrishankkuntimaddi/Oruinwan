// A task's Discussion screen on the phone, its row and linked thread on the task page, and the
// thread People sheet (add / remove followers).
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { create } from 'zustand';

const me = { id: 'me', name: 'Me', username: 'me' };
const discussion = (over = {}) => ({
  resolved: false,
  resolvedAt: null,
  participants: [
    { id: 'me', username: 'me', avatarUrl: null, roles: ['creator'] },
    { id: 'u2', username: 'ana', avatarUrl: null, roles: ['assignee'] },
    { id: 'u3', username: 'bo', avatarUrl: null, roles: ['added'] },
  ],
  entries: [
    { id: 'e1', kind: 'event', author: { id: 'u2', username: 'ana' }, text: '', mentions: [], attachments: [], event: { type: 'status', from: 'todo', to: 'in_progress' }, at: '2026-10-20T10:00:00Z' },
    { id: 'e2', kind: 'comment', author: { id: 'u2', username: 'ana' }, text: 'Started', mentions: [], attachments: [], event: null, at: '2026-10-20T10:01:00Z' },
  ],
  permissions: { canComment: true, canAddPeople: true, canModerate: true },
  linkedThread: null,
  ...over,
});

const fake = {
  taskDiscussion: vi.fn(async () => discussion()),
  postTaskComment: vi.fn(async (id, text) => ({ id: 'e3', kind: 'comment', author: { id: 'me', username: 'me' }, text, mentions: [], attachments: [], event: null, at: '2026-10-20T10:02:00Z' })),
  addTaskParticipants: vi.fn(async () => ['u4']),
  removeTaskParticipant: vi.fn(async () => {}),
  deleteTaskComment: vi.fn(async () => {}),
  members: vi.fn(async () => [me, { id: 'u2', name: 'Ana', username: 'ana' }, { id: 'u4', name: 'Cy', username: 'cy' }]),
  threadFollowers: vi.fn(async () => ({ followers: [{ id: 'me', username: 'me' }, { id: 'u2', username: 'ana' }], canModerate: false })),
  addThreadFollowers: vi.fn(async () => ({ added: ['u4'], skipped: [] })),
  removeThreadFollower: vi.fn(async () => ({ followerCount: 1 })),
};

const mockSession = create(() => ({ user: me, workspaceId: 'w1' }));
vi.mock('../../data/session.js', () => ({ api: () => fake, useSession: mockSession, useWorkspace: () => ({ id: 'w1', role: 'member' }) }));

const { TaskDiscussionScreen, TaskDiscussionSection, describeEntry } = await import('./TaskDiscussion.jsx');
const { ThreadPeopleSheet } = await import('../chats/ThreadPeopleSheet.jsx');
const { clearQueries } = await import('../../data/query.js');
const { nav } = await import('../../app/nav.js');
const push = vi.spyOn(nav, 'push').mockImplementation(() => {});

beforeEach(() => {
  cleanup();
  clearQueries();
  vi.clearAllMocks();
  fake.taskDiscussion.mockImplementation(async () => discussion());
});

describe('task discussion (phone)', () => {
  it('shows people, automatic entries and comments, and posts a comment', async () => {
    render(<TaskDiscussionScreen id="t1" title="Ship it" />);
    await screen.findByTestId('task-discussion');
    expect(screen.getAllByTestId('task-discussion-person')).toHaveLength(3);
    expect(screen.getByTestId('task-discussion-event').textContent).toContain('moved it from To do to In progress');
    expect(screen.getByTestId('task-discussion-comment').textContent).toContain('Started');
    expect(screen.queryByTestId('task-discussion-resolved')).toBeNull();

    fireEvent.change(screen.getByLabelText('Write a comment'), { target: { value: 'Thanks' } });
    fireEvent.click(screen.getByLabelText('Send comment'));
    await waitFor(() => expect(fake.postTaskComment).toHaveBeenCalledWith('t1', 'Thanks'));
  });

  it('a done task reads as resolved; people who cannot add see no Add button', async () => {
    fake.taskDiscussion.mockImplementation(async () => discussion({ resolved: true, permissions: { canComment: true, canAddPeople: false, canModerate: false } }));
    mockSession.setState({ user: { id: 'u3', name: 'Bo' } });
    render(<TaskDiscussionScreen id="t1" />);
    expect(await screen.findByTestId('task-discussion-resolved')).toBeTruthy();
    expect(screen.queryByLabelText('Add people')).toBeNull();
    expect(screen.getByLabelText('Leave the discussion')).toBeTruthy();
    mockSession.setState({ user: me });
  });

  it('the task page row opens the discussion and the linked thread opens the thread', async () => {
    fake.taskDiscussion.mockImplementation(async () => discussion({
      linkedThread: { messageId: 'm1', convKind: 'channel', convId: 'c1', channelName: 'launch', replyCount: 2, locked: false, parent: { id: 'm1', sender: 'ana', text: 'Can we ship?' }, replies: [{ id: 'r1', sender: 'bo', text: 'Yes' }] },
    }));
    render(<TaskDiscussionSection id="t1" title="Ship it" />);
    const card = await screen.findByTestId('task-linked-thread');
    expect(card.textContent).toContain('From #launch thread · 2 replies');
    expect(screen.getByTestId('task-linked-reply').textContent).toContain('bo Yes');
    fireEvent.click(within(card).getByText('Open'));
    expect(push).toHaveBeenCalledWith('thread', { kind: 'channel', convId: 'c1', messageId: 'm1' });
    fireEvent.click(screen.getAllByText('Discussion').find((el) => el.closest('button')));
    expect(push).toHaveBeenCalledWith('taskDiscussion', { id: 't1', title: 'Ship it' });
  });

  it('describes reassignments and due dates', () => {
    expect(describeEntry({ event: { type: 'reassigned', to: ['u2'], names: { u2: 'ana' } } })).toBe('reassigned it to ana');
    expect(describeEntry({ event: { type: 'due_date', from: null, to: null } })).toBe('cleared the due date');
    expect(describeEntry({ event: { type: 'reopened' } })).toContain('reopened');
  });
});

describe('thread people (phone)', () => {
  it('lists followers; without moderation only I can leave; adds people', async () => {
    const onChanged = vi.fn();
    render(<ThreadPeopleSheet open messageId="p1" onClose={() => {}} onChanged={onChanged} />);
    await screen.findByText('ana');
    expect(screen.getByLabelText('Leave this thread')).toBeTruthy();
    expect(screen.queryByLabelText('Remove ana')).toBeNull();

    fireEvent.click(screen.getByText('Add people'));
    fireEvent.click(await screen.findByText('Cy'));
    fireEvent.click(screen.getByText(/^Add 1/));
    await waitFor(() => expect(fake.addThreadFollowers).toHaveBeenCalledWith('p1', ['u4']));
    expect(onChanged).toHaveBeenCalled();
  });
});
