'use strict';

jest.mock('../notification.model', () => ({
    find: jest.fn(),
    updateMany: jest.fn(),
    aggregate: jest.fn(),
}));
jest.mock('../notificationClaim.model', () => ({ claim: jest.fn() }));
jest.mock('../notificationService', () => ({
    createMany: jest.fn().mockResolvedValue([]),
    aiSuggestion: jest.fn().mockResolvedValue({}),
    taskLink: (ws, id) => (id ? `/workspace/${ws}/tasks/${id}` : `/workspace/${ws}/tasks`),
}));
jest.mock('../notificationPreferenceService', () => ({ getUserPreferences: jest.fn() }));
jest.mock('../emailNotificationService', () => ({ sendEmailNotification: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../identity', () => ({
    users: { findManyByIds: jest.fn() },
    workspaces: { findById: jest.fn() },
}));
jest.mock('../../../features/presence/presence.service', () => ({ getPresenceAsync: jest.fn() }));
jest.mock('../../../models/ScheduledMeeting', () => ({ find: jest.fn() }));
jest.mock('../../../../models/Task', () => ({ find: jest.fn() }));
jest.mock('../../../features/tasks/tasks.store', () => ({ tasksStore: () => 'mongo' }));

const Notification = require('../notification.model');
const { claim } = require('../notificationClaim.model');
const notifService = require('../notificationService');
const prefs = require('../notificationPreferenceService');
const email = require('../emailNotificationService');
const identity = require('../../../identity');
const presence = require('../../../features/presence/presence.service');
const ScheduledMeeting = require('../../../models/ScheduledMeeting');
const Task = require('../../../../models/Task');
const jobs = require('../notificationJobs');
const { offlineActivityTemplate, notificationDigestTemplate } = require('../../../../utils/emailTemplates');

/** Chainable mongoose query stub resolving to `rows`. */
function q(rows) {
    const c = { select: () => c, sort: () => c, limit: () => c, lean: () => Promise.resolve(rows) };
    return c;
}

const WS = '64b000000000000000000001';
const NOW = new Date('2026-10-19T09:00:00Z'); // a Monday, 09:00 UTC

beforeEach(() => {
    jest.clearAllMocks();
    claim.mockResolvedValue(true);
});

describe('meeting reminders', () => {
    test('reminds organizer + participants once, linking the meeting', async () => {
        ScheduledMeeting.find.mockReturnValue(q([{
            _id: 'm1', workspaceId: WS, title: 'Standup', startTime: new Date(NOW.getTime() + 9 * 60000),
            participants: ['u2', 'u3', 'u1'], createdBy: 'u1',
        }]));
        const out = await jobs.sendMeetingReminders(null, { now: NOW });
        expect(out.meetings).toBe(1);
        expect(claim).toHaveBeenCalledWith(`meeting-reminder:m1:${NOW.getTime() + 9 * 60000}`);
        const [, recipients, payload] = notifService.createMany.mock.calls[0];
        expect(recipients).toEqual(['u1', 'u2', 'u3']);
        expect(payload).toMatchObject({ type: 'meeting_reminder', title: 'Meeting starting in 9 min', link: '/meetings/m1', workspaceId: WS });
        const filter = ScheduledMeeting.find.mock.calls[0][0];
        expect(filter.status).toBe('scheduled');
        expect(filter.startTime.$lte.getTime() - NOW.getTime()).toBe(10 * 60000);
    });

    test('already claimed → nothing sent', async () => {
        claim.mockResolvedValue(false);
        ScheduledMeeting.find.mockReturnValue(q([{ _id: 'm1', workspaceId: WS, title: 'x', startTime: NOW, createdBy: 'u1' }]));
        expect((await jobs.sendMeetingReminders(null, { now: NOW })).meetings).toBe(0);
        expect(notifService.createMany).not.toHaveBeenCalled();
    });
});

describe('ai suggestions', () => {
    test('groupOverdue groups per assignee and workspace and keeps the oldest', () => {
        const g = jobs.groupOverdue([
            { _id: 't1', title: 'A', dueDate: new Date('2026-10-10'), assignedTo: ['u1', 'u2'], workspace: WS },
            { _id: 't2', title: 'B', dueDate: new Date('2026-10-01'), assignedTo: ['u1'], workspace: WS },
            { _id: 't3', title: 'no ws', dueDate: new Date(), assignedTo: ['u1'] },
        ]);
        const u1 = g.find((x) => x.userId === 'u1');
        expect(u1.count).toBe(2);
        expect(u1.oldest._id).toBe('t2');
        expect(g.find((x) => x.userId === 'u2').count).toBe(1);
    });

    test('overdue nudge once per day and meeting action items for organizer and assignees', async () => {
        Task.find.mockReturnValue(q([{ _id: 't1', title: 'Ship it', dueDate: new Date('2026-10-18'), assignedTo: ['u1'], workspace: WS }]));
        ScheduledMeeting.find.mockReturnValue(q([
            { _id: 'm1', workspaceId: WS, title: 'Planning', createdBy: 'u1', actionItems: [
                { text: 'a', status: 'pending', assignedTo: 'u5' },
                { text: 'b', status: 'pending', taskId: 'already' },
                { text: 'c', status: 'done', assignedTo: 'u6' },
            ] },
            { _id: 'm2', workspaceId: WS, title: 'Done all', createdBy: 'u1', actionItems: [{ text: 'x', status: 'done' }] },
        ]));
        const out = await jobs.sendAiSuggestions(null, { now: NOW });
        expect(out).toEqual({ overdue: 1, meetings: 1 });
        expect(claim).toHaveBeenCalledWith(`ai:overdue:u1:${WS}:2026-10-19`);
        expect(claim).toHaveBeenCalledWith('ai:meeting-actions:m1');
        const calls = notifService.aiSuggestion.mock.calls.map((c) => c[1]);
        expect(calls[0]).toMatchObject({ userId: 'u1', title: 'You have an overdue task', link: `/workspace/${WS}/tasks/t1` });
        expect(calls[1]).toMatchObject({ userId: 'u1', link: '/meetings/m1', meta: expect.objectContaining({ count: 1 }) });
        expect(calls[2]).toMatchObject({ userId: 'u5' });
        expect(calls).toHaveLength(3);
    });
});

describe('offline mention / DM emails', () => {
    const old = new Date(NOW.getTime() - 30 * 60000);
    const notifs = [
        { _id: 'n1', recipient: 'u1', workspaceId: WS, type: 'mention', link: '/channel/c1', meta: { senderUsername: 'alice', channelName: 'general' }, createdAt: old },
        { _id: 'n2', recipient: 'u1', workspaceId: WS, type: 'mention', link: '/channel/c1', meta: { senderUsername: 'alice', channelName: 'general' }, createdAt: old },
        { _id: 'n3', recipient: 'u1', workspaceId: WS, type: 'dm', link: '/dm/d1', meta: { senderUsername: 'bob' }, createdAt: old },
    ];

    beforeEach(() => {
        Notification.find.mockReturnValue(q(notifs));
        Notification.updateMany.mockResolvedValue({ modifiedCount: 3 });
        identity.users.findManyByIds.mockResolvedValue(new Map([['u1', { _id: 'u1', email: 'u1@x.io', firstName: 'Una', preferences: {} }]]));
        presence.getPresenceAsync.mockResolvedValue(null);
        prefs.getUserPreferences.mockResolvedValue({ email: true, message: true });
    });

    test('sends one summary email with who/where only, and marks them emailed', async () => {
        const out = await jobs.sendOfflineEmails(null, { now: NOW });
        expect(out.emails).toBe(1);
        expect(Notification.updateMany).toHaveBeenCalledWith({ _id: { $in: ['n1', 'n2', 'n3'] }, emailedAt: null }, { $set: { emailedAt: NOW } });
        const mail = email.sendEmailNotification.mock.calls[0][0];
        expect(mail.to).toBe('u1@x.io');
        expect(mail.subject).toBe('alice mentioned you in #general (+2 more)');
        expect(mail.text).toContain('alice mentioned you in #general (2)');
        expect(mail.text).toContain('bob sent you a direct message');
        // the query is scoped to unread, unemailed mentions/DMs older than N minutes
        const filter = Notification.find.mock.calls[0][0];
        expect(filter).toMatchObject({ type: { $in: ['mention', 'dm'] }, read: false, emailedAt: null });
        expect(NOW.getTime() - filter.createdAt.$lte.getTime()).toBe(15 * 60000);
    });

    test('online user: nothing sent and nothing marked (re-checked later)', async () => {
        presence.getPresenceAsync.mockResolvedValue({ status: 'online', lastSeen: NOW });
        await jobs.sendOfflineEmails(null, { now: NOW });
        expect(Notification.updateMany).not.toHaveBeenCalled();
        expect(email.sendEmailNotification).not.toHaveBeenCalled();
    });

    test('recently disconnected user is not emailed yet', async () => {
        identity.users.findManyByIds.mockResolvedValue(new Map([['u1', { _id: 'u1', email: 'u1@x.io', lastActivityAt: new Date(NOW.getTime() - 2 * 60000) }]]));
        await jobs.sendOfflineEmails(null, { now: NOW });
        expect(email.sendEmailNotification).not.toHaveBeenCalled();
    });

    test('workspace email preference off → marked but not sent', async () => {
        prefs.getUserPreferences.mockResolvedValue({ email: false, message: true });
        await jobs.sendOfflineEmails(null, { now: NOW });
        expect(Notification.updateMany).toHaveBeenCalled();
        expect(email.sendEmailNotification).not.toHaveBeenCalled();
    });

    test('account dmNotifications off → DMs dropped from the email', async () => {
        identity.users.findManyByIds.mockResolvedValue(new Map([['u1', { _id: 'u1', email: 'u1@x.io', preferences: { notifications: { dmNotifications: false } } }]]));
        await jobs.sendOfflineEmails(null, { now: NOW });
        expect(email.sendEmailNotification.mock.calls[0][0].text).not.toContain('bob');
    });

    test('lost the claim to another instance → not sent', async () => {
        Notification.updateMany.mockResolvedValue({ modifiedCount: 0 });
        await jobs.sendOfflineEmails(null, { now: NOW });
        expect(email.sendEmailNotification).not.toHaveBeenCalled();
    });
});

describe('digest emails', () => {
    const rows = [
        { _id: { recipient: 'u1', workspaceId: WS, type: 'mention' }, week: 5, day: 2, unread: 1 },
        { _id: { recipient: 'u1', workspaceId: WS, type: 'task_assigned' }, week: 3, day: 0, unread: 0 },
        { _id: { recipient: 'u2', workspaceId: WS, type: 'dm' }, week: 4, day: 1, unread: 4 },
        { _id: { recipient: 'u3', workspaceId: WS, type: 'dm' }, week: 4, day: 1, unread: 0 },
    ];
    beforeEach(() => {
        Notification.aggregate.mockResolvedValue(rows);
        identity.workspaces.findById.mockResolvedValue({ name: 'Acme' });
        identity.users.findManyByIds.mockResolvedValue(new Map([
            ['u1', { email: 'u1@x.io', preferences: {} }], // daily (default)
            ['u2', { email: 'u2@x.io', preferences: { notifications: { digestFrequency: 'weekly' } } }],
            ['u3', { email: 'u3@x.io', preferences: { notifications: { emailDigest: false } } }],
        ]));
    });

    test('daily and weekly (Monday) digests with counts only; opted-out users skipped', async () => {
        const out = await jobs.sendDigestEmails(null, { now: NOW });
        expect(out.emails).toBe(2);
        expect(claim).toHaveBeenCalledWith('digest:d:u1:2026-10-19');
        expect(claim).toHaveBeenCalledWith('digest:w:u2:2026-10-19');
        const mails = email.sendEmailNotification.mock.calls.map((c) => c[0]);
        expect(mails.map((m) => m.to).sort()).toEqual(['u1@x.io', 'u2@x.io']);
        const daily = mails.find((m) => m.to === 'u1@x.io');
        expect(daily.subject).toBe('Your daily Oruinwan digest');
        expect(daily.text).toContain('Mentions: 2');
        expect(daily.text).not.toContain('Tasks assigned'); // 0 today
        expect(daily.text).toContain('Acme');
        expect(mails.find((m) => m.to === 'u2@x.io').text).toContain('Direct messages: 4');
    });

    test('weekly subscribers are skipped on other days; nothing before the digest hour', async () => {
        const tuesday = new Date('2026-10-20T09:00:00Z');
        await jobs.sendDigestEmails(null, { now: tuesday });
        expect(email.sendEmailNotification.mock.calls.map((c) => c[0].to)).toEqual(['u1@x.io']);

        jest.clearAllMocks();
        const early = new Date('2026-10-20T03:00:00Z');
        expect((await jobs.sendDigestEmails(null, { now: early })).emails).toBe(0);
        expect(Notification.aggregate).not.toHaveBeenCalled();
    });
});

describe('helpers and templates', () => {
    test('weekKey is the Monday of the week', () => {
        expect(jobs.weekKey(new Date('2026-10-25T12:00:00Z'))).toBe('2026-10-19');
        expect(jobs.weekKey(new Date('2026-10-19T00:00:00Z'))).toBe('2026-10-19');
    });

    test('templates escape names and never need message content', () => {
        const t = offlineActivityTemplate('<b>x</b>', [{ text: '<script> mentioned you in #a', count: 1, url: 'https://x/c' }], 'https://x');
        expect(t.html).not.toContain('<script>');
        expect(t.html).toContain('&lt;script&gt;');
        const d = notificationDigestTemplate('Una', 'weekly', [{ workspaceName: 'Acme', lines: [{ label: 'Mentions', count: 3 }] }], 'https://x');
        expect(d.subject).toBe('Your weekly Oruinwan digest');
        expect(d.html).toContain('https://x/notifications');
    });
});
