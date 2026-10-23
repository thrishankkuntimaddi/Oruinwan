// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@services/api', () => ({ default: { post: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '@services/api';
import GroupStartBar, { GroupPickToggle } from '../features/messaging/groupDm/GroupStartBar';
import { groupTitle, MAX_GROUP_MEMBERS } from '../features/messaging/groupDm/groupDmApi';
import { groupChatObject } from '../features/messaging/groupDm/groupChat';

const people = (n) => Array.from({ length: n }, (_, i) => ({ _id: `u${i + 1}`, username: `user${i + 1}` }));

beforeEach(() => vi.clearAllMocks());

describe('group titles', () => {
    test('a name wins; otherwise the other people', () => {
        expect(groupTitle({ name: 'Crew' }, 'me')).toBe('Crew');
        const p = [{ _id: 'me', username: 'asha' }, { _id: 'b', username: 'ben' }, { _id: 'c', username: 'chen' }];
        expect(groupTitle({ participants: p }, 'me')).toBe('ben and chen');
        expect(groupTitle({ participants: [...p, { _id: 'd', username: 'divya' }, { _id: 'e', username: 'eli' }] }, 'me')).toBe('ben, chen and 2 others');
        expect(groupTitle({ participants: [{ _id: 'me' }] }, 'me')).toBe('Just you');
    });

    test('chat object for the chat window', () => {
        const chat = groupChatObject({ id: 'g1', displayName: 'ben and chen', name: null, members: people(3), memberCount: 3 }, 'ws1', 'owner');
        expect(chat).toMatchObject({ id: 'g1', type: 'dm', isGroup: true, userId: null, name: 'ben and chen', memberCount: 3, workspaceId: 'ws1' });
    });
});

describe('starting a group', () => {
    test('nothing is shown until someone is picked', () => {
        const { container } = render(<GroupStartBar workspaceId="ws1" selected={[]} onClear={() => {}} />);
        expect(container.firstChild).toBeNull();
    });

    test('one person asks for one more', () => {
        render(<GroupStartBar workspaceId="ws1" selected={people(1)} onClear={() => {}} />);
        expect(screen.getByText(/Pick one more person/)).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Start group/ })).toBeNull();
    });

    test('two people start a named group with me included in the count', async () => {
        api.post.mockResolvedValue({ data: { dm: { id: 'g9', isGroup: true } } });
        const onStarted = vi.fn();
        render(<GroupStartBar workspaceId="ws1" selected={people(2)} onClear={() => {}} onStarted={onStarted} />);
        fireEvent.change(screen.getByLabelText('Group name'), { target: { value: '  Launch  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Start group (3)' }));
        await waitFor(() => expect(onStarted).toHaveBeenCalledWith({ id: 'g9', isGroup: true }));
        expect(api.post).toHaveBeenCalledWith('/api/v2/dm/group', { workspaceId: 'ws1', memberIds: ['u1', 'u2'], name: 'Launch' });
    });

    test('too many people', () => {
        render(<GroupStartBar workspaceId="ws1" selected={people(MAX_GROUP_MEMBERS)} onClear={() => {}} />);
        expect(screen.getByText(/up to 10 people/)).toBeTruthy();
    });

    test('a server error is shown', async () => {
        api.post.mockRejectedValue({ response: { data: { message: 'Everyone must be a member of this workspace' } } });
        render(<GroupStartBar workspaceId="ws1" selected={people(2)} onClear={() => {}} onStarted={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: /Start group/ }));
        expect(await screen.findByRole('alert')).toBeTruthy();
    });

    test('the pick toggle is a labelled checkbox', () => {
        const onToggle = vi.fn();
        render(<GroupPickToggle on={false} name="ben" onToggle={onToggle} />);
        const box = screen.getByRole('checkbox', { name: 'Add ben to a group' });
        expect(box.getAttribute('aria-checked')).toBe('false');
        fireEvent.click(box);
        expect(onToggle).toHaveBeenCalled();
    });
});
