import { describe, it, expect, vi } from 'vitest';
import { compactHeaderActions } from '../features/messaging/chatWindowComp/header/header.jsx';
import { markReadKey, sendMarkRead } from '../features/messaging/chatWindowComp/helpers/markRead.js';

const noop = () => {};

describe('chat header at phone width', () => {
    it('a DM: voice and video calls, reminders, pinned and saved move into the ⋮ menu', () => {
        const items = compactHeaderActions({
            chat: { type: 'dm' }, onStartHuddle: noop, onStartVideoCall: noop, onShowReminders: noop, onShowPinned: noop, onShowBookmarks: noop,
        });
        expect(items.map(i => i.label)).toEqual(['Voice call', 'Video call', 'Reminders', 'Pinned messages', 'Saved messages']);
    });

    it('a channel: huddle and poll first', () => {
        const run = vi.fn();
        const items = compactHeaderActions({ chat: { type: 'channel' }, onStartHuddle: run, onCreatePoll: noop, onShowReminders: noop, onShowPinned: noop, onShowBookmarks: noop });
        expect(items.map(i => i.label)).toEqual(['Start huddle', 'Create poll', 'Reminders', 'Pinned messages', 'Saved messages']);
        items[0].run();
        expect(run).toHaveBeenCalled();
    });

    it('an AI agent DM has no calls; missing handlers leave items out', () => {
        const items = compactHeaderActions({ chat: { type: 'dm', isAgent: true }, onStartHuddle: noop, onStartVideoCall: noop, onShowPinned: noop });
        expect(items.map(i => i.label)).toEqual(['Pinned messages']);
    });
});

describe('marking a conversation read', () => {
    it('uses the socket when it is connected', () => {
        const socket = { connected: true, emit: vi.fn() };
        const post = vi.fn();
        expect(sendMarkRead({ socket, post, type: 'dm', id: 'd1', receipts: false })).toBe('socket');
        expect(socket.emit).toHaveBeenCalledWith('mark-chat-read', { type: 'dm', id: 'd1', receipts: false });
        expect(post).not.toHaveBeenCalled();
    });

    it('falls back to REST before the socket connects, so the read is not dropped', async () => {
        const socket = { connected: false, emit: vi.fn() };
        const post = vi.fn().mockResolvedValue({});
        expect(sendMarkRead({ socket, post, type: 'channel', id: 'c1' })).toBe('rest');
        await Promise.resolve();
        expect(post).toHaveBeenCalledWith('/api/chat/reset-unread', { type: 'channel', id: 'c1', receipts: true });
        expect(socket.emit).not.toHaveBeenCalled();
    });

    it('reports a failed REST read so it can be retried', async () => {
        const onError = vi.fn();
        sendMarkRead({ socket: null, post: () => Promise.reject(new Error('offline')), type: 'dm', id: 'd1', onError });
        await new Promise(r => setTimeout(r, 0));
        expect(onError).toHaveBeenCalled();
    });

    it('sends again once the socket connects (the key changes with the connection)', () => {
        const base = { type: 'dm', id: 'd1', latestEventId: 'm9' };
        expect(markReadKey({ ...base, connected: false })).not.toBe(markReadKey({ ...base, connected: true }));
        expect(markReadKey({ ...base, connected: true })).toBe(markReadKey({ ...base, connected: true }));
        expect(markReadKey({ ...base, latestEventId: 'm10', connected: true })).not.toBe(markReadKey({ ...base, connected: true }));
    });
});
