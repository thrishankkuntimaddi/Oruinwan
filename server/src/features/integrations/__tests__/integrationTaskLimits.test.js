'use strict';

/** Integration-created tasks respect the free plan's task limits: over them, no task and a note on the card. */

jest.mock('../../tasks/tasks.query', () => ({ create: jest.fn(async (d) => ({ _id: 'task1', ...d })) }));
jest.mock('../../../identity', () => ({ workspaces: { findById: jest.fn(async () => ({ _id: 'w1', company: null })) } }));
jest.mock('../integration.bot', () => ({
    loadPostableChannel: jest.fn(async () => ({ _id: 'c1' })),
    upsertCard: jest.fn(async () => ({ message: { _id: 'm1' } })),
    getBotUser: jest.fn(async () => ({ _id: 'bot' })),
}));
jest.mock('../integration.tasks', () => ({ findTasksByLinkUrl: jest.fn(async () => []), applyToTasks: jest.fn(async () => []) }));
jest.mock('../../tasks/tasks.shared', () => ({ emitToTaskAudience: jest.fn(async () => {}), loadTaskForClient: jest.fn(async () => ({})) }));
jest.mock('../../../socket/getIO', () => ({ getIO: () => null }));
jest.mock('../../../shared/plans/planService', () => ({
    enforce: jest.fn(async (p) => p),
    assertCanCreateTasks: jest.fn(),
}));

const Tasks = require('../../tasks/tasks.query');
const bot = require('../integration.bot');
const planService = require('../../../shared/plans/planService');
const { PlanLimitError } = require('../../../shared/plans/plans');
const { applyEffects } = require('../integration.apply');

const integration = { workspaceId: 'w1', connectedBy: 'u1', config: { createTasks: true, defaultChannelId: 'c1' } };
const connector = { type: 'github', defaultChannel: true };
const effects = [
    { type: 'task.create', title: 'Fix login', link: { url: 'https://x/1' } },
    { type: 'card', card: { url: 'https://x/1', kind: 'issue', title: 'Fix login' }, summary: 'Fix login' },
];

beforeEach(() => jest.clearAllMocks());

test('within the limits the task is created', async () => {
    planService.assertCanCreateTasks.mockResolvedValue(undefined);
    const out = await applyEffects({ integration, connector, effects, io: null });
    expect(Tasks.create).toHaveBeenCalled();
    expect(planService.assertCanCreateTasks).toHaveBeenCalledWith('w1', 'u1', { self: 0, others: 1 });
    expect(out.createdTasks).toHaveLength(1);
    expect(bot.upsertCard.mock.calls[0][0].card.extra?.planNote).toBeUndefined();
});

test('over the limits: no task, the reason on the channel card and in the result', async () => {
    planService.assertCanCreateTasks.mockRejectedValue(new PlanLimitError('tasks.perWorkspace', { max: 300, used: 300 }));
    const out = await applyEffects({ integration, connector, effects, io: null });
    expect(Tasks.create).not.toHaveBeenCalled();
    expect(out.createdTasks).toEqual([]);
    expect(out.skippedTasks).toEqual([expect.objectContaining({ title: 'Fix login', limit: 'tasks.perWorkspace' })]);
    const card = bot.upsertCard.mock.calls[0][0].card;
    expect(card.extra.planNote).toMatch(/^No task created: You've reached the free plan limit: 300 active tasks per workspace/);
});

test('a task that arrives already done is not active and is not checked', async () => {
    await applyEffects({ integration, connector, effects: [{ ...effects[0], status: 'done' }], io: null });
    expect(planService.assertCanCreateTasks).not.toHaveBeenCalled();
    expect(Tasks.create).toHaveBeenCalled();
});
