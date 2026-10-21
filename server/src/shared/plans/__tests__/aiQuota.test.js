'use strict';

/**
 * Daily AI counters: 50 per person and 300 per workspace (UTC day), only for
 * requests answered with the server's key, counted at the gateway.
 */

jest.mock('../planService', () => ({
    cachedWorkspacePlan: jest.fn(async (id) => (id === 'corp' ? { plan: 'company', exempt: true } : { plan: 'free', exempt: false })),
    userPlan: jest.fn(async (id) => (id === 'employee' ? { plan: 'company', exempt: true } : { plan: 'free', exempt: false })),
}));

const counters = require('../planCounters');
const quota = require('../aiQuota');

beforeEach(() => {
    counters._setBackendForTests('memory');
    counters._resetMemory();
});
afterAll(() => counters._setBackendForTests(null));

const NOW = new Date('2026-10-21T15:00:00Z');

test('50 requests a day per person, the 51st is refused', async () => {
    for (let i = 0; i < 50; i += 1) await quota.consume({ userId: 'u1', workspaceId: 'w1', now: NOW });
    const err = await quota.consume({ userId: 'u1', workspaceId: 'w1', now: NOW }).catch((e) => e);
    expect(err.body).toMatchObject({ code: 'PLAN_LIMIT', limit: 'ai.userDaily', max: 50, used: 50 });
    const usage = await quota.peek({ userId: 'u1', workspaceId: 'w1', now: NOW });
    expect(usage).toMatchObject({ userUsed: 50, userMax: 50, userRemaining: 0, workspaceUsed: 50, workspaceMax: 300 });
});

test('the refused request gives its counts back', async () => {
    for (let i = 0; i < 50; i += 1) await quota.consume({ userId: 'u1', workspaceId: 'w1', now: NOW });
    await quota.consume({ userId: 'u1', workspaceId: 'w1', now: NOW }).catch(() => {});
    await quota.consume({ userId: 'u1', workspaceId: 'w1', now: NOW }).catch(() => {});
    expect((await quota.peek({ userId: 'u1', workspaceId: 'w1', now: NOW })).workspaceUsed).toBe(50);
});

test('300 a day per workspace across people', async () => {
    for (let p = 0; p < 6; p += 1) {
        for (let i = 0; i < 50; i += 1) await quota.consume({ userId: `p${p}`, workspaceId: 'w1', now: NOW });
    }
    const err = await quota.consume({ userId: 'p9', workspaceId: 'w1', now: NOW }).catch((e) => e);
    expect(err.body).toMatchObject({ limit: 'ai.workspaceDaily', max: 300, used: 300 });
    // The person's own counter was given back.
    expect((await quota.peek({ userId: 'p9', workspaceId: 'w1', now: NOW })).userUsed).toBe(0);
});

test('a new UTC day starts again', async () => {
    for (let i = 0; i < 50; i += 1) await quota.consume({ userId: 'u1', now: NOW });
    await expect(quota.consume({ userId: 'u1', now: NOW })).rejects.toMatchObject({ code: 'PLAN_LIMIT' });
    await expect(quota.consume({ userId: 'u1', now: new Date('2026-10-22T00:00:01Z') })).resolves.toMatchObject({ userUsed: 1 });
    expect(quota.resetsAt(NOW)).toBe('2026-10-22T00:00:00.000Z');
});

test('company workspaces and company accounts are not counted', async () => {
    for (let i = 0; i < 60; i += 1) await quota.consume({ userId: 'u1', workspaceId: 'corp', now: NOW });
    for (let i = 0; i < 60; i += 1) await quota.consume({ userId: 'employee', now: NOW });
    expect((await quota.peek({ userId: 'u1', workspaceId: 'w1', now: NOW })).userUsed).toBe(0);
});

test('system calls without a person or workspace are not counted', async () => {
    await expect(quota.consume({ userId: 'system', now: NOW })).resolves.toMatchObject({ userUsed: null, workspaceUsed: null });
});

test("only the server's key counts", () => {
    expect(quota.usesServerKey({})).toBe(true);
    expect(quota.usesServerKey({ provider: {} })).toBe(false);
    expect(quota.usesServerKey({ keySource: 'personal' })).toBe(false);
});

describe('the gateway choke point', () => {
    const local = require('../../../../../ai/api/ai.gateway');
    let gateway;
    beforeEach(() => {
        jest.spyOn(local, 'summarize').mockResolvedValue({ summary: 'ok' });
        jest.spyOn(local, 'rerank').mockResolvedValue({ scores: [] });
        gateway = require('../../../features/ai/ai.gatewayResolver');
    });
    afterEach(() => jest.restoreAllMocks());

    test('counts server-key requests and refuses past the limit', async () => {
        const io = { to: jest.fn(() => ({ emit: jest.fn() })) };
        for (let i = 0; i < 50; i += 1) await gateway.summarize({ text: 'x' }, { userId: 'u1', workspaceId: 'w1', io });
        expect(io.to).toHaveBeenCalledWith('user_u1');
        await expect(gateway.summarize({ text: 'x' }, { userId: 'u1', workspaceId: 'w1' })).rejects.toMatchObject({ code: 'PLAN_LIMIT' });
        expect(local.summarize).toHaveBeenCalledTimes(50);
    });

    test("a person's own installed key is never counted", async () => {
        for (let i = 0; i < 70; i += 1) await gateway.summarize({ text: 'x' }, { userId: 'u1', workspaceId: 'w1', provider: { name: 'mine' }, keySource: 'personal' });
        expect((await quota.peek({ userId: 'u1', workspaceId: 'w1' })).userUsed).toBe(0);
    });

    test('helper steps (rerank) are not counted', async () => {
        await gateway.rerank({ query: 'q', docs: [] }, { userId: 'u1', workspaceId: 'w1' });
        expect((await quota.peek({ userId: 'u1', workspaceId: 'w1' })).userUsed).toBe(0);
    });
});
