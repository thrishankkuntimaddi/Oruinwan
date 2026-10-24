// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const mockApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@services/api', () => ({ default: mockApi }));
vi.mock('../services/api', () => ({ default: mockApi }));
vi.mock('../services/messageEncryptionService', () => ({
    batchDecryptMessages: vi.fn(async (list) => list.map((m) => ({ ...m, decryptedContent: `plain:${m.payload.ciphertext}` }))),
}));

import TaskDiscussion, { describeDiscussionEvent } from '../components/tasksComp/TaskDiscussion';
import ThreadPeopleModal from '../features/messaging/chatWindowComp/modals/ThreadPeopleModal';

const ME = 'a'.repeat(24);
const BOB = 'b'.repeat(24);
const CAROL = 'c'.repeat(24);
const TASK = 'd'.repeat(24);

const discussion = (over = {}) => ({
    taskId: TASK, status: 'in_progress', resolved: false, resolvedAt: null,
    participants: [
        { _id: ME, username: 'me', roles: ['creator'] },
        { _id: BOB, username: 'bob', roles: ['assignee'] },
        { _id: CAROL, username: 'carol', roles: ['added'] },
    ],
    entries: [
        { _id: 'e1', kind: 'event', author: { _id: BOB, username: 'bob' }, event: { type: 'status', from: 'todo', to: 'in_progress' }, createdAt: '2026-10-20T10:00:00Z' },
        { _id: 'e2', kind: 'comment', author: { _id: BOB, username: 'bob' }, text: 'Started on it', createdAt: '2026-10-20T10:01:00Z' },
    ],
    commentCount: 1,
    linkedThread: null,
    permissions: { canComment: true, canAddPeople: true, canModerate: true },
    ...over,
});

beforeEach(() => {
    Object.values(mockApi).forEach((f) => f.mockReset());
});

describe('task discussion', () => {
    it('shows people, automatic entries and comments, and posts a comment', async () => {
        mockApi.get.mockResolvedValue({ data: discussion() });
        mockApi.post.mockResolvedValue({ data: { entry: { _id: 'e3', kind: 'comment', author: { _id: ME, username: 'me' }, text: 'Thanks!', mentions: [], createdAt: '2026-10-20T10:02:00Z' } } });
        render(<TaskDiscussion taskId={TASK} workspaceId="ws1" members={[]} currentUserId={ME} />);

        await screen.findByTestId('task-discussion');
        expect(screen.getAllByTestId('task-discussion-person')).toHaveLength(3);
        expect(screen.getByTestId('task-discussion-event')).toHaveTextContent('bob moved it from To do to In progress');
        expect(screen.getByTestId('task-discussion-comment')).toHaveTextContent('Started on it');
        expect(screen.queryByTestId('task-discussion-resolved')).toBeNull();

        fireEvent.change(screen.getByLabelText('Write a comment'), { target: { value: 'Thanks!' } });
        fireEvent.click(screen.getByLabelText('Send comment'));
        await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith(`/api/v2/tasks/${TASK}/discussion`, { text: 'Thanks!' }));
        await waitFor(() => expect(screen.getAllByTestId('task-discussion-comment')).toHaveLength(2));
    });

    it('a done task shows the discussion as resolved; watchers cannot add people', async () => {
        mockApi.get.mockResolvedValue({ data: discussion({ resolved: true, resolvedAt: '2026-10-21T00:00:00Z', permissions: { canComment: true, canAddPeople: false, canModerate: false } }) });
        render(<TaskDiscussion taskId={TASK} workspaceId="ws1" members={[]} currentUserId={CAROL} />);
        expect(await screen.findByTestId('task-discussion-resolved')).toHaveTextContent('Resolved');
        expect(screen.queryByTestId('task-discussion-add')).toBeNull();
        // Creator and assignee can't be removed; Carol (added) can leave.
        expect(screen.getByLabelText('Leave the discussion')).toBeInTheDocument();
        expect(screen.queryByLabelText('Remove bob')).toBeNull();
    });

    it('adds people from the workspace', async () => {
        mockApi.get.mockResolvedValue({ data: discussion() });
        mockApi.post.mockResolvedValue({ data: { added: ['e'.repeat(24)] } });
        render(<TaskDiscussion taskId={TASK} workspaceId="ws1" members={[{ _id: 'e'.repeat(24), username: 'erin' }, { _id: BOB, username: 'bob' }]} currentUserId={ME} />);
        fireEvent.click(await screen.findByTestId('task-discussion-add'));
        const picker = screen.getByTestId('task-discussion-add-people');
        expect(within(picker).queryByText('bob')).toBeNull(); // already in the discussion
        fireEvent.click(within(picker).getByText('erin'));
        fireEvent.click(within(picker).getByRole('button', { name: /Add/ }));
        await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith(`/api/v2/tasks/${TASK}/participants`, { userIds: ['e'.repeat(24)] }));
    });

    it('shows the linked thread with its latest replies, decrypted', async () => {
        mockApi.get.mockResolvedValue({ data: discussion({
            linkedThread: {
                messageId: 'f'.repeat(24), channelId: 'c1', channelName: 'launch', replyCount: 4, locked: false,
                parent: { _id: 'p', sender: { username: 'bob' }, payload: { ciphertext: 'root' } },
                latestReplies: [{ _id: 'r1', sender: { username: 'carol' }, payload: { ciphertext: 'last' } }],
            },
        }) });
        render(<TaskDiscussion taskId={TASK} workspaceId="ws1" members={[]} currentUserId={ME} />);
        const card = await screen.findByTestId('task-linked-thread');
        expect(card).toHaveTextContent('From #launch thread · 4 replies');
        await waitFor(() => expect(screen.getByTestId('task-linked-reply')).toHaveTextContent('carol plain:last'));
        expect(within(card).getByText(/Open/).closest('a')).toHaveAttribute('href', `/workspace/ws1/channel/c1?thread=${'f'.repeat(24)}`);
    });

    it('describes reassignment and due-date entries with names', () => {
        const { container } = render(<p>{describeDiscussionEvent({ event: { type: 'reassigned', to: [BOB], names: { [BOB]: 'bob' } } })}</p>);
        expect(container).toHaveTextContent('reassigned it to bob');
        const { container: c2 } = render(<p>{describeDiscussionEvent({ event: { type: 'due_date', from: null, to: null } })}</p>);
        expect(c2).toHaveTextContent('cleared the due date');
    });
});

describe('thread people', () => {
    it('lists followers; a moderator removes others, everyone can leave', async () => {
        mockApi.get.mockResolvedValue({ data: { followers: [{ _id: ME, username: 'me' }, { _id: BOB, username: 'bob' }], canModerate: true } });
        mockApi.delete.mockResolvedValue({ data: { removed: BOB } });
        const onChanged = vi.fn();
        render(<ThreadPeopleModal messageId="m1" members={[]} currentUserId={ME} onClose={() => {}} onChanged={onChanged} />);
        expect(await screen.findAllByTestId('thread-follower')).toHaveLength(2);
        expect(screen.getByLabelText('Leave this thread')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Remove bob'));
        await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith(`/api/threads/m1/followers/${BOB}`));
        await waitFor(() => expect(onChanged).toHaveBeenCalledWith({ followerCount: 1, followingMe: true }));
    });

    it('a member who does not moderate sees no remove buttons for others, and can add people', async () => {
        mockApi.get.mockResolvedValue({ data: { followers: [{ _id: BOB, username: 'bob' }], canModerate: false } });
        mockApi.post.mockResolvedValue({ data: { added: [CAROL], skipped: [] } });
        render(<ThreadPeopleModal messageId="m1" members={[{ _id: BOB, username: 'bob' }, { _id: CAROL, username: 'carol' }]} currentUserId={ME} onClose={() => {}} />);
        await screen.findAllByTestId('thread-follower');
        expect(screen.queryByLabelText('Remove bob')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /Add people/ }));
        const add = screen.getByTestId('thread-add-people');
        expect(within(add).queryByText('bob')).toBeNull();
        fireEvent.click(within(add).getByText('carol'));
        fireEvent.click(screen.getByRole('button', { name: /Add 1/ }));
        await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/api/threads/m1/followers', { userIds: [CAROL] }));
    });
});
