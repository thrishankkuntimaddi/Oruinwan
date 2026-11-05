const express = require('express');
const razorpay = require('../razorpay');

jest.mock('../billing.service', () => ({
    handleWebhook: jest.fn(async () => ({ handled: true, event: 'subscription.charged' })),
    publicConfig: jest.fn(() => ({ enabled: false })),
}));
const service = require('../billing.service');

let server;
let base;
beforeAll((done) => {
    const { captureRawBody } = require('../../integrations/webhook.verify');
    const a = express();
    a.use(express.json({ verify: captureRawBody }));
    a.use('/api/billing', require('../billing.routes'));
    server = a.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; done(); });
});
afterAll((done) => { server.close(done); });

async function post(path, body, headers = {}) {
    const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
    return { status: res.status };
}

describe('POST /api/billing/webhook/razorpay', () => {
    const saved = process.env.RAZORPAY_WEBHOOK_SECRET;
    beforeEach(() => { process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec'; });
    afterAll(() => { process.env.RAZORPAY_WEBHOOK_SECRET = saved; });

    test('accepts a delivery signed over the exact bytes, without signing in', async () => {
        const body = '{"event":"subscription.charged",  "payload":{}}';
        const res = await post('/api/billing/webhook/razorpay', body,
            { 'X-Razorpay-Signature': razorpay.hmacHex('whsec', body), 'X-Razorpay-Event-Id': 'evt_1' });
        expect(res.status).toBe(200);
        expect(service.handleWebhook).toHaveBeenCalledWith(expect.objectContaining({ event: 'subscription.charged' }), 'evt_1');
    });

    test('refuses a bad signature', async () => {
        const res = await post('/api/billing/webhook/razorpay', '{"event":"subscription.charged"}', { 'X-Razorpay-Signature': 'nope' });
        expect(res.status).toBe(400);
        expect(service.handleWebhook).not.toHaveBeenCalled();
    });

    test('a failure answers 500 so Razorpay retries', async () => {
        service.handleWebhook.mockRejectedValueOnce(new Error('db down'));
        const body = '{"event":"subscription.activated"}';
        const res = await post('/api/billing/webhook/razorpay', body, { 'X-Razorpay-Signature': razorpay.hmacHex('whsec', body) });
        expect(res.status).toBe(500);
    });

    test('the other billing routes need sign-in', async () => {
        const res = await fetch(`${base}/api/billing/config`);
        expect(res.status).toBe(401);
    });
});
