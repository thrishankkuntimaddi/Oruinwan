'use strict';

/** Whole-server AI spend guard (aiBudget.js) on top of the per-person and per-workspace counters. */

jest.mock('../planService', () => ({
    cachedWorkspacePlan: jest.fn(async (id) => (id === 'prows' ? { plan: 'pro', exempt: false } : { plan: 'free', exempt: false })),
    userPlan: jest.fn(async () => ({ plan: 'free', exempt: false })),
}));

const counters = require('../planCounters');
const quota = require('../aiQuota');
const budget = require('../aiBudget');

const NOW = new Date('2026-11-12T10:00:00Z');
const ENV = { ...process.env };

beforeEach(() => {
    counters._setBackendForTests('memory');
    counters._resetMemory();
    // $0.10 a day at $0.01 a request: 10 free requests, 20 for paid plans.
    process.env.AI_DAILY_BUDGET_USD = '0.10';
    process.env.AI_COST_PER_REQUEST_USD = '0.01';
});
afterAll(() => {
    process.env = ENV;
    counters._setBackendForTests(null);
});

// Spread over many people and workspaces so only the server-wide budget can trip.
const ask = (i, ws = `w${i}`) => quota.consume({ userId: `u${i}`, workspaceId: ws, now: NOW });

test('free requests pause once the day’s budget is spent, and the refusal gives counts back', async () => {
    for (let i = 0; i < 10; i += 1) await ask(i);
    const err = await ask(10).catch((e) => e);
    expect(err.body).toMatchObject({ code: 'PLAN_LIMIT', limit: 'ai.serverDaily' });
    expect(err.message).toMatch(/free AI requests are paused until midnight UTC/);
    // The refused person's own counters were given back.
    expect((await quota.peek({ userId: 'u10', workspaceId: 'w10', now: NOW })).userUsed).toBe(0);
    const s = await budget.status({ day: quota.dayOf(NOW) });
    expect(s).toMatchObject({ enabled: true, requests: 10, estimatedUsd: 0.1, budgetUsd: 0.1, freePaused: true });
});

test('paid workspaces keep working up to twice the budget', async () => {
    for (let i = 0; i < 10; i += 1) await ask(i);
    await expect(ask(50)).rejects.toMatchObject({ code: 'PLAN_LIMIT' });
    for (let i = 0; i < 10; i += 1) await ask(100 + i, 'prows');
    const err = await ask(200, 'prows').catch((e) => e);
    expect(err.body.limit).toBe('ai.serverDaily');
    expect(err.message).toMatch(/safety limit/);
});

test('requests with someone’s own key never reach the budget', () => {
    expect(quota.usesServerKey({ keySource: 'personal' })).toBe(false);
    expect(quota.usesServerKey({ provider: {} })).toBe(false);
});

test('"off" turns the guard off', async () => {
    process.env.AI_DAILY_BUDGET_USD = 'off';
    for (let i = 0; i < 30; i += 1) await ask(i);
    expect((await budget.status({ day: quota.dayOf(NOW) })).enabled).toBe(false);
});

test('logs one warning at 80% and one note when free requests pause', async () => {
    const log = jest.fn();
    const day = quota.dayOf(NOW);
    for (let i = 0; i < 12; i += 1) await budget.charge({ day, ttl: 60, log }).catch(() => {});
    expect(log.mock.calls.filter(([l]) => l === 'warn')).toHaveLength(1);
    expect(log.mock.calls.filter(([l]) => l === 'error')).toHaveLength(1);
});
