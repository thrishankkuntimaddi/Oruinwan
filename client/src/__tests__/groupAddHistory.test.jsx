// @vitest-environment jsdom
// Adding people to a group on the web: the person adding chooses what they can see ("From now
// on" or "Include earlier messages"), or starts a separate new group that leaves this one as it is.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const NANI = 'u1';
const group = {
    _id: 'g1', isGroup: true, name: null, createdBy: NANI,
    participants: [{ _id: NANI, username: 'nani' }, { _id: 'u2', username: 'mani' }, { _id: 'u3', username: 'teja' }],
};
const get = vi.fn(async (url) => {
    if (url === '/api/v2/dm/g1') return { data: { dm: group } };
    if (url === '/api/workspaces/w1/members') {
        return { data: { members: [NANI, 'u2', 'u3', 'u4'].map((id, i) => ({ user: { _id: id, username: ['nani', 'mani', 'teja', 'nikil'][i] }, status: 'active' })) } };
    }
    throw new Error(`unexpected ${url}`);
});
const post = vi.fn();
vi.mock('@services/api', () => ({ default: { get: (...a) => get(...a), post: (...a) => post(...a), patch: vi.fn(), delete: vi.fn() } }));

const api = await import('../features/messaging/groupDm/groupDmApi');
const { default: GroupInfoModal } = await import('../features/messaging/groupDm/GroupInfoModal');

function Where() {
    return <span data-testid="where">{useLocation().pathname}</span>;
}
const open = () => render(
    <MemoryRouter initialEntries={['/workspace/w1/home/dm/g1']}>
        <Routes><Route path="*" element={<><GroupInfoModal dmId="g1" workspaceId="w1" currentUserId={NANI} onClose={() => {}} /><Where /></>} /></Routes>
    </MemoryRouter>,
);

async function pickNikil() {
    fireEvent.click(await screen.findByText('Add people'));
    fireEvent.click(await screen.findByText('nikil'));
}

beforeEach(() => vi.clearAllMocks());

describe('group DM API (web)', () => {
    it('sends the history choice (default: from now on) and reports limited history', async () => {
        post.mockResolvedValueOnce({ data: { dm: group, history: { u4: { limited: true } } } });
        const dm = await api.addGroupDMMembers('g1', ['u4'], { history: 'earlier' });
        expect(post).toHaveBeenCalledWith('/api/v2/dm/g1/members', { userIds: ['u4'], history: 'earlier' });
        expect(dm.limitedHistory).toBe(true);
        post.mockResolvedValueOnce({ data: { dm: group, history: {} } });
        await api.addGroupDMMembers('g1', ['u4']);
        expect(post).toHaveBeenLastCalledWith('/api/v2/dm/g1/members', { userIds: ['u4'], history: 'from_now' });
    });

    it('"Start a new group" asks for a separate group', async () => {
        post.mockResolvedValueOnce({ data: { dm: { _id: 'g2' }, created: true } });
        await api.createGroupDM('w1', ['u2', 'u3', 'u4'], '', { newGroup: true });
        expect(post).toHaveBeenCalledWith('/api/v2/dm/group', { workspaceId: 'w1', memberIds: ['u2', 'u3', 'u4'], name: undefined, newGroup: true });
    });

    it('says what they can see', () => {
        expect(api.addedMessage(1, 'from_now')).toBe('Added to the group. They see messages from now on.');
        expect(api.addedMessage(2, 'earlier')).toBe('2 people added to the group with the earlier messages.');
        expect(api.addedMessage(1, 'earlier', true)).toMatch(/couldn't be shared/);
    });
});

describe('Group info: add people', () => {
    it('adds "from now on" by default', async () => {
        post.mockResolvedValueOnce({ data: { dm: group, history: { u4: { limited: false } } } });
        open();
        await pickNikil();
        const [now] = screen.getAllByRole('radio');
        expect(now.checked).toBe(true);
        fireEvent.click(screen.getByTestId('add-to-group'));
        await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v2/dm/g1/members', { userIds: ['u4'], history: 'from_now' }));
        expect(await screen.findByText('Added to the group. They see messages from now on.')).toBeTruthy();
    });

    it('can include earlier messages', async () => {
        post.mockResolvedValueOnce({ data: { dm: group, history: { u4: { limited: false } } } });
        open();
        await pickNikil();
        fireEvent.click(screen.getByLabelText(/Include earlier messages/));
        fireEvent.click(screen.getByTestId('add-to-group'));
        await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v2/dm/g1/members', { userIds: ['u4'], history: 'earlier' }));
    });

    it('or starts a separate group with everyone here plus them, and opens it', async () => {
        post.mockResolvedValueOnce({ data: { dm: { _id: 'g2' }, created: true } });
        open();
        await pickNikil();
        fireEvent.click(screen.getByTestId('start-new-group'));
        await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v2/dm/group', { workspaceId: 'w1', memberIds: ['u2', 'u3', 'u4'], name: undefined, newGroup: true }));
        await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/workspace/w1/home/dm/g2'));
        expect(post).not.toHaveBeenCalledWith('/api/v2/dm/g1/members', expect.anything());
    });
});
