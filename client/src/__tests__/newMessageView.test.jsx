// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const navigateMock = vi.hoisted(() => vi.fn());
vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('../services/api', () => ({ default: apiMock }));
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigateMock }));
vi.mock('../features/messaging/chatWindowComp/ChatWindowV2', () => ({
    default: ({ chat }) => <div data-testid="chat-window">{chat.isGroup ? `group ${chat.id}` : `dm ${chat.id} with ${chat.name}`}</div>,
}));
vi.mock('../contexts/ContactsContext', () => ({ useContacts: () => ({ refreshContacts: vi.fn(), contacts: [] }) }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import NewMessageView from '../features/messaging/newMessage/NewMessageView';

const ME = 'a'.repeat(24);
const MUZ = 'b'.repeat(24);
const VAR = 'c'.repeat(24);
const MEMBERS = [
    { _id: ME, username: 'Thrishank Kuntimaddi', isCurrentUser: true, membershipStatus: 'active' },
    { _id: MUZ, username: 'Muzamil K', membershipStatus: 'active' },
    { _id: VAR, username: 'varshitha gajjala k', membershipStatus: 'active' },
];
const WS = 'f'.repeat(24);

const renderView = () => render(<MemoryRouter><NewMessageView workspaceId={WS} currentUserId={ME} /></MemoryRouter>);
const pick = async (text, name) => {
    fireEvent.change(screen.getByLabelText('To'), { target: { value: text } });
    fireEvent.mouseDown(await screen.findByText(name, { selector: 'div' }));
};

describe('New message with a To: bar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiMock.get.mockResolvedValue({ data: { members: MEMBERS } });
    });

    it('one person opens our chat; adding another opens the group with exactly them', async () => {
        apiMock.post.mockImplementation(async (url, body) => {
            if (url !== '/api/v2/dm/find') throw new Error(url);
            if (body.userIds.length === 1) return { data: { dm: { id: 'd1', isGroup: false, participants: [{ _id: ME }, { _id: MUZ, username: 'Muzamil K' }] } } };
            return { data: { dm: { id: 'g1', isGroup: true, participants: [{ _id: ME }, { _id: MUZ }, { _id: VAR }] } } };
        });
        renderView();
        await pick('muz', 'Muzamil K');
        expect(await screen.findByTestId('chat-window')).toHaveTextContent('dm d1 with Muzamil K');
        await pick('var', 'varshitha gajjala k');
        await waitFor(() => expect(screen.getByTestId('chat-window')).toHaveTextContent('group g1'));
        expect(apiMock.post).toHaveBeenLastCalledWith('/api/v2/dm/find', { workspaceId: WS, userIds: [MUZ, VAR].sort() });
        expect(screen.getAllByTestId('to-chip')).toHaveLength(2);
    });

    it('no group with these people yet: says so and starts one with the first message', async () => {
        apiMock.post.mockImplementation(async (url) => {
            if (url === '/api/v2/dm/find') return { data: { dm: null } };
            if (url === '/api/v2/dm/group') return { data: { created: true, dm: { id: 'g2', isGroup: true } } };
            throw new Error(url);
        });
        renderView();
        await pick('muz', 'Muzamil K');
        await pick('var', 'varshitha gajjala k');
        expect(await screen.findByTestId('no-conversation')).toHaveTextContent("You don't have a group with Muzamil K and varshitha gajjala k yet");
        fireEvent.change(screen.getByLabelText('First message'), { target: { value: 'hello both' } });
        fireEvent.keyDown(screen.getByLabelText('First message'), { key: 'Enter' });
        await waitFor(() => expect(navigateMock).toHaveBeenCalledWith(`/workspace/${WS}/messages/dm/g2`, { state: { sendDraft: { text: 'hello both' } } }));
        expect(apiMock.post).toHaveBeenCalledWith('/api/v2/dm/group', expect.objectContaining({ workspaceId: WS, memberIds: [MUZ, VAR] }));
    });

    it('backspace in an empty To field removes the last person', async () => {
        apiMock.post.mockResolvedValue({ data: { dm: null } });
        renderView();
        await pick('muz', 'Muzamil K');
        fireEvent.keyDown(screen.getByLabelText('To'), { key: 'Backspace' });
        expect(screen.queryAllByTestId('to-chip')).toHaveLength(0);
    });
});
