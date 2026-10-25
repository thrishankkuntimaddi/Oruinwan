// @vitest-environment jsdom
// The Messages page opened a DM by the other person's user id ("New message", links) without
// making the DM, so sending failed with "This conversation's encryption key is not ready yet"
// until the DM was made elsewhere (e.g. on the phone). It must open the real DM instead.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('@services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../features/messaging/chatWindowComp/ChatWindowV2', () => ({
    default: ({ chat }) => <div data-testid="chat">{`${chat.type}:${chat.id}`}</div>,
}));
vi.mock('../features/messaging/BroadcastChatWindow', () => ({ default: () => null }));
vi.mock('../features/messaging/NewDMModal', () => ({ default: () => null }));
vi.mock('../pages/SidebarComp/landing/Landings', () => ({ MessagesLanding: () => <div>landing</div> }));
vi.mock('../contexts/ContactsContext', () => ({ useContacts: () => ({ contacts: [], deleteItem: vi.fn() }) }));
vi.mock('../contexts/SocketContext', () => ({ useSocket: () => ({ socket: null }) }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'me' } }) }));
vi.mock('../features/messaging/groupDm/groupChat', () => ({ groupChatObject: (s) => ({ id: s.id, type: 'dm', isGroup: true }), useGroupDMLive: () => {} }));

import api from '@services/api';
import Messages from '../pages/SidebarComp/Messages';

function Where() {
    const { pathname } = useLocation();
    return <div data-testid="path">{pathname}</div>;
}

function renderAt(path) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/workspace/:workspaceId/messages/dm/:dmId" element={<><Messages /><Where /></>} />
            </Routes>
        </MemoryRouter>
    );
}

const WS = 'ws1';
const SESSION = { id: 'dm1', otherUserId: 'u2', otherUser: { _id: 'u2', username: 'chen' } };

beforeEach(() => vi.clearAllMocks());

describe('opening a DM on the Messages page', () => {
    test("a person's id opens the real DM, made by the server first", async () => {
        let made = false; // the DM exists only once the server has made it
        api.get.mockImplementation(async (url) => {
            if (url.endsWith('/dms')) return { data: { sessions: made ? [SESSION] : [] } };
            if (url.includes('/dm/resolve/u2')) { made = true; return { data: { success: true, dmSessionId: 'dm1' } }; }
            throw new Error(`unexpected ${url}`);
        });
        renderAt(`/workspace/${WS}/messages/dm/u2`);
        await waitFor(() => expect(screen.getByTestId('path').textContent).toBe(`/workspace/${WS}/messages/dm/dm1`));
        expect(await screen.findByText('dm:dm1')).toBeTruthy();
        expect(api.get).toHaveBeenCalledWith(`/api/v2/messages/workspace/${WS}/dm/resolve/u2`);
        // Never a chat under the person's id.
        expect(screen.queryByText('dm:u2')).toBeNull();
    });

    test('an existing DM opens by its own id without making anything', async () => {
        api.get.mockResolvedValue({ data: { sessions: [SESSION] } });
        renderAt(`/workspace/${WS}/messages/dm/dm1`);
        expect(await screen.findByText('dm:dm1')).toBeTruthy();
        expect(api.get.mock.calls.some(([u]) => u.includes('/dm/resolve/'))).toBe(false);
    });

    test("the person's id of an existing DM opens that DM", async () => {
        api.get.mockResolvedValue({ data: { sessions: [SESSION] } });
        renderAt(`/workspace/${WS}/messages/dm/u2`);
        expect(await screen.findByText('dm:dm1')).toBeTruthy();
    });
});
