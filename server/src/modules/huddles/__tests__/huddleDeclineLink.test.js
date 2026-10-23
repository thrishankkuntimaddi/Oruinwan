'use strict';

process.env.ACCESS_TOKEN_SECRET = 'test-secret-for-decline-links';

jest.mock('../../../features/push/push.service', () => ({ sendCallToUser: jest.fn(async () => {}), sendToUser: jest.fn(async () => {}) }));
jest.mock('../../notifications/notificationService', () => ({ missedCall: jest.fn(async () => []), huddleStarted: jest.fn(async () => []) }));
jest.mock('../../../identity', () => ({ users: { findById: async () => ({ username: 'bob', profile: { name: 'Bob' } }) } }));

const http = require('http');
const express = require('express');
const ringing = require('../huddleRinging');

// The decline link in each ring: works without signing in, only for that person, only while it rings.
describe('signed decline link', () => {
    let server, url;
    const emitted = [];
    const io = { to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) };

    beforeAll((done) => {
        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => { req.io = io; next(); });
        app.use('/api/v2/huddles', require('../huddles.routes'));
        server = app.listen(0, () => { url = `http://localhost:${server.address().port}`; done(); });
    });
    afterAll((done) => { ringing._reset(); server.close(done); });
    beforeEach(() => { emitted.length = 0; ringing._reset(); });

    const ring = (huddleId) => ringing.start(io, {
        huddleId, kind: 'dm', callerId: 'alice', callees: ['bob'], workspaceId: 'w1', dmId: 'd1',
        title: 'Alice', from: { id: 'alice', name: 'Alice' }, video: false, timeoutMs: 45000,
    });
    const post = (path) => fetch(`${url}${path}`, { method: 'POST' });
    const linkOf = () => emitted.find((e) => e.event === 'huddle:ring').payload.declineUrl;

    test('a valid link declines the ring, with no sign-in', async () => {
        ring('h1');
        const link = new URL(linkOf());
        expect(link.pathname).toBe('/api/v2/huddles/h1/decline-ring');
        const res = await post(`${link.pathname}${link.search}`);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true });
        expect(ringing.isRinging('h1', 'bob')).toBe(false);
        expect(emitted).toContainEqual(expect.objectContaining({ room: 'user:alice', event: 'huddle:declined', payload: expect.objectContaining({ userId: 'bob' }) }));
    });

    test('an expired link is refused with 401', async () => {
        ring('h2');
        const token = ringing.signDecline('h2', 'bob', Date.now() - 1000);
        const res = await post(`/api/v2/huddles/h2/decline-ring?token=${encodeURIComponent(token)}`);
        expect(res.status).toBe(401);
        expect(ringing.isRinging('h2', 'bob')).toBe(true);
    });

    test('a forged link, or one for another call or person, is refused with 403', async () => {
        ring('h3');
        const good = ringing.signDecline('h3', 'bob', Date.now() + 30000);
        const [, exp, sig] = good.split('.');
        const cases = [
            `bob.${exp}.${sig.slice(0, -2)}xx`, // tampered signature
            `carol.${exp}.${sig}`,             // someone else
            `bob.${Number(exp) + 60000}.${sig}`, // longer expiry
            'nonsense',
        ];
        for (const token of cases) {
            const res = await post(`/api/v2/huddles/h3/decline-ring?token=${encodeURIComponent(token)}`);
            expect(res.status).toBe(403);
        }
        // Bob's real link for h3 doesn't decline h4.
        ring('h4');
        const res = await post(`/api/v2/huddles/h4/decline-ring?token=${encodeURIComponent(good)}`);
        expect(res.status).toBe(403);
        expect(ringing.isRinging('h3', 'bob')).toBe(true);
        expect(ringing.isRinging('h4', 'bob')).toBe(true);
    });

    test('a valid link for a ring that already stopped is 404', async () => {
        const token = ringing.signDecline('h5', 'bob', Date.now() + 30000);
        const res = await post(`/api/v2/huddles/h5/decline-ring?token=${encodeURIComponent(token)}`);
        expect(res.status).toBe(404);
    });
});
