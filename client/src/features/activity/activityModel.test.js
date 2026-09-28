import { describe, it, expect } from 'vitest';
import {
    ACTIVITY_LIMIT, activityCounts, activityHref, buildActivityRows, clearMention, convKey,
    filterActivityRows, metaFromActivityEvent, metaFromServerItem, shortAgo, sortActivityRows,
} from './activityModel';

const WS = 'a'.repeat(24);
const ME = '1'.repeat(24);
const BOB = '2'.repeat(24);
const DM = 'd'.repeat(24);
const DM2 = 'e'.repeat(24);
const CH = 'c'.repeat(24);
const CH2 = 'b'.repeat(24);
const PARENT = 'f'.repeat(24);

const dmItem = (over = {}) => ({
    type: 'dm', id: DM, unread: 2, mentioned: false, muted: false,
    otherUser: { id: BOB, username: 'bob', profilePicture: 'b.png', status: 'active' },
    lastMessage: { id: 'm1', senderId: BOB, preview: { ciphertext: 'x', messageIv: 'y' }, createdAt: '2026-09-28T10:00:00Z' },
    ...over,
});
const chItem = (over = {}) => ({
    type: 'channel', id: CH, name: 'general', unread: 3, mentioned: false, muted: false,
    lastMessage: { id: 'm2', senderId: BOB, senderUsername: 'bob', createdAt: '2026-09-28T09:00:00Z' },
    ...over,
});

function build({ items = [], unread = {}, mentions = {}, notifications = [], open = null } = {}) {
    const conversations = new Map(items.map(i => {
        const m = metaFromServerItem(i);
        return [convKey(m.type, m.id), m];
    }));
    return buildActivityRows({
        conversations,
        unreadOf: (t, id) => unread[convKey(t, id)] || 0,
        mentionOf: (t, id) => !!mentions[convKey(t, id)],
        notifications,
        openConversation: open,
        currentUserId: ME,
        workspaceId: WS,
    });
}

const notif = (over = {}) => ({ _id: `n${Math.random()}`, workspaceId: WS, read: false, createdAt: '2026-09-28T08:00:00Z', meta: {}, ...over });

describe('metaFromServerItem', () => {
    it('maps a DM to the other person', () => {
        const m = metaFromServerItem(dmItem());
        expect(m).toMatchObject({ type: 'dm', id: DM, title: 'bob', avatar: 'b.png', userId: BOB, status: 'active' });
        expect(m.last).toMatchObject({ id: 'm1', senderName: 'bob', at: '2026-09-28T10:00:00Z', text: null });
    });
    it('maps a channel with its sender and kind label', () => {
        const m = metaFromServerItem(chItem({ lastMessage: { id: 'm', kindLabel: '📷 Photo', senderUsername: 'carol' } }));
        expect(m).toMatchObject({ title: 'general', avatar: null });
        expect(m.last).toMatchObject({ senderName: 'carol', text: '📷 Photo' });
    });
    it('rejects junk', () => {
        expect(metaFromServerItem(null)).toBeNull();
        expect(metaFromServerItem({ type: 'x', id: '1' })).toBeNull();
    });
});

describe('metaFromActivityEvent', () => {
    const payload = {
        workspaceId: WS, conversationType: 'channel', conversationId: CH, channelName: 'general', messageId: 'm9',
        senderId: BOB, senderUsername: 'bob', isMention: true, isDirectMention: true, muted: false, createdAt: '2026-09-28T12:00:00Z',
    };
    it('creates a record from a live event and remembers the mention', () => {
        const m = metaFromActivityEvent(undefined, payload, 'hello @alice');
        expect(m).toMatchObject({ type: 'channel', id: CH, title: 'general', mentioned: true, directMention: true });
        expect(m.last).toMatchObject({ id: 'm9', text: 'hello @alice', senderName: 'bob' });
    });
    it('keeps an earlier mention when a plain message follows', () => {
        const first = metaFromActivityEvent(undefined, payload, 'a');
        const next = metaFromActivityEvent(first, { ...payload, isMention: false, isDirectMention: false, messageId: 'm10' }, 'b');
        expect(next.mentioned).toBe(true);
        expect(next.last.text).toBe('b');
    });
    it('DM events take the sender as the title', () => {
        const m = metaFromActivityEvent(undefined, { ...payload, conversationType: 'dm', conversationId: DM, senderAvatar: 'b.png' }, 'hi');
        expect(m).toMatchObject({ title: 'bob', avatar: 'b.png', userId: BOB });
    });
    it('clearMention resets the flags', () => {
        const m = clearMention(metaFromActivityEvent(undefined, payload, 'x'));
        expect(m.mentioned).toBe(false);
        expect(m.directMention).toBe(false);
    });
});

describe('buildActivityRows', () => {
    it('only lists conversations that are unread (per the shared counters), newest first', () => {
        const rows = build({
            items: [dmItem(), chItem(), dmItem({ id: DM2, lastMessage: { createdAt: '2026-09-28T11:00:00Z' } })],
            unread: { [convKey('dm', DM)]: 2, [convKey('channel', CH)]: 3 },
        });
        expect(rows.map(r => r.key)).toEqual([convKey('dm', DM), convKey('channel', CH)]);
        expect(rows[0]).toMatchObject({ kind: 'dm', unread: 2, title: 'bob' });
    });

    it('never lists the conversation that is open', () => {
        const rows = build({ items: [dmItem()], unread: { [convKey('dm', DM)]: 1 }, open: { type: 'dm', id: DM } });
        expect(rows).toEqual([]);
    });

    it('hides muted conversations unless I was directly @mentioned', () => {
        const unread = { [convKey('channel', CH)]: 1, [convKey('channel', CH2)]: 1, [convKey('dm', DM)]: 1 };
        const rows = build({
            items: [chItem({ muted: true }), chItem({ id: CH2, muted: true, mentioned: true }), dmItem({ muted: true })],
            unread,
        });
        expect(rows.map(r => r.convId)).toEqual([CH2]);
    });

    it('a live @mention (context flag) marks the channel row', () => {
        const rows = build({ items: [chItem()], unread: { [convKey('channel', CH)]: 1 }, mentions: { [convKey('channel', CH)]: true } });
        expect(rows[0].mentioned).toBe(true);
    });

    it('folds dm/mention bell items into their conversation row', () => {
        const n1 = notif({ type: 'dm', meta: { dmSessionId: DM } });
        const n2 = notif({ type: 'mention', meta: { channelId: CH }, createdAt: '2026-09-28T13:00:00Z' });
        const rows = build({
            items: [dmItem(), chItem()],
            unread: { [convKey('dm', DM)]: 1, [convKey('channel', CH)]: 1 },
            notifications: [n1, n2],
        });
        expect(rows).toHaveLength(2);
        const ch = rows.find(r => r.kind === 'channel');
        expect(ch.mentioned).toBe(true);
        expect(ch.notificationIds).toEqual([n2._id]);
        // The mention's time moves the channel to the top.
        expect(rows[0].kind).toBe('channel');
    });

    it('keeps a bell mention whose conversation has no unread as its own row', () => {
        const n = notif({ type: 'mention', title: 'bob mentioned you', meta: { channelId: CH } });
        const rows = build({ notifications: [n] });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ kind: 'notification', mentioned: true, notificationType: 'mention' });
    });

    it('groups thread replies per thread', () => {
        const a = notif({ type: 'thread_reply', body: 'first', meta: { channelId: CH, channelName: 'general', parentMessageId: PARENT, senderUsername: 'bob' }, createdAt: '2026-09-28T08:00:00Z' });
        const b = notif({ type: 'thread_reply', body: 'second', meta: { channelId: CH, channelName: 'general', parentMessageId: PARENT, senderUsername: 'carol' }, createdAt: '2026-09-28T09:00:00Z' });
        const rows = build({ notifications: [a, b] });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ kind: 'thread', unread: 2, preview: 'second', senderName: 'carol', title: 'Thread in #general', parentMessageId: PARENT });
        expect(rows[0].notificationIds).toHaveLength(2);
    });

    it('lists other unread bell items; skips read ones, other workspaces and my own', () => {
        const rows = build({
            notifications: [
                notif({ type: 'task_assigned', title: 'Task assigned' }),
                notif({ type: 'huddle_started', read: true }),
                notif({ type: 'task_assigned', workspaceId: 'z'.repeat(24) }),
                notif({ type: 'reaction', meta: { senderId: ME } }),
                notif({ type: 'digest', title: 'You have 3 unread notifications' }),
            ],
        });
        expect(rows.map(r => r.notificationType)).toEqual(['task_assigned']);
    });
});

describe('filters, counts, sorting', () => {
    const rows = [
        { key: 'dm:1', kind: 'dm', mentioned: false, at: 3 },
        { key: 'channel:1', kind: 'channel', mentioned: true, at: 2 },
        { key: 'channel:2', kind: 'channel', mentioned: false, at: 1 },
        { key: 'notif:1', kind: 'notification', notificationType: 'task_assigned', at: 4 },
        { key: 'notif:2', kind: 'notification', notificationType: 'dm', at: 0 },
    ];
    it('filters by tab', () => {
        expect(filterActivityRows(rows, 'all')).toHaveLength(5);
        expect(filterActivityRows(rows, 'mentions').map(r => r.key)).toEqual(['channel:1']);
        expect(filterActivityRows(rows, 'dms').map(r => r.key)).toEqual(['dm:1', 'notif:2']);
    });
    it('counts per tab', () => {
        expect(activityCounts(rows)).toEqual({ all: 5, mentions: 1, dms: 2 });
    });
    it('sorts newest first, mentions/DMs first on ties', () => {
        expect(sortActivityRows(rows).map(r => r.key)).toEqual(['notif:1', 'dm:1', 'channel:1', 'channel:2', 'notif:2']);
        const tie = sortActivityRows([
            { key: 'channel:x', kind: 'channel', mentioned: false, at: 5 },
            { key: 'channel:y', kind: 'channel', mentioned: true, at: 5 },
            { key: 'dm:z', kind: 'dm', at: 5 },
        ]);
        expect(tie.map(r => r.key)).toEqual(['channel:y', 'dm:z', 'channel:x']);
    });
    it('exposes a sane default limit', () => {
        expect(ACTIVITY_LIMIT).toBe(8);
    });
});

describe('activityHref', () => {
    const nh = (n, ws) => `/workspace/${ws}${n.link}`;
    it('routes conversations inside Home on desktop and to the app routes on mobile', () => {
        expect(activityHref({ kind: 'dm', convType: 'dm', convId: DM }, WS)).toBe(`/workspace/${WS}/home/dm/${DM}`);
        expect(activityHref({ kind: 'channel', convType: 'channel', convId: CH }, WS)).toBe(`/workspace/${WS}/home/channel/${CH}`);
        expect(activityHref({ kind: 'dm', convType: 'dm', convId: DM }, WS, { base: 'app' })).toBe(`/workspace/${WS}/messages/dm/${DM}`);
        expect(activityHref({ kind: 'thread', convType: 'channel', convId: CH }, WS, { base: 'app' })).toBe(`/workspace/${WS}/channel/${CH}`);
    });
    it('uses the notification link for other items', () => {
        expect(activityHref({ kind: 'notification', notification: { link: '/tasks/1' } }, WS, { notificationHref: nh })).toBe(`/workspace/${WS}/tasks/1`);
        expect(activityHref({ kind: 'notification', notification: {} }, WS)).toBeNull();
    });
});

describe('shortAgo', () => {
    const now = Date.parse('2026-09-28T12:00:00Z');
    it('formats compactly', () => {
        expect(shortAgo(0, now)).toBe('');
        expect(shortAgo(now - 10_000, now)).toBe('now');
        expect(shortAgo(now - 5 * 60_000, now)).toBe('5m');
        expect(shortAgo(now - 3 * 3_600_000, now)).toBe('3h');
        expect(shortAgo(now - 2 * 86_400_000, now)).toBe('2d');
    });
});
