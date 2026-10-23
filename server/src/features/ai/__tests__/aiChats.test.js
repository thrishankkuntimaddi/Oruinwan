'use strict';

/**
 * AI panel history: saved per person and workspace, only for members, never shared.
 * The model is an in-memory fake with the few query shapes the service uses.
 */
const express = require('express');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    req.user = { sub: req.headers['x-user'] };
    next();
});

const WS = '64b00000000000000000000a';
const OTHER_WS = '64b00000000000000000000b';
const ALICE = '64b0000000000000000000a1';
const BOB = '64b0000000000000000000b1';

jest.mock('../../../identity', () => ({
    workspaces: {
        findById: jest.fn(async (id) => (String(id) === '64b00000000000000000000a'
            ? { _id: id, members: [{ user: '64b0000000000000000000a1', status: 'active' }, { user: '64b0000000000000000000b1', status: 'active' }] }
            : { _id: id, members: [{ user: '64b0000000000000000000b1', status: 'active' }] })),
    },
}));

jest.mock('../aiChat.model', () => {
    const rows = [];
    let clock = 0;
    const matches = (row, f) => Object.entries(f).every(([k, v]) => {
        if (k === '_id' && v && v.$in) return v.$in.includes(row._id);
        return String(row[k]) === String(v);
    });
    const chain = (list) => {
        let out = [...list];
        const q = {
            sort: () => { out.sort((a, b) => b.updatedAt - a.updatedAt); return q; },
            skip: (n) => { out = out.slice(n); return q; },
            limit: (n) => { out = out.slice(0, n); return q; },
            select: () => q,
            lean: () => Promise.resolve(out.map((r) => ({ ...r }))),
        };
        return q;
    };
    return {
        rows,
        find: jest.fn((f) => chain(rows.filter((r) => matches(r, f)))),
        findOne: jest.fn((f) => ({ lean: async () => { const r = rows.find((x) => matches(x, f)); return r ? { ...r } : null; } })),
        findOneAndUpdate: jest.fn((f, update, opts = {}) => ({
            lean: async () => {
                let row = rows.find((x) => matches(x, f));
                if (!row && !opts.upsert) return null;
                if (!row) { row = { _id: `r${rows.length + 1}`, ...f }; rows.push(row); }
                Object.assign(row, update.$set, { updatedAt: ++clock });
                return { ...row };
            },
        })),
        deleteOne: jest.fn(async (f) => {
            const i = rows.findIndex((x) => matches(x, f));
            if (i >= 0) rows.splice(i, 1);
            return { deletedCount: i >= 0 ? 1 : 0 };
        }),
        deleteMany: jest.fn(async (f) => {
            const before = rows.length;
            for (let i = rows.length - 1; i >= 0; i -= 1) if (matches(rows[i], f)) rows.splice(i, 1);
            return { deletedCount: before - rows.length };
        }),
    };
});

const h = require('../../../shared/__tests__/gateHarness');
const { cleanChat } = require('../aiChats.service');

function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/ai/chats', require('../aiChats.routes'));
    return a;
}

const msgs = [
    { role: 'user', content: 'What is due this week?', at: '2026-10-22T10:00:00Z' },
    { role: 'assistant', text: 'Two tasks: PUL-12 and PUL-31.', at: '2026-10-22T10:00:05Z' },
];

describe('AI history', () => {
    test('saves, lists, opens, renames and deletes a conversation', async () => {
        const saved = await h.call(app(), 'PUT', '/api/ai/chats/ai-abc123', ALICE, { workspaceId: WS, messages: msgs });
        expect(saved.status).toBe(200);
        expect(saved.body.chat).toMatchObject({ id: 'ai-abc123', title: 'What is due this week?', messageCount: 2 });

        const list = await h.call(app(), 'GET', `/api/ai/chats?workspaceId=${WS}`, ALICE);
        expect(list.body.chats.map((c) => c.id)).toEqual(['ai-abc123']);

        const one = await h.call(app(), 'GET', `/api/ai/chats/ai-abc123?workspaceId=${WS}`, ALICE);
        expect(one.body.chat.messages.map((m) => m.text)).toEqual(['What is due this week?', 'Two tasks: PUL-12 and PUL-31.']);

        const renamed = await h.call(app(), 'PATCH', '/api/ai/chats/ai-abc123', ALICE, { workspaceId: WS, title: 'This week' });
        expect(renamed.body.chat.title).toBe('This week');

        const del = await h.call(app(), 'DELETE', `/api/ai/chats/ai-abc123?workspaceId=${WS}`, ALICE);
        expect(del.body.ok).toBe(true);
        const after = await h.call(app(), 'GET', `/api/ai/chats?workspaceId=${WS}`, ALICE);
        expect(after.body.chats).toEqual([]);
    });

    test('nobody sees another person\'s conversations', async () => {
        await h.call(app(), 'PUT', '/api/ai/chats/ai-alice1', ALICE, { workspaceId: WS, messages: msgs });
        const bob = await h.call(app(), 'GET', `/api/ai/chats?workspaceId=${WS}`, BOB);
        expect(bob.body.chats).toEqual([]);
        const peek = await h.call(app(), 'GET', `/api/ai/chats/ai-alice1?workspaceId=${WS}`, BOB);
        expect(peek.status).toBe(404);
    });

    test('only members of the workspace can use its history', async () => {
        const res = await h.call(app(), 'GET', `/api/ai/chats?workspaceId=${OTHER_WS}`, ALICE);
        expect(res.status).toBe(403);
        const missing = await h.call(app(), 'GET', '/api/ai/chats', ALICE);
        expect(missing.status).toBe(400);
    });

    test('rejects bad ids and empty conversations', async () => {
        expect((await h.call(app(), 'PUT', '/api/ai/chats/x', ALICE, { workspaceId: WS, messages: msgs })).status).toBe(400);
        expect((await h.call(app(), 'PUT', '/api/ai/chats/ai-empty1', ALICE, { workspaceId: WS, messages: [] })).status).toBe(400);
    });

    test('cleanChat trims sizes and drops unknown roles', () => {
        const clean = cleanChat({ messages: [{ role: 'system', text: 'x' }, { role: 'user', text: 'a'.repeat(30000) }] });
        expect(clean.messages).toHaveLength(1);
        expect(clean.messages[0].text).toHaveLength(20000);
        expect(clean.title.length).toBeLessThanOrEqual(120);
        expect(cleanChat({ messages: [{ role: 'user', text: '   ' }] })).toBeNull();
    });
});
