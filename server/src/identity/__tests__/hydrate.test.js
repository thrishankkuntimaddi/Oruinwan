'use strict';

const { hydrate, userSelect, USER_MIN } = require('../hydrate');
const { buildUpdate, columnsFor, camelRow } = require('../sql');
const { identityStore } = require('../index');

const users = new Map([
    ['u1', { _id: 'u1', username: 'ada', profilePicture: 'a.png', email: 'ada@x', isAdmin: () => true }],
    ['u2', { _id: 'u2', username: 'bob', profilePicture: null, email: 'bob@x' }],
]);
const load = { user: jest.fn(async (ids) => new Map(ids.filter((i) => users.has(i)).map((i) => [i, users.get(i)]))) };

describe('hydrate', () => {
    beforeEach(() => load.user.mockClear());

    test('single, array and nested array paths in one query', async () => {
        const docs = [
            { sender: 'u1', readBy: [{ user: 'u2' }, { user: 'gone' }], assignedTo: ['u1', 'u2'] },
            { sender: { _id: 'u2' }, readBy: [], assignedTo: [] },
        ];
        await hydrate(docs, { sender: USER_MIN, 'readBy.user': USER_MIN, assignedTo: USER_MIN }, { load });
        expect(load.user).toHaveBeenCalledTimes(1);
        expect(docs[0].sender).toEqual({ _id: 'u1', username: 'ada', profilePicture: 'a.png' });
        expect(docs[0].readBy[0].user.username).toBe('bob');
        expect(docs[0].readBy[1].user).toBeNull();
        expect(docs[0].assignedTo.map((u) => u.username)).toEqual(['ada', 'bob']);
        expect(docs[1].sender.username).toBe('bob');
    });

    test('full selector strips methods; select string parsing', async () => {
        const doc = { owner: 'u1' };
        await hydrate(doc, { owner: { type: 'user', fields: null } }, { load });
        expect(doc.owner.email).toBe('ada@x');
        expect(doc.owner.isAdmin).toBeUndefined();
        expect(userSelect('username -email profilePicture').fields).toEqual(['username', 'profilePicture']);
    });

    test('missing paths and empty input are no-ops', async () => {
        expect(await hydrate([], { sender: USER_MIN }, { load })).toEqual([]);
        const d = { other: 1 };
        await hydrate(d, { sender: USER_MIN }, { load });
        expect(d).toEqual({ other: 1 });
    });
});

describe('sql helpers', () => {
    const MAP = { name: 'name', settings: 'settings', tags: 'tags', companyId: 'company_id' };

    test('buildUpdate handles plain, json, merge and arrays', () => {
        const { sets, params, next } = buildUpdate({ name: 'x', settings: { a: 1 }, tags: ['a'], unknown: 1 }, MAP);
        expect(sets).toEqual(['name = $1', 'settings = $2::jsonb', 'tags = $3']);
        expect(params).toEqual(['x', '{"a":1}', ['a']]);
        expect(next).toBe(4);
        const merged = buildUpdate({ settings: { $merge: true, b: 2 } }, MAP);
        expect(merged.sets[0]).toMatch(/COALESCE\(settings/);
        expect(merged.params[0]).toBe('{"b":2}');
    });

    test('columnsFor stringifies ObjectId-like values', () => {
        const { cols, params } = columnsFor({ companyId: { toString: () => 'abc' }, name: 'n' }, MAP);
        expect(cols).toEqual(['name', 'company_id']);
        expect(params).toEqual(['n', 'abc']);
    });

    test('phone is jsonb only when the value is an object', () => {
        const map = { phone: 'phone' };
        expect(buildUpdate({ phone: '555' }, map).sets[0]).toBe('phone = $1');
        const obj = buildUpdate({ phone: { ownerPhone: '555' } }, map);
        expect(obj.sets[0]).toBe('phone = $1::jsonb');
        expect(obj.params[0]).toBe('{"ownerPhone":"555"}');
    });

    test('camelRow mirrors id into _id', () => {
        expect(camelRow({ id: 'x', company_id: 'c' })).toEqual({ id: 'x', _id: 'x', companyId: 'c' });
    });

    test('identity store follows DATABASE_URL', () => {
        expect(identityStore({})).toBe('unconfigured');
        expect(identityStore({ DATABASE_URL: 'x' })).toBe('pg');
    });
});
