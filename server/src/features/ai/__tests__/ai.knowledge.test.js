'use strict';

// No MongoDB: the source models are stubbed, PostgreSQL is a fake pool.
const mockModelFactory = () => ({ find: jest.fn(() => ({ select: () => ({ lean: async () => [] }) })) });
jest.mock('../../../../models/Note', () => mockModelFactory());
jest.mock('../../../../models/Task', () => mockModelFactory());
jest.mock('../../channels/channel.model.js', () => mockModelFactory());
jest.mock('../../knowledge/KnowledgePage', () => mockModelFactory(), { virtual: true });
jest.mock('../../../../../ai/config', () => ({ models: { embed: 'nomic-embed-text' } }));

const mockEmbed = jest.fn();
jest.mock('../../../../../ai/providers', () => ({ createProvider: () => ({ embed: mockEmbed }) }));
const embed = mockEmbed;

const pg = require('../../../shared/postgres');
const knowledge = require('../ai.knowledge.service');
const Note = require('../../../../models/Note');

const DIMS = knowledge.EMBEDDING_DIMS;
const unit = (i) => { const v = new Array(DIMS).fill(0); v[i] = 1; return v; };
const WS = '6ab527cbc52e6c1a9184b1e8';
const USER = '6ab525463f75165948cc0aef';

/** Fake pool: records every statement; `answers` maps a regex to rows. */
function fakePool(answers = []) {
    const statements = [];
    const handle = async (text, params = []) => {
        statements.push({ text: text.replace(/\s+/g, ' ').trim(), params });
        const hit = answers.find(([re]) => re.test(text));
        return { rows: hit ? hit[1] : [], rowCount: hit ? hit[1].length : 0 };
    };
    return { statements, query: handle, connect: async () => ({ query: handle, release: () => {} }) };
}

const withNotes = (notes) => Note.find.mockReturnValue({ select: () => ({ lean: async () => notes }) });

describe('ai knowledge on pgvector', () => {
    beforeEach(() => {
        process.env.DATABASE_URL = 'postgres://test';
        embed.mockReset();
        Note.find.mockReset();
        withNotes([]);
    });
    afterEach(() => { pg._setPoolForTests(undefined); delete process.env.DATABASE_URL; });

    test('candidates: one SQL query with vector text, workspace, visible refs and limit', async () => {
        const pool = fakePool([[/FROM ai_embeddings/, [{ kind: 'note', ref: 'n1', title: 'T', text: 'x', score: '0.9' }]]]);
        pg._setPoolForTests(pool);
        const rows = await knowledge.candidates(WS, ['n1', 'n2'], [0.5, 0.25], 3);
        const q = pool.statements[0];
        expect(q.text).toMatch(/1 - \(embedding <=> \$1::vector\) AS score/);
        expect(q.text).toMatch(/ORDER BY embedding <=> \$1::vector LIMIT \$4/);
        expect(q.params).toEqual(['[0.5,0.25]', WS, ['n1', 'n2'], 20]);
        expect(rows[0].score).toBe(0.9);
        await knowledge.candidates(WS, ['n1'], [1], 10);
        expect(pool.statements[1].params[3]).toBe(40);
    });

    test('rank: best chunk per source, threshold, title boost, order', () => {
        const rows = [
            { kind: 'note', ref: 'a', title: 'Budget plan', text: '1', score: 0.60 },
            { kind: 'note', ref: 'a', title: 'Budget plan', text: '2', score: 0.70 },
            { kind: 'task', ref: 'b', title: 'Other', text: '3', score: 0.72 },
            { kind: 'task', ref: 'c', title: 'Other', text: '4', score: 0.30 },
        ];
        const out = knowledge.rank(rows, null, 'budget review', { k: 5, minScore: 0.55 });
        expect(out.map((r) => r.ref)).toEqual(['a', 'b']);
        expect(out[0].score).toBeCloseTo(0.75); // 0.70 + title boost
        expect(out[0].text).toBe('2');
        expect(knowledge.rank(rows, null, 'budget', { k: 1, minScore: 0.55 })).toHaveLength(1);
    });

    test('rank falls back to in-process cosine when a row has no score', () => {
        const rows = [{ kind: 'note', ref: 'a', title: '', text: 'x', vector: [1, 0] }, { kind: 'note', ref: 'b', title: '', text: 'y', vector: [0, 1] }];
        const out = knowledge.rank(rows, [1, 0], 'q', { k: 5, minScore: 0.5 });
        expect(out.map((r) => r.ref)).toEqual(['a']);
    });

    test('sync: changed sources are deleted then inserted in a transaction, budget respected', async () => {
        const now = new Date('2026-10-01');
        withNotes([
            { _id: 'n1', title: 'Fresh', content: 'new text', updatedAt: now },
            { _id: 'n2', title: 'Known', content: 'same', updatedAt: new Date('2026-09-01') },
            { _id: 'n3', title: 'Also new', content: 'more', updatedAt: now },
        ]);
        const pool = fakePool([[/GROUP BY kind, ref_id/, [
            { kind: 'note', ref: 'n2', at: new Date('2026-09-15'), model: 'nomic-embed-text' },
            { kind: 'note', ref: 'gone', at: now, model: 'nomic-embed-text' },
        ]]]);
        pg._setPoolForTests(pool);
        embed.mockImplementation(async (texts) => texts.map(() => unit(1)));

        const result = await knowledge.syncWorkspace(WS, { budget: 1, background: false });
        expect(result).toEqual({ indexed: 1, pending: 1 });
        const texts = pool.statements.map((s) => s.text);
        // Removed source is purged, then exactly one source replaced: BEGIN, DELETE, INSERT, COMMIT.
        expect(texts.find((t) => /ref_id = ANY\(\$2\)/.test(t) && /DELETE/.test(t))).toBeTruthy();
        expect(pool.statements.find((s) => /DELETE FROM ai_embeddings WHERE workspace_id = \$1 AND ref_id = ANY/.test(s.text)).params).toEqual([WS, ['gone']]);
        const tx = texts.slice(texts.indexOf('BEGIN'));
        expect(tx[0]).toBe('BEGIN');
        expect(tx[1]).toMatch(/^DELETE FROM ai_embeddings WHERE workspace_id = \$1 AND kind = \$2 AND ref_id = \$3/);
        expect(tx[2]).toMatch(/^INSERT INTO ai_embeddings/);
        expect(tx[3]).toBe('COMMIT');
        const ins = pool.statements.find((s) => /^INSERT INTO ai_embeddings/.test(s.text));
        expect(ins.params.slice(0, 4)).toEqual([WS, 'note', 'n1', 0]);
        expect(ins.params[6]).toMatch(/^\[0,1,0/);
        expect(ins.params[7]).toBe('nomic-embed-text');
        expect(embed).toHaveBeenCalledTimes(1);
        expect(embed.mock.calls[0][0][0]).toMatch(/^search_document: Fresh/);
    });

    test('sync: a vector of the wrong size is skipped, not inserted', async () => {
        withNotes([{ _id: 'n1', title: 'Bad', content: 'x', updatedAt: new Date() }]);
        const pool = fakePool();
        pg._setPoolForTests(pool);
        embed.mockResolvedValue([[0.1, 0.2]]);
        await knowledge.syncWorkspace(WS, { background: false });
        expect(pool.statements.some((s) => /^INSERT/.test(s.text))).toBe(false);
        expect(pool.statements.map((s) => s.text)).toContain('COMMIT');
    });

    test('search wires sync, visibility, embed and candidates together', async () => {
        const pool = fakePool([[/FROM ai_embeddings/, [{ kind: 'note', ref: 'n1', title: 'Roadmap', text: 'the plan', score: '0.8' }]]]);
        pg._setPoolForTests(pool);
        withNotes([{ _id: 'n1' }]);
        embed.mockResolvedValue([unit(0)]);
        const out = await knowledge.search(WS, USER, 'roadmap plan');
        expect(out).toEqual([{ type: 'note', id: 'n1', title: 'Roadmap', snippet: 'the plan', score: 0.85 }]);
        expect(embed).toHaveBeenCalledWith(['search_query: roadmap plan'], { model: 'nomic-embed-text' });
    });

    test('forgetSources deletes by kind and ids', async () => {
        const pool = fakePool();
        pg._setPoolForTests(pool);
        await knowledge.forgetSources('note', ['a', 'b']);
        expect(pool.statements[0].params).toEqual(['note', ['a', 'b']]);
    });

    test('without DATABASE_URL search and contextFor return [] and touch nothing', async () => {
        delete process.env.DATABASE_URL;
        const pool = fakePool();
        pg._setPoolForTests(pool);
        expect(await knowledge.search(WS, USER, 'anything at all')).toEqual([]);
        expect(await knowledge.contextFor(WS, USER, 'anything at all here')).toEqual([]);
        expect(await knowledge.syncWorkspace(WS)).toEqual({ indexed: 0, pending: 0 });
        expect(pool.statements).toHaveLength(0);
        expect(embed).not.toHaveBeenCalled();
    });
});
