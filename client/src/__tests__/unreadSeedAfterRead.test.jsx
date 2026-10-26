// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@services/api', () => ({ default: { get: vi.fn(async () => ({ data: { notifications: [], unreadCount: 0, pages: 1 } })), patch: vi.fn(async () => ({})) } }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(async () => ({ data: {} })) } }));
vi.mock('../contexts/SocketContext', () => ({ useSocket: () => ({ addNotificationListener: () => () => {}, socket: null }) }));
vi.mock('../contexts/WorkspaceContext', () => ({ useWorkspace: () => ({ activeWorkspace: { id: 'w1' } }) }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ accessToken: 't', user: { sub: 'me' } }) }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../features/notifications/NotificationPermissionPrompt', () => ({ default: () => null }));
vi.mock('../features/notifications/accountNotificationPrefs', async (orig) => ({ ...(await orig()), fetchAccountNotificationPrefs: vi.fn(async () => ({})) }));

import { NotificationsProvider, useNotifications } from '../features/notifications/NotificationsContext';

describe('unread counts after reading a chat', () => {
    it('a list loaded just after the chat was read does not bring its count back', async () => {
        let ctx;
        const Probe = () => { ctx = useNotifications(); return null; };
        render(<MemoryRouter initialEntries={['/workspace/w1/home']}><NotificationsProvider><Probe /></NotificationsProvider></MemoryRouter>);
        await act(async () => { ctx.seedConversationUnread('dm', [{ id: 'd1', unread: 2 }, { id: 'd2', unread: 1 }]); });
        expect(ctx.getUnread('dm', 'd1')).toBe(2);
        await act(async () => { ctx.clearConversationUnread('dm', 'd1'); });
        // The Messages list answered with the count from before the read reached the server.
        await act(async () => { ctx.seedConversationUnread('dm', [{ id: 'd1', unread: 2 }, { id: 'd2', unread: 1 }]); });
        expect(ctx.getUnread('dm', 'd1')).toBe(0);
        expect(ctx.getUnread('dm', 'd2')).toBe(1);
    });
});
