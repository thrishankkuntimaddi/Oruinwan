'use strict';

jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('../../../modules/notifications/notificationEventEmitter', () => ({ emit: jest.fn() }));

const axios = require('axios');
const crypto = require('crypto');
const Webhook = require('../webhook.model');
const trigger = require('../webhook.trigger');

describe('webhook.trigger', () => {
  test('matches both events[] and legacy event with $in', async () => {
    const find = jest.spyOn(Webhook, 'find').mockReturnValue({ lean: async () => [] });
    trigger.fire('64b000000000000000000001', 'message.sent', {});
    await new Promise(r => setImmediate(r));
    const q = find.mock.calls[0][0];
    expect(q.isActive).toBe(true);
    expect(q.$or).toEqual([
      { events: { $in: ['message.sent', '*'] } },
      { event: { $in: ['message.sent', '*'] } },
    ]);
  });

  test('sendTest signs the exact body and reports status', async () => {
    jest.spyOn(Webhook, 'findByIdAndUpdate').mockResolvedValue(null);
    axios.post.mockResolvedValue({ status: 204 });
    const hook = { _id: 'h1', workspaceId: 'w1', url: 'https://x.test', secret: 'k' };
    const out = await trigger.sendTest(hook);
    expect(out).toEqual({ status: 204, ok: true });
    const [url, body, opts] = axios.post.mock.calls[0];
    expect(url).toBe('https://x.test');
    const expected = 'sha256=' + crypto.createHmac('sha256', 'k').update(body).digest('hex');
    expect(opts.headers['X-Chttrix-Signature']).toBe(expected);
    expect(JSON.parse(body).event).toBe('webhook.test');

    axios.post.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await trigger.sendTest(hook)).toEqual({ status: 0, ok: false });
  });

  test('eventsOf treats legacy event as [event]', () => {
    expect(Webhook.eventsOf({ event: 'task.created' })).toEqual(['task.created']);
    expect(Webhook.eventsOf({ events: ['a'], event: 'b' })).toEqual(['a']);
  });
});
