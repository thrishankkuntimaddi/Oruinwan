'use strict';

jest.mock('../automation.model', () => {
    const m = { find: jest.fn(), findOne: jest.fn(), updateOne: jest.fn(), countDocuments: jest.fn(), create: jest.fn() };
    m.ACTION_TYPES = ['send_message', 'create_task', 'assign_task', 'send_notification', 'call_webhook', 'post_to_slack', 'trigger_ci_pipeline'];
    return m;
});
jest.mock('../automationRun.model', () => ({ create: jest.fn(async (d) => ({ _id: 'run1', ...d })), find: jest.fn() }));
jest.mock('../../../identity/hydrate', () => ({ hydrate: jest.fn(async (x) => x), userSelect: jest.fn() }));
jest.mock('../../../identity/queries/security', () => ({ upsertSystemUser: jest.fn(async () => ({ _id: 'bot1', username: 'Automations' })) }));
jest.mock('../../../modules/conversations/cryptoUtils', () => ({ encryptForConversation: jest.fn(async () => ({ ciphertext: 'C', messageIv: 'I' })) }));
jest.mock('../../../modules/messages/messages.service', () => ({ createMessage: jest.fn(async () => ({ _id: 'msg1' })) }));
jest.mock('../../channels/channel.model.js', () => ({ findOne: jest.fn() }));
jest.mock('../../tasks/tasks.query', () => ({
    create: jest.fn(async (d) => ({ _id: 'task1', ...d })),
    findById: jest.fn(),
    updateById: jest.fn(),
}));
jest.mock('../../tasks/tasks.shared', () => ({ emitToTaskAudience: jest.fn(), loadTaskForClient: jest.fn() }));
jest.mock('../../../modules/notifications/notificationService', () => ({ create: jest.fn() }));
jest.mock('../../../modules/linkPreview/linkPreview.service', () => ({ assertNotSSRF: jest.fn(async () => {}) }));
jest.mock('../../../socket/getIO', () => ({ getIO: () => null }));
jest.mock('axios', () => jest.fn(async () => ({ status: 200, data: { ok: true } })));

const Automation = require('../automation.model');
const AutomationRun = require('../automationRun.model');
const Channel = require('../../channels/channel.model.js');
const Tasks = require('../../tasks/tasks.query');
const messagesService = require('../../../modules/messages/messages.service');
const { assertNotSSRF } = require('../../../modules/linkPreview/linkPreview.service');
const axios = require('axios');
const service = require('../automation.service');

const WS = '64b000000000000000000001';
const CH = '64b0000000000000000000c1';
const lean = (v) => ({ lean: async () => v, select: () => ({ lean: async () => v }) });

beforeEach(() => {
    jest.clearAllMocks();
    Channel.findOne.mockImplementation((q) => lean(q.name === 'engineering' || q._id === CH
        ? { _id: CH, workspace: WS, company: null, name: 'engineering', isArchived: false }
        : null));
    Automation.updateOne.mockResolvedValue({ modifiedCount: 1 });
});

const prAutomation = {
    _id: 'a1',
    workspaceId: WS,
    name: 'PR merged pipeline',
    createdBy: 'admin1',
    trigger: { type: 'github.pr_merged' },
    conditions: [{ field: 'repo', operator: 'in', value: ['web', 'api'] }],
    actions: [
        { id: 'announce', type: 'send_message', config: { channelName: '#engineering', text: 'Merged: {{event.title}}' } },
        { id: 'release', type: 'create_task', config: { title: 'Release {{event.repo}} after {{steps.announce.messageId}}', priority: 'high' } },
        { type: 'assign_task', config: { assigneeId: '{{userId}}' } },
    ],
};

describe('multi-step runs', () => {
    test('runs steps in order and passes outputs forward', async () => {
        const identity = require('../../../identity');
        jest.spyOn(identity.workspaces, 'findById').mockResolvedValue({ isMember: () => true });
        Tasks.findById.mockResolvedValue({ _id: 'task1', workspace: WS, assignedTo: [] });
        Tasks.updateById.mockResolvedValue({ _id: 'task1', workspace: WS, assignedTo: ['64b0000000000000000000u1'] });

        const run = await service.runAutomation(prAutomation, 'github.pr_merged', {
            workspaceId: WS, repo: 'web', title: 'Add login', userId: '64b0000000000000000000u1', event: { number: 7 },
        }, null);

        expect(messagesService.createMessage).toHaveBeenCalledWith(expect.objectContaining({
            channel: CH, sender: 'bot1', ciphertext: 'C', fromAutomation: true,
        }), null);
        expect(Tasks.create).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Release web after msg1', priority: 'high', createdBy: 'admin1', workspace: WS,
        }));
        // assign_task without taskId uses the previous step's task.
        expect(Tasks.findById).toHaveBeenCalledWith('task1');
        expect(run.status).toBe('success');
        expect(run.actionsExecuted.map((s) => [s.index, s.stepId, s.status])).toEqual([
            [0, 'announce', 'success'], [1, 'release', 'success'], [2, null, 'success'],
        ]);
        expect(run.actionsExecuted[0].output).toEqual({ messageId: 'msg1', channelId: CH, channelName: 'engineering' });
        expect(Automation.updateOne).toHaveBeenCalledWith({ _id: 'a1' }, expect.objectContaining({ $inc: { runCount: 1 } }));
    });

    test('a failed step stops the run and later steps are recorded as skipped', async () => {
        messagesService.createMessage.mockRejectedValueOnce(new Error('boom'));
        const run = await service.runAutomation(prAutomation, 'github.pr_merged', { workspaceId: WS, repo: 'api', title: 'x' }, null);
        expect(Tasks.create).not.toHaveBeenCalled();
        expect(run.status).toBe('failed');
        expect(run.actionsExecuted.map((s) => s.status)).toEqual(['failed', 'skipped', 'skipped']);
        expect(run.error).toMatch(/Step 1 \(send_message\): boom/);
    });

    test('continueOnError keeps going and gives a partial run', async () => {
        messagesService.createMessage.mockRejectedValueOnce(new Error('boom'));
        const automation = { ...prAutomation, actions: [{ ...prAutomation.actions[0], continueOnError: true }, { type: 'create_task', config: { title: 'Release anyway' } }] };
        const run = await service.runAutomation(automation, 'github.pr_merged', { workspaceId: WS, repo: 'api', title: 'x' }, null);
        expect(run.status).toBe('partial');
        expect(Tasks.create).toHaveBeenCalled();
    });

    test('event runs whose conditions fail are not recorded', async () => {
        const run = await service.runAutomation(prAutomation, 'github.pr_merged', { workspaceId: WS, repo: 'docs' }, null);
        expect(run).toBeNull();
        expect(AutomationRun.create).not.toHaveBeenCalled();
    });

    test('backward compatible: old single-action automations without ids', async () => {
        const legacy = {
            _id: 'a2', workspaceId: WS, name: 'legacy', createdBy: 'admin1', trigger: { type: 'task.created' },
            conditions: [{ field: 'priority', operator: 'equals', value: 'high' }],
            actions: [{ type: 'send_message', config: { channelId: CH, text: 'New task: {{task.title}}' } }],
        };
        const run = await service.runAutomation(legacy, 'task.created', { workspaceId: WS, title: 'Hello', priority: 'High' }, null);
        expect(run.status).toBe('success');
        expect(run.actionsExecuted[0]).toEqual(expect.objectContaining({ type: 'send_message', success: true }));
    });
});

describe('run now / test', () => {
    test('dry run evaluates conditions and previews configs without executing', async () => {
        Automation.findOne.mockReturnValue(lean(prAutomation));
        const run = await service.runNow('a1', WS, 'admin1', { eventData: { repo: 'web', title: 'T' }, dryRun: true }, null);
        expect(messagesService.createMessage).not.toHaveBeenCalled();
        expect(Tasks.create).not.toHaveBeenCalled();
        expect(run.source).toBe('test');
        expect(run.dryRun).toBe(true);
        expect(run.actionsExecuted[0].preview).toEqual({ channelName: '#engineering', text: 'Merged: T' });
        expect(Automation.updateOne).not.toHaveBeenCalled();
    });

    test('manual run with unmet conditions is recorded as skipped', async () => {
        Automation.findOne.mockReturnValue(lean(prAutomation));
        const run = await service.runNow('a1', WS, 'admin1', { eventData: { repo: 'other' } }, null);
        expect(run.status).toBe('skipped');
        expect(run.conditionsMet).toBe(false);
        expect(run.source).toBe('manual');
    });

    test('404 for an unknown automation', async () => {
        Automation.findOne.mockReturnValue(lean(null));
        await expect(service.runNow('a9', WS, 'u', {}, null)).rejects.toMatchObject({ statusCode: 404 });
    });
});

describe('outbound actions', () => {
    test('webhook URL is SSRF-checked, redirects off, step status not clobbered by HTTP status', async () => {
        const automation = { ...prAutomation, conditions: [], actions: [{ type: 'call_webhook', config: { url: 'https://example.com/hook', payload: { t: '{{title}}' } } }] };
        const run = await service.runAutomation(automation, 'task.created', { workspaceId: WS, title: 'X' }, null);
        expect(assertNotSSRF).toHaveBeenCalledWith('https://example.com/hook');
        expect(axios).toHaveBeenCalledWith(expect.objectContaining({ maxRedirects: 0, data: { t: 'X' } }));
        expect(run.actionsExecuted[0].status).toBe('success');
        expect(run.actionsExecuted[0].output.status).toBe(200);
    });

    test('private network URLs fail the step', async () => {
        assertNotSSRF.mockRejectedValueOnce(new Error('Blocked private address'));
        const automation = { ...prAutomation, conditions: [], actions: [{ type: 'call_webhook', config: { url: 'http://10.0.0.1/' } }] };
        const run = await service.runAutomation(automation, 'task.created', { workspaceId: WS }, null);
        expect(axios).not.toHaveBeenCalled();
        expect(run.status).toBe('failed');
    });
});

describe('validation on create', () => {
    beforeEach(() => {
        Automation.countDocuments.mockResolvedValue(0);
        Automation.create.mockImplementation(async (d) => d);
    });

    test('normalises schedule, conditions and step ids', async () => {
        const a = await service.createAutomation('u1', {
            workspaceId: WS, name: 'n', trigger: { type: 'scheduled' },
            schedule: { type: 'cron', expression: '30 9 * * 1-5', timezone: 'Europe/Berlin' },
            conditions: [{ field: 'x', operator: 'exists' }],
            actions: [{ id: 'post', type: 'send_message', config: { channelId: CH, text: 'hi' } }],
        });
        expect(a.schedule).toEqual({ type: 'cron', expression: '30 9 * * 1-5', timezone: 'Europe/Berlin' });
        expect(a.actions[0]).toEqual({ id: 'post', type: 'send_message', config: { channelId: CH, text: 'hi' }, name: null, continueOnError: false });
    });

    test('scheduled without schedule defaults to 24h', async () => {
        const a = await service.createAutomation('u1', { workspaceId: WS, name: 'n', trigger: { type: 'scheduled' }, actions: [{ type: 'send_notification', config: { title: 't' } }] });
        expect(a.schedule).toEqual({ type: 'interval', expression: '24h', timezone: 'UTC' });
    });

    test.each([
        [{ actions: [{ type: 'nope' }] }, /unknown type/],
        [{ actions: [{ id: 'a', type: 'send_message' }, { id: 'a', type: 'send_message' }] }, /duplicate id/],
        [{ actions: Array.from({ length: 11 }, () => ({ type: 'send_message' })) }, /At most 10/],
        [{ conditions: [{ field: 'f', operator: 'matches', value: '(a+)+' }] }, /Nested quantifiers/],
        [{ trigger: { type: 'scheduled' }, schedule: { expression: '61 * * * *' } }, /Invalid schedule/],
    ])('rejects %#', async (extra, msg) => {
        await expect(service.createAutomation('u1', {
            workspaceId: WS, name: 'n', trigger: { type: 'task.created' }, actions: [{ type: 'send_message' }], ...extra,
        })).rejects.toThrow(msg);
    });
});

describe('scheduled runner', () => {
    test('runs due cron automations once (claimed) and skips others', async () => {
        const now = new Date('2026-10-19T09:30:30Z');
        const due = { ...prAutomation, _id: 'a3', conditions: [], trigger: { type: 'scheduled' }, lastRunAt: new Date('2026-10-18T09:30:00Z'), createdAt: new Date('2026-01-01'),
            schedule: { type: 'cron', expression: '30 9 * * *', timezone: 'UTC' }, actions: [{ type: 'send_notification', config: { title: 'Standup' } }] };
        const notDue = { ...due, _id: 'a4', schedule: { type: 'cron', expression: '0 18 * * *' } };
        const claimedElsewhere = { ...due, _id: 'a5' };
        Automation.find.mockReturnValue(lean([due, notDue, claimedElsewhere]));
        Automation.updateOne.mockImplementation(async (q) => ({ modifiedCount: q._id === 'a5' ? 0 : 1 }));

        await service.runScheduledAutomations(null, now);

        const claims = Automation.updateOne.mock.calls.filter(([, u]) => u.$set && !u.$inc).map(([q]) => q._id);
        expect(claims).toEqual(['a3', 'a5']);
        expect(AutomationRun.create).toHaveBeenCalledTimes(1);
        expect(AutomationRun.create.mock.calls[0][0]).toEqual(expect.objectContaining({ automationId: 'a3', source: 'schedule', triggerType: 'scheduled' }));
    });
});

describe('trigger data stored on runs', () => {
    test('drops io and caps size', () => {
        const big = { workspaceId: WS, io: { emit() {} }, event: { blob: 'x'.repeat(1900), list: Array.from({ length: 200 }, (_, i) => ({ i, s: 'y'.repeat(500) })) } };
        const clean = service._sanitizeTriggerData(big);
        expect(clean.io).toBeUndefined();
        expect(clean.truncated).toBe(true);
        expect(clean.event).toBeUndefined();
    });

    test('context aliases the trigger noun', () => {
        const ctx = service._buildContext('task.created', { workspaceId: WS, title: 'T', io: {} });
        expect(ctx.task.title).toBe('T');
        expect(ctx.event.title).toBe('T');
        expect(ctx.io).toBeUndefined();
    });
});
