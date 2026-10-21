// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { conversationOnScreen, decideMessageAlert, decideStoredAlert } from './notificationPolicy';
import { buildActivityRows } from '../activity/activityModel';
import { OPEN_THREAD_EVENT, clearOpenThread, getOpenThread, setOpenThread } from './attention';

const WS = 'w'.repeat(24);
const DM = 'd'.repeat(24);
const CH = 'c'.repeat(24);
const ACTIVE = { workspaceId: WS, currentUserId: 'me', visible: true, focused: true, isLeader: true, canNotifyOs: true };

describe('split view counts as on screen', () => {
    it('a DM in the split pane is read, not alerted', () => {
        const ctx = { ...ACTIVE, pathname: `/workspace/${WS}/channel/${CH}`, panePath: `/workspace/${WS}/messages/dm/${DM}` };
        expect(conversationOnScreen(ctx, 'dm', DM)).toBe(true);
        const decision = decideMessageAlert({ workspaceId: WS, conversationType: 'dm', conversationId: DM, senderId: 'ben' }, ctx, {});
        expect(decision).toMatchObject({ markRead: true, count: false, toast: false });
    });
});

describe('Do not disturb', () => {
    it('counts but never pops up or plays a sound', () => {
        const ctx = { ...ACTIVE, pathname: `/workspace/${WS}/home`, dnd: true };
        const msg = decideMessageAlert({ workspaceId: WS, conversationType: 'dm', conversationId: DM, senderId: 'ben' }, ctx, {});
        expect(msg).toMatchObject({ count: true, toast: false, os: false, sound: false });
        const stored = decideStoredAlert({ workspaceId: WS, type: 'task_assigned', meta: {} }, ctx, {});
        expect(stored).toMatchObject({ count: true, toast: false, os: false, sound: false });
    });

    it('a notification the server marked silent is quiet too', () => {
        const ctx = { ...ACTIVE, pathname: `/workspace/${WS}/home`, silent: true };
        expect(decideStoredAlert({ workspaceId: WS, type: 'task_assigned', meta: {} }, ctx, {})).toMatchObject({ toast: false, sound: false });
    });
});

describe('grouped rows in Activity', () => {
    it('a grouped DM row shows its message count and latest time', () => {
        const rows = buildActivityRows({
            conversations: {},
            notifications: [{
                _id: 'n1', type: 'dm', read: false, workspaceId: WS, title: 'ben · 5 new messages',
                createdAt: '2026-10-22T08:00:00Z', updatedAt: '2026-10-22T09:00:00Z',
                meta: { dmSessionId: DM, count: 5, senderUsername: 'ben' },
            }],
            workspaceId: WS,
        });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ unread: 5, title: 'ben · 5 new messages', at: Date.parse('2026-10-22T09:00:00Z') });
    });

    it('a grouped thread row counts every reply', () => {
        const rows = buildActivityRows({
            conversations: {},
            notifications: [{ _id: 'n2', type: 'thread_reply', read: false, workspaceId: WS, meta: { channelId: CH, parentMessageId: 'p1', count: 3 } }],
            workspaceId: WS,
        });
        expect(rows[0]).toMatchObject({ kind: 'thread', unread: 3 });
    });
});

describe('open thread', () => {
    it('announces changes so the server learns what is on screen', () => {
        const seen = [];
        const onThread = (e) => seen.push(e.detail);
        window.addEventListener(OPEN_THREAD_EVENT, onThread);
        setOpenThread('p1');
        setOpenThread('p1'); // unchanged: no event
        clearOpenThread('other'); // not the open one: no event
        clearOpenThread('p1');
        window.removeEventListener(OPEN_THREAD_EVENT, onThread);
        expect(seen).toEqual(['p1', null]);
        expect(getOpenThread()).toBeNull();
    });
});
