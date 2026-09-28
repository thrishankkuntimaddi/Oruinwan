import { describe, it, expect } from 'vitest';
import {
    burstTitle, conversationInPath, createBurstCounter, decideMessageAlert,
    decideReminderAlert, decideStoredAlert, isViewingConversation, isViewingTarget,
} from './notificationPolicy';

const WS = 'a'.repeat(24);
const DM = 'd'.repeat(24);
const OTHER_DM = 'e'.repeat(24);
const CH = 'c'.repeat(24);
const ME = '1'.repeat(24);
const BOB = '2'.repeat(24);
const PARENT = 'f'.repeat(24);

const prefs = (over = {}) => ({ desktopPush: true, sound: true, mentionsOnly: false, dmNotifications: true, ...over });
const ctx = (over = {}) => ({
    currentUserId: ME,
    workspaceId: WS,
    pathname: `/workspace/${WS}/home`,
    visible: true,
    focused: true,
    otherTabActive: false,
    isLeader: true,
    canNotifyOs: true,
    openThreadId: null,
    ...over,
});
const dmActivity = (over = {}) => ({
    workspaceId: WS, conversationType: 'dm', conversationId: DM, senderId: BOB, isMention: false, muted: false, ...over,
});
const channelActivity = (over = {}) => ({
    workspaceId: WS, conversationType: 'channel', conversationId: CH, senderId: BOB, isMention: false, muted: false, ...over,
});
const hidden = { visible: false, focused: false };

describe('route helpers', () => {
    it('finds the open conversation in every chat route', () => {
        expect(conversationInPath(`/workspace/${WS}/dm/${DM}`)).toEqual({ type: 'dm', id: DM });
        expect(conversationInPath(`/workspace/${WS}/messages/dm/${DM}`)).toEqual({ type: 'dm', id: DM });
        expect(conversationInPath(`/workspace/${WS}/home/dm/${DM}`)).toEqual({ type: 'dm', id: DM });
        expect(conversationInPath(`/workspace/${WS}/channel/${CH}`)).toEqual({ type: 'channel', id: CH });
        expect(conversationInPath(`/workspace/${WS}/home/channel/${CH}/`)).toEqual({ type: 'channel', id: CH });
        expect(conversationInPath(`/workspace/${WS}/dm/new/${DM}`)).toBeNull();
        expect(conversationInPath(`/workspace/${WS}/tasks`)).toBeNull();
    });

    it('does not confuse a DM with a channel of the same id', () => {
        expect(isViewingConversation(`/workspace/${WS}/channel/${DM}`, 'dm', DM)).toBe(false);
        expect(isViewingConversation(`/workspace/${WS}/dm/${DM}`, 'dm', DM)).toBe(true);
    });

    it('recognises the task / meeting / note page a notification points at', () => {
        const task = { meta: { taskId: 't1' } };
        expect(isViewingTarget(`/workspace/${WS}/tasks/t1`, task)).toBe(true);
        expect(isViewingTarget(`/workspace/${WS}/tasks`, task)).toBe(false);
        expect(isViewingTarget(`/workspace/${WS}/meetings/m1`, { meta: { meetingId: 'm1' } })).toBe(true);
        expect(isViewingTarget(`/workspace/${WS}/huddles`, { meta: {} }, `/workspace/${WS}/huddles`)).toBe(true);
        expect(isViewingTarget(`/workspace/${WS}/huddles/x`, { meta: {} }, `/workspace/${WS}/huddles`)).toBe(false);
    });
});

describe('decideMessageAlert', () => {
    it('pops nothing for the conversation on screen (visible + focused) and does not count it', () => {
        const d = decideMessageAlert(dmActivity(), ctx({ pathname: `/workspace/${WS}/dm/${DM}` }), prefs());
        expect(d).toMatchObject({ count: false, markRead: true, toast: false, os: false, sound: false });
    });

    it('same for a channel on screen, even when it @mentions me', () => {
        const d = decideMessageAlert(channelActivity({ isMention: true }), ctx({ pathname: `/workspace/${WS}/channel/${CH}` }), prefs());
        expect(d).toMatchObject({ count: false, toast: false, os: false });
    });

    it('never alerts for my own messages', () => {
        const d = decideMessageAlert(dmActivity({ senderId: ME }), ctx(), prefs());
        expect(d).toMatchObject({ count: false, toast: false, os: false });
    });

    it('ignores other workspaces', () => {
        expect(decideMessageAlert(dmActivity({ workspaceId: 'b'.repeat(24) }), ctx(), prefs()).count).toBe(false);
    });

    it('elsewhere in the app: in-app toast (+sound) for a DM, never an OS notification', () => {
        const d = decideMessageAlert(dmActivity(), ctx({ pathname: `/workspace/${WS}/dm/${OTHER_DM}` }), prefs());
        expect(d).toMatchObject({ count: true, toast: true, os: false, sound: true });
    });

    it('sound follows the preference', () => {
        expect(decideMessageAlert(dmActivity(), ctx(), prefs({ sound: false })).sound).toBe(false);
    });

    it('channel messages without a mention only count', () => {
        const d = decideMessageAlert(channelActivity(), ctx(), prefs());
        expect(d).toMatchObject({ count: true, toast: false, os: false });
    });

    it('channel @mention toasts', () => {
        expect(decideMessageAlert(channelActivity({ isMention: true }), ctx(), prefs()).toast).toBe(true);
    });

    it('dmNotifications off silences DMs but still counts', () => {
        const d = decideMessageAlert(dmActivity(), ctx(), prefs({ dmNotifications: false }));
        expect(d).toMatchObject({ count: true, toast: false, os: false });
    });

    it('mentionsOnly keeps DMs and mentions', () => {
        expect(decideMessageAlert(dmActivity(), ctx(), prefs({ mentionsOnly: true })).toast).toBe(true);
        expect(decideMessageAlert(channelActivity({ isMention: true }), ctx(), prefs({ mentionsOnly: true })).toast).toBe(true);
        expect(decideMessageAlert(channelActivity(), ctx(), prefs({ mentionsOnly: true })).toast).toBe(false);
    });

    it('muted DM never alerts; muted channel only for a direct mention', () => {
        expect(decideMessageAlert(dmActivity({ muted: true }), ctx(), prefs())).toMatchObject({ count: true, toast: false });
        expect(decideMessageAlert(channelActivity({ muted: true, isMention: true, isDirectMention: false }), ctx(), prefs()).toast).toBe(false);
        expect(decideMessageAlert(channelActivity({ muted: true, isMention: true, isDirectMention: true }), ctx(), prefs()).toast).toBe(true);
    });

    it('workspace "Messages" toggle off silences message alerts', () => {
        const d = decideMessageAlert(dmActivity(), ctx(), { ...prefs(), workspace: { message: false } });
        expect(d).toMatchObject({ count: true, toast: false, os: false });
    });

    it('hidden tab: OS notification only (no toast), when desktopPush and permission allow', () => {
        const d = decideMessageAlert(dmActivity(), ctx(hidden), prefs());
        expect(d).toMatchObject({ count: true, toast: false, os: true, sound: false });
        expect(decideMessageAlert(dmActivity(), ctx(hidden), prefs({ desktopPush: false })).os).toBe(false);
        expect(decideMessageAlert(dmActivity(), ctx({ ...hidden, canNotifyOs: false }), prefs()).os).toBe(false);
    });

    it('hidden tab on the DM route still counts (the chat reads it only when visible)', () => {
        const d = decideMessageAlert(dmActivity(), ctx({ ...hidden, pathname: `/workspace/${WS}/dm/${DM}` }), prefs());
        expect(d).toMatchObject({ count: true, os: true });
    });

    it('visible but unfocused on the DM route: read (not counted), OS notification only', () => {
        const d = decideMessageAlert(dmActivity(), ctx({ focused: false, pathname: `/workspace/${WS}/dm/${DM}` }), prefs());
        expect(d).toMatchObject({ count: false, markRead: true, toast: false, os: true });
    });

    it('only one tab alerts: the active one, else the leader', () => {
        expect(decideMessageAlert(dmActivity(), ctx({ ...hidden, otherTabActive: true }), prefs())).toMatchObject({ count: true, toast: false, os: false });
        expect(decideMessageAlert(dmActivity(), ctx({ ...hidden, isLeader: false }), prefs()).os).toBe(false);
    });
});

describe('decideStoredAlert', () => {
    const n = (type, meta = {}, over = {}) => ({ _id: 'n1', workspaceId: WS, type, title: 't', body: 'b', meta, ...over });

    it('thread reply in the open thread: nothing, read', () => {
        const d = decideStoredAlert(
            n('thread_reply', { channelId: CH, parentMessageId: PARENT }),
            ctx({ pathname: `/workspace/${WS}/channel/${CH}`, openThreadId: PARENT }),
            prefs(),
        );
        expect(d).toMatchObject({ count: false, markRead: true, toast: false, os: false });
    });

    it('thread reply elsewhere: counts, no toast; OS when hidden; mentionsOnly keeps it in the bell', () => {
        const reply = n('thread_reply', { channelId: CH, parentMessageId: PARENT });
        expect(decideStoredAlert(reply, ctx(), prefs())).toMatchObject({ count: true, toast: false, os: false });
        expect(decideStoredAlert(reply, ctx(hidden), prefs())).toMatchObject({ count: true, os: true });
        expect(decideStoredAlert(reply, ctx(hidden), prefs({ mentionsOnly: true }))).toMatchObject({ count: true, os: false });
    });

    it('dm / mention notifications never pop here (the activity event does) and are read when on screen', () => {
        expect(decideStoredAlert(n('dm', { dmSessionId: DM }), ctx(), prefs())).toMatchObject({ count: true, toast: false, os: false });
        expect(decideStoredAlert(n('dm', { dmSessionId: DM }), ctx({ pathname: `/workspace/${WS}/dm/${DM}` }), prefs()))
            .toMatchObject({ count: false, markRead: true });
    });

    it('reactions only count', () => {
        expect(decideStoredAlert(n('reaction', { channelId: CH }), ctx(hidden), prefs())).toMatchObject({ count: true, toast: false, os: false });
    });

    it('task assigned: toast when active elsewhere, not on that task page; OS only when away', () => {
        const task = n('task_assigned', { taskId: 't9' });
        expect(decideStoredAlert(task, ctx(), prefs())).toMatchObject({ count: true, toast: true, os: false });
        expect(decideStoredAlert(task, ctx({ pathname: `/workspace/${WS}/tasks/t9` }), prefs())).toMatchObject({ count: true, toast: false, os: false });
        expect(decideStoredAlert(task, ctx(hidden), prefs())).toMatchObject({ count: true, toast: false, os: true });
    });

    it('mentionsOnly keeps non-message notifications in the bell', () => {
        expect(decideStoredAlert(n('meeting_reminder', { meetingId: 'm' }), ctx(hidden), prefs({ mentionsOnly: true })))
            .toMatchObject({ count: true, toast: false, os: false });
    });
});

describe('decideReminderAlert', () => {
    it('toast when active, OS when away', () => {
        expect(decideReminderAlert(ctx(), prefs())).toMatchObject({ toast: true, os: false });
        expect(decideReminderAlert(ctx(hidden), prefs())).toMatchObject({ toast: false, os: true });
    });
});

describe('bursts', () => {
    it('coalesces within the sliding window and restarts after a gap', () => {
        const c = createBurstCounter(5000);
        expect(c.hit('dm:x', 0)).toBe(1);
        expect(c.hit('dm:x', 1000)).toBe(2);
        expect(c.hit('dm:x', 5500)).toBe(3);
        expect(c.hit('dm:y', 5600)).toBe(1);
        expect(c.hit('dm:x', 20000)).toBe(1);
        c.reset();
        expect(c.size()).toBe(0);
    });

    it('titles a burst', () => {
        expect(burstTitle('bob', 1)).toBe('bob');
        expect(burstTitle('bob', 3)).toBe('3 new messages from bob');
        expect(burstTitle('bob', 2, ' · #general')).toBe('2 new messages from bob · #general');
    });
});
