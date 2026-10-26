// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { definePeopleMatchTests } from '@platform/people/peopleMatch.cases.js';
import { recipientsFrom, filterRecipients, togglePicked } from '../features/messaging/recipients/recipients';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('../services/api', () => ({ default: apiMock }));

import NewMessageDialog from '../features/messaging/recipients/NewMessageDialog';

// The same cases as the phone app (mobile/src/lib/peopleSearch.test.js).
definePeopleMatchTests({ describe, it, expect });

const ME = 'a'.repeat(24);
const MEMBERS = [
    { _id: ME, username: 'nani', email: 'nani@x.io', isCurrentUser: true, membershipStatus: 'active' },
    { _id: 'b'.repeat(24), username: 'mani', email: 'mani@x.io', profile: { name: 'Mani Kumar' }, membershipStatus: 'active' },
    { _id: 'c'.repeat(24), username: 'teja', email: 'teja@x.io', membershipStatus: 'active' },
    { _id: 'd'.repeat(24), username: 'nikil', email: 'nikil@x.io', membershipStatus: 'active' },
    { _id: 'e'.repeat(24), username: 'gone', email: 'gone@x.io', membershipStatus: 'removed' },
];

describe('recipients', () => {
    it('lists active members other than me, named by their profile name when set', () => {
        const list = recipientsFrom(MEMBERS, ME);
        expect(list.map((r) => r.username)).toEqual(['mani', 'nikil', 'teja']);
        expect(list[0]).toMatchObject({ _id: 'b'.repeat(24), name: 'Mani Kumar' });
    });

    it('takes search results with `id` and `name` (older server shape) as well', () => {
        const [r] = recipientsFrom([{ id: 'f'.repeat(24), name: 'Ravi', email: 'r@x.io' }], ME);
        expect(r).toMatchObject({ _id: 'f'.repeat(24), name: 'Ravi' });
    });

    it('filters by profile name, username and email; trims the query', () => {
        const list = recipientsFrom(MEMBERS, ME);
        expect(filterRecipients(list, 'kumar').map((r) => r.username)).toEqual(['mani']);
        expect(filterRecipients(list, '  TEJ ').map((r) => r.username)).toEqual(['teja']);
        expect(filterRecipients(list, 'nikil@').map((r) => r.username)).toEqual(['nikil']);
        expect(filterRecipients(list, '')).toBe(list);
    });

    it('picks and unpicks by id', () => {
        const [m, n] = recipientsFrom(MEMBERS, ME);
        let picked = togglePicked([], m);
        picked = togglePicked(picked, n);
        picked = togglePicked(picked, { ...m });
        expect(picked.map((p) => p.username)).toEqual(['nikil']);
    });
});

describe('New message dialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiMock.get.mockResolvedValue({ data: { members: MEMBERS } });
    });

    const open = (props = {}) => render(
        <NewMessageDialog open workspaceId="w1" currentUserId={ME} onClose={vi.fn()} onStartDM={vi.fn()} onStartedGroup={vi.fn()} {...props} />
    );
    const rows = () => screen.queryAllByTestId('recipient-row').map((r) => r.textContent);

    it('loads the members fresh and filters as you type', async () => {
        open();
        await waitFor(() => expect(rows()).toHaveLength(3));
        expect(apiMock.get).toHaveBeenCalledWith('/api/workspaces/w1/members');
        fireEvent.change(screen.getByLabelText('Search people'), { target: { value: ' kum' } });
        expect(rows()).toHaveLength(1);
        expect(rows()[0]).toContain('Mani Kumar');
        fireEvent.change(screen.getByLabelText('Search people'), { target: { value: 'zzz' } });
        expect(screen.getByText(/No one matches/)).toBeInTheDocument();
    });

    it('clicking a person opens the 1:1 DM; Enter opens the highlighted one', async () => {
        const onStartDM = vi.fn();
        open({ onStartDM });
        await waitFor(() => expect(rows()).toHaveLength(3));
        fireEvent.click(screen.getAllByTestId('recipient-row')[2]);
        expect(onStartDM).toHaveBeenLastCalledWith(expect.objectContaining({ username: 'teja' }));
        fireEvent.change(screen.getByLabelText('Search people'), { target: { value: 'nik' } });
        fireEvent.keyDown(screen.getByLabelText('Search people'), { key: 'Enter' });
        expect(onStartDM).toHaveBeenLastCalledWith(expect.objectContaining({ username: 'nikil' }));
    });

    it('ticking two people starts a group with exactly their ids', async () => {
        const onStartedGroup = vi.fn();
        apiMock.post.mockResolvedValue({ data: { created: true, dm: { id: 'g1' } } });
        open({ onStartedGroup });
        await waitFor(() => expect(rows()).toHaveLength(3));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Add Mani Kumar to a group' }));
        // With someone picked, clicking a row ticks it instead of opening a DM.
        fireEvent.click(screen.getAllByTestId('recipient-row')[1]);
        expect(screen.getByRole('checkbox', { name: 'Add nikil to a group' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('checkbox', { name: 'Add teja to a group' })).toHaveAttribute('aria-checked', 'false');
        fireEvent.click(screen.getByRole('button', { name: /Start group \(3\)/ }));
        await waitFor(() => expect(onStartedGroup).toHaveBeenCalledWith(expect.objectContaining({ id: 'g1', created: true })));
        expect(apiMock.post).toHaveBeenCalledWith('/api/v2/dm/group', { workspaceId: 'w1', memberIds: ['b'.repeat(24), 'd'.repeat(24)], name: undefined });
    });

    it('Escape and a click outside close it; reopening starts fresh', async () => {
        const onClose = vi.fn();
        const { rerender } = open({ onClose });
        await waitFor(() => expect(rows()).toHaveLength(3));
        fireEvent.change(screen.getByLabelText('Search people'), { target: { value: 'teja' } });
        fireEvent.keyDown(window, { key: 'Escape' });
        fireEvent.mouseDown(screen.getByTestId('new-message-dialog'));
        expect(onClose).toHaveBeenCalledTimes(2);

        rerender(<NewMessageDialog open={false} workspaceId="w1" currentUserId={ME} onClose={onClose} />);
        expect(screen.queryByTestId('new-message-dialog')).toBeNull();
        rerender(<NewMessageDialog open workspaceId="w1" currentUserId={ME} onClose={onClose} />);
        await waitFor(() => expect(rows()).toHaveLength(3));
        expect(screen.getByLabelText('Search people')).toHaveValue('');
    });
});

describe('both "New message" entry points search the same way', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiMock.get.mockResolvedValue({ data: { members: MEMBERS } });
    });
    const rows = () => screen.queryAllByTestId('recipient-row').map((r) => r.textContent);
    const search = async () => {
        await waitFor(() => expect(rows()).toHaveLength(3));
        fireEvent.change(screen.getByLabelText('Search people'), { target: { value: 'kum' } });
        expect(rows()).toEqual([expect.stringContaining('Mani Kumar')]);
        fireEvent.change(screen.getByLabelText('Search people'), { target: { value: 'gone' } });
        expect(rows()).toHaveLength(0); // removed members never show
    };

    it('Home sidebar', async () => {
        const { MemoryRouter } = await import('react-router-dom');
        const { NewDMModal } = await import('../components/home/panels/HomePanel/ChannelDMModals');
        render(<MemoryRouter><NewDMModal workspaceId="w1" showNewDMModal setShowNewDMModal={vi.fn()} handleStartDM={vi.fn()} currentUserId={ME} /></MemoryRouter>);
        await search();
    });

    it('Messages page', async () => {
        const { MemoryRouter, Routes, Route } = await import('react-router-dom');
        const { AuthContext } = await import('../contexts/AuthContext');
        const { default: MessagesNewDM } = await import('../features/messaging/NewDMModal');
        render(
            <AuthContext.Provider value={{ user: { _id: ME } }}>
                <MemoryRouter initialEntries={['/workspace/w1/messages']}>
                    <Routes><Route path="/workspace/:workspaceId/messages" element={<MessagesNewDM onClose={vi.fn()} onStart={vi.fn()} />} /></Routes>
                </MemoryRouter>
            </AuthContext.Provider>,
        );
        await search();
        expect(apiMock.get).toHaveBeenCalledWith('/api/workspaces/w1/members');
    });
});
