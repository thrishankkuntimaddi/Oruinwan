'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const postgres = require('../postgres');
const { runMigrations, migrationStatus, listMigrationFiles } = require('../migrations');
const { mirrorToPostgres, mirrorEnabled } = require('../logStore');

/** A fake pg pool that records statements and answers a few of them. */
function fakePool() {
    const statements = [];
    const applied = new Set();
    const handle = async (text, params = []) => {
        statements.push({ text, params });
        if (/SELECT name FROM schema_migrations/.test(text)) return { rows: [...applied].map((name) => ({ name })) };
        if (/INSERT INTO schema_migrations/.test(text)) { applied.add(params[0]); return { rows: [] }; }
        if (/^SELECT 1$/.test(text)) return { rows: [{ '?column?': 1 }] };
        return { rows: [] };
    };
    return {
        statements,
        query: handle,
        connect: async () => ({ query: handle, release: () => {} }),
    };
}

describe('postgres module', () => {
    afterEach(() => postgres._setPoolForTests(undefined));

    test('disabled without DATABASE_URL', async () => {
        expect(postgres.isPostgresEnabled({})).toBe(false);
        expect(postgres.isPostgresEnabled({ DATABASE_URL: 'postgres://x' })).toBe(true);
        postgres._setPoolForTests(null);
        expect(() => postgres.query('SELECT 1')).toThrow(/not configured/);
    });

    test('withTransaction commits, and rolls back on throw', async () => {
        const pool = fakePool();
        postgres._setPoolForTests(pool);
        await postgres.withTransaction(async (tx) => { await tx.query('INSERT INTO t VALUES (1)'); });
        await expect(postgres.withTransaction(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
        const texts = pool.statements.map((s) => s.text);
        expect(texts).toEqual(['BEGIN', 'INSERT INTO t VALUES (1)', 'COMMIT', 'BEGIN', 'ROLLBACK']);
    });

    test('pool options honour env', () => {
        const o = postgres.poolOptions({ DATABASE_URL: 'postgres://u@h/db', PG_POOL_SIZE: '7' });
        expect(o.max).toBe(7);
        expect(postgres.poolOptions({ DATABASE_URL: 'x' }).max).toBe(10);
    });
});

describe('migrations', () => {
    let dir;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
        fs.writeFileSync(path.join(dir, '0001_a.sql'), 'CREATE TABLE a (id int);');
        fs.writeFileSync(path.join(dir, '0002_b.sql'), '-- no-transaction\nCREATE INDEX CONCURRENTLY b ON a (id);');
        fs.writeFileSync(path.join(dir, 'notes.txt'), 'ignored');
    });

    test('runs pending files in order, once, with a transaction unless opted out', async () => {
        const pool = fakePool();
        expect(listMigrationFiles(dir)).toEqual(['0001_a.sql', '0002_b.sql']);
        expect(await runMigrations({ pool, dir })).toEqual(['0001_a.sql', '0002_b.sql']);
        const texts = pool.statements.map((s) => s.text);
        expect(texts.indexOf('BEGIN')).toBeLessThan(texts.indexOf('CREATE TABLE a (id int);'));
        expect(texts.filter((t) => t === 'BEGIN')).toHaveLength(1); // 0002 opted out
        expect(await runMigrations({ pool, dir })).toEqual([]);
        expect(await migrationStatus({ pool, dir })).toEqual({ applied: ['0001_a.sql', '0002_b.sql'], pending: [] });
    });

    test('a failing migration is reported by name and later files do not run', async () => {
        const pool = fakePool();
        const bad = async (text, params) => { if (/CREATE TABLE a /.test(text)) throw new Error('syntax'); return pool.query(text, params); };
        const failing = { ...pool, query: bad, connect: async () => ({ query: bad, release: () => {} }) };
        await expect(runMigrations({ pool: failing, dir })).rejects.toThrow('migration 0001_a.sql: syntax');
    });

    test('the real migrations directory is well-formed', () => {
        const files = listMigrationFiles();
        expect(files.length).toBeGreaterThanOrEqual(4);
        expect(files[0]).toBe('0001_extensions.sql');
    });
});

describe('log mirror plugin', () => {
    afterEach(() => postgres._setPoolForTests(undefined));

    test('mirror is off without postgres or with LOG_STORE=mongo', () => {
        expect(mirrorEnabled({})).toBe(false);
        expect(mirrorEnabled({ DATABASE_URL: 'x', LOG_STORE: 'mongo' })).toBe(false);
        expect(mirrorEnabled({ DATABASE_URL: 'x' })).toBe(true);
    });

    test('post-save writes an INSERT with the document fields', async () => {
        const pool = fakePool();
        postgres._setPoolForTests(pool);
        process.env.DATABASE_URL = 'postgres://test';
        const hooks = [];
        const schema = { post: (ev, fn) => hooks.push([ev, fn]) };
        mirrorToPostgres(schema, { kind: 'audit' });
        expect(hooks[0][0]).toBe('save');
        hooks[0][1]({ toObject: () => ({ companyId: 'c1', userId: 'u1', action: 'login', details: { a: 1 } }) });
        await new Promise((r) => setImmediate(r));
        const ins = pool.statements.find((s) => /INSERT INTO audit_log/.test(s.text));
        expect(ins.params.slice(0, 3)).toEqual(['c1', 'u1', 'login']);
        expect(ins.params[5]).toBe('{"a":1}');
        delete process.env.DATABASE_URL;
    });
});
