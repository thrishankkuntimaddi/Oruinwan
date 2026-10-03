'use strict';

const { createFakeRedisHub } = require('./fakeRedis');
const { runExclusive, scheduleJob, stopAllJobs, lockTtlMs } = require('../jobs/scheduler');

describe('job scheduler', () => {
    afterEach(() => stopAllJobs());

    test('lock ttl is most of the interval, bounded', () => {
        expect(lockTtlMs(60_000)).toBe(54_000);
        expect(lockTtlMs(1000)).toBe(5000);
        expect(lockTtlMs(24 * 60 * 60 * 1000)).toBe(60 * 60 * 1000);
    });

    test('only one instance runs a job per interval when they share Redis', async () => {
        const hub = createFakeRedisHub();
        const a = hub.client();
        const b = hub.client();
        const runs = [];
        const ranA = await runExclusive('digest', () => runs.push('a'), { ttlMs: 1000, redis: a });
        const ranB = await runExclusive('digest', () => runs.push('b'), { ttlMs: 1000, redis: b });
        expect(ranA).toBe(true);
        expect(ranB).toBe(false);
        expect(runs).toEqual(['a']);
    });

    test('without Redis every call runs (single instance)', async () => {
        const runs = [];
        expect(await runExclusive('x', () => runs.push(1), { redis: null })).toBe(true);
        expect(await runExclusive('x', () => runs.push(2), { redis: null })).toBe(true);
        expect(runs).toEqual([1, 2]);
    });

    test('a throwing job is logged, not fatal', async () => {
        await expect(runExclusive('boom', () => { throw new Error('nope'); }, { redis: null })).resolves.toBe(true);
    });

    test('scheduleJob ticks after the initial delay and can be stopped', async () => {
        jest.useFakeTimers();
        const run = jest.fn();
        const stop = scheduleJob({ name: 'tick', intervalMs: 1000, initialDelayMs: 100, run, redis: null });
        expect(run).not.toHaveBeenCalled();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
        expect(run).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        expect(run).toHaveBeenCalledTimes(2);
        stop();
        jest.advanceTimersByTime(5000);
        expect(run).toHaveBeenCalledTimes(2);
        jest.useRealTimers();
    });

    test('scheduling the same name twice is ignored', () => {
        const stop1 = scheduleJob({ name: 'dup', intervalMs: 1000, run: () => {}, redis: null });
        const stop2 = scheduleJob({ name: 'dup', intervalMs: 1000, run: () => {}, redis: null });
        expect(stop2).toBe(stop1);
    });
});
