'use strict';

jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('../../../modules/notifications/notificationEventEmitter', () => ({ emit: jest.fn() }));

const { createFakeRedisHub } = require('../../__tests__/fakeRedis');
const bus = require('../bus');
const Webhook = require('../../../features/integrations/webhook.model');
const trigger = require('../../../features/integrations/webhook.trigger');
const { startWebhookDispatcher } = require('../consumers/webhookDispatcher');

const flush = (ms = 100) => new Promise((r) => setTimeout(r, ms));

describe('webhook dispatcher', () => {
    afterEach(() => { bus._setRedisForTests(undefined); jest.restoreAllMocks(); });

    test('without Redis fire() delivers directly and the dispatcher is a no-op', async () => {
        bus._setRedisForTests(null);
        const find = jest.spyOn(Webhook, 'find').mockReturnValue({ lean: async () => [] });
        const stop = await startWebhookDispatcher();
        trigger.fire('64b000000000000000000001', 'task.created', { taskId: 't1' });
        await flush(20);
        expect(find).toHaveBeenCalledTimes(1);
        await stop();
    });

    test('with Redis fire() publishes and the consumer delivers through _dispatch', async () => {
        const hub = createFakeRedisHub();
        bus._setRedisForTests(hub.client());
        const find = jest.spyOn(Webhook, 'find').mockReturnValue({ lean: async () => [] });
        const stop = await startWebhookDispatcher();
        trigger.fire('64b000000000000000000001', 'task.created', { taskId: 't1', createdBy: 'u1' });
        await flush(50);
        expect(find).toHaveBeenCalledTimes(1); // once, from the consumer, not from fire()
        const q = find.mock.calls[0][0];
        expect(q.workspaceId).toBe('64b000000000000000000001');
        expect(q.$or[0]).toEqual({ events: { $in: ['task.created', '*'] } });
        // Events outside the webhook list are acked and ignored.
        await bus.publish('huddle.started', { huddleId: 'h1' }, { workspaceId: 'w1' });
        await flush(50);
        expect(find).toHaveBeenCalledTimes(1);
        await stop();
    });

    test('unknown (non-catalogue) events still go the direct way even with Redis', async () => {
        bus._setRedisForTests(createFakeRedisHub().client());
        const find = jest.spyOn(Webhook, 'find').mockReturnValue({ lean: async () => [] });
        trigger.fire('64b000000000000000000001', 'meeting.started', {});
        await flush(20);
        expect(find).toHaveBeenCalledTimes(1);
    });
});
