'use strict';

const { tasksStore, notOnPgYet } = require('../tasks.store');

describe('tasks store switch', () => {
    test('pg only when asked for and PostgreSQL is configured', () => {
        expect(tasksStore({})).toBe('mongo');
        expect(tasksStore({ TASKS_STORE: 'pg' })).toBe('mongo');
        expect(tasksStore({ DATABASE_URL: 'postgres://x' })).toBe('mongo');
        expect(tasksStore({ TASKS_STORE: 'pg', DATABASE_URL: 'postgres://x' })).toBe('pg');
        expect(tasksStore({ TASKS_STORE: 'mongo', DATABASE_URL: 'postgres://x' })).toBe('mongo');
    });

    test('unported functions answer 501', () => {
        const err = notOnPgYet();
        expect(err.statusCode).toBe(501);
        expect(err.message).toBe('Not available on the PostgreSQL task store yet');
    });

    test('every public service function has a PostgreSQL implementation', () => {
        const { createPgTaskService } = require('../tasks.service.pg');
        const pgService = createPgTaskService({});
        const service = require('../tasks.service');
        const publicFns = Object.keys(service).filter((k) => !k.startsWith('_') && typeof service[k] === 'function');
        expect(publicFns.filter((k) => typeof pgService[k] !== 'function')).toEqual([]);
    });
});
