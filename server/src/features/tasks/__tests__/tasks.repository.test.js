'use strict';

const postgres = require('../../../shared/postgres');
const repo = require('../tasks.repository');

/** Fake pg pool: records every statement; `answer(text, params)` returns rows. */
function fakePool(answer = () => []) {
    const statements = [];
    const run = async (text, params = []) => {
        statements.push({ text, params });
        const rows = answer(text, params) || [];
        return { rows, rowCount: rows.length || 1 };
    };
    return { statements, query: run, connect: async () => ({ query: run, release: () => {} }) };
}

const ROW = {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa', workspace_id: 'w1', company_id: 'c1', title: 'Write docs', status: 'todo', priority: 'high',
    visibility: 'workspace', created_by: 'u1', type: 'task', task_type: 'workspace', deleted: false, deleted_for: [], tags: ['a'],
    labels: [], attachments: [], external_links: [], automation_rules: [], time_tracking: { totalTime: 0, sessions: [] },
    recurring: { isRecurring: false, pattern: null, interval: 1, nextDue: null }, story_points: '3', due_date: '2026-10-10T00:00:00Z',
    created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
};

describe('tasks repository (SQL)', () => {
    afterEach(() => postgres._setPoolForTests(undefined));

    test('findMany builds tenant-first, visibility-aware WHERE with params', async () => {
        const pool = fakePool((text) => (/FROM tasks t/.test(text) && /SELECT t.id/.test(text) ? [ROW] : []));
        postgres._setPoolForTests(pool);
        const tasks = await repo.findMany({
            workspace: 'w1', userId: 'u1', channelIds: ['ch1'], deleted: false, deletedForNot: 'u1',
            status: 'todo', assignedTo: 'u2', excludeSubtasks: true, search: '50%_off', limit: 10, skip: 5,
        });
        const sel = pool.statements[0];
        expect(sel.text).toMatch(/WHERE t\.workspace_id = \$1 AND t\.deleted = false AND NOT \(\$2 = ANY\(t\.deleted_for\)\) AND t\.status = \$3/);
        expect(sel.text).toMatch(/task_assignees a WHERE a\.task_id = t\.id AND a\.user_id = \$4/);
        expect(sel.text).toMatch(/t\.parent_task_id IS NULL AND t\.type <> 'subtask'/);
        expect(sel.text).toMatch(/t\.visibility = 'channel' AND t\.channel_id = ANY\(\$7\)/);
        expect(sel.text).toMatch(/ORDER BY t\.due_date ASC NULLS FIRST, t\.priority DESC NULLS LAST, t\.created_at DESC NULLS LAST LIMIT \$8 OFFSET \$9/);
        expect(sel.params).toEqual(['w1', 'u1', 'todo', 'u2', '%50\\%\\_off%', 'u1', ['ch1'], 10, 5]);
        // Lean-shaped result with Mongo field names.
        expect(tasks[0]).toMatchObject({ _id: ROW.id, workspace: 'w1', createdBy: 'u1', storyPoints: 3, assignedTo: [], subtasks: [] });
        expect(tasks[0].dueDate).toBeInstanceOf(Date);
        expect(tasks[0].isCreator('u1')).toBe(true);
        expect(Object.keys(tasks[0])).not.toContain('isCreator');
        // Relations loaded in one query each.
        expect(pool.statements.filter((s) => /task_assignees WHERE task_id = ANY/.test(s.text))).toHaveLength(1);
    });

    test('insert writes columns, relations and recurring_next_due inside a transaction', async () => {
        const pool = fakePool((text) => (/SELECT t.id/.test(text) ? [ROW] : []));
        postgres._setPoolForTests(pool);
        const due = new Date('2026-11-01');
        await repo.insert({
            _id: ROW.id, workspace: 'w1', title: 'Write docs', createdBy: 'u1', assignedTo: ['u2', 'u3', 'u2'],
            status: 'todo', tags: ['a'], recurring: { isRecurring: true, pattern: 'daily', interval: 1, nextDue: due },
        });
        const texts = pool.statements.map((s) => s.text);
        expect(texts[0]).toBe('BEGIN');
        const ins = pool.statements.find((s) => /^INSERT INTO tasks/.test(s.text));
        expect(ins.text).toMatch(/workspace_id.*title.*created_by.*recurring.*recurring_next_due/s);
        expect(ins.params[0]).toBe(ROW.id);
        expect(ins.params[ins.params.length - 1]).toEqual(due);
        const assignees = pool.statements.filter((s) => /INSERT INTO task_assignees/.test(s.text)).map((s) => s.params);
        expect(assignees).toEqual([[ROW.id, 'u2', 0], [ROW.id, 'u3', 1]]);
        expect(texts).toContain('COMMIT');
    });

    test('update translates Mongo field names to columns and replaces assignees', async () => {
        const pool = fakePool((text) => (/SELECT t.id/.test(text) ? [ROW] : []));
        postgres._setPoolForTests(pool);
        await repo.update(ROW.id, { status: 'done', completedBy: 'u1', blockedReason: null, dueDate: '2026-12-01', assignedTo: ['u9'], bogus: 1 });
        const upd = pool.statements.find((s) => /^UPDATE tasks SET/.test(s.text));
        expect(upd.text).toBe('UPDATE tasks SET status = $1, completed_by = $2, blocked_reason = $3, due_date = $4, updated_at = now() WHERE id = $5');
        expect(upd.params).toEqual(['done', 'u1', null, new Date('2026-12-01'), ROW.id]);
        expect(pool.statements.some((s) => /DELETE FROM task_assignees/.test(s.text))).toBe(true);
    });

    test('softDelete trashes the task and its live subtasks with the same timestamp', async () => {
        const pool = fakePool();
        postgres._setPoolForTests(pool);
        const now = new Date('2026-10-03T10:00:00Z');
        await repo.softDelete('t1', 'u1', now);
        const ups = pool.statements.filter((s) => /^UPDATE tasks SET deleted = true/.test(s.text));
        expect(ups).toHaveLength(2);
        expect(ups[0].params).toEqual(['t1', now, 'u1']);
        expect(ups[1].text).toMatch(/WHERE parent_task_id = \$1 AND deleted = false/);
        expect(ups[1].params).toEqual(['t1', now, 'u1']);
    });

    test('nextIssueKey bumps one counter row atomically', async () => {
        const pool = fakePool(() => [{ prefix: 'ACME', seq: 7 }]);
        postgres._setPoolForTests(pool);
        expect(await repo.nextIssueKey('w1', 'Acme Corp 2')).toBe('ACME-7');
        const s = pool.statements[0];
        expect(s.text).toMatch(/ON CONFLICT \(workspace_id\) DO UPDATE SET seq = task_issue_counters\.seq \+ 1\s+RETURNING prefix, seq/);
        expect(s.params).toEqual(['w1', 'ACME']);
        expect(repo.issuePrefix('42!')).toBe('TSK');
    });

    test('due-soon claim only succeeds once per due window', async () => {
        const pool = fakePool();
        postgres._setPoolForTests(pool);
        pool.query = async (text, params) => { pool.statements.push({ text, params }); return { rows: [], rowCount: 0 }; };
        expect(await repo.claimDueSoon('t1', new Date('2026-10-04'))).toBe(false);
        expect(pool.statements[0].text).toMatch(/due_soon_notified_at IS NULL OR t\.due_soon_notified_at < t\.due_date - interval '24 hours'/);
    });
});

describe('tasks repository read API', () => {
    afterEach(() => postgres._setPoolForTests(undefined));

    test('listForWorkspace defaults to live tasks and keeps caller filters', async () => {
        const pool = fakePool(() => []);
        postgres._setPoolForTests(pool);
        await repo.listForWorkspace('w1', { status: 'todo' });
        expect(pool.statements[0].text).toMatch(/WHERE t\.workspace_id = \$1 AND t\.deleted = false AND t\.status = \$2/);
        expect(pool.statements[0].params).toEqual(['w1', 'todo']);
    });

    test('countByStatus groups live tasks of one workspace', async () => {
        const pool = fakePool(() => [{ status: 'todo', n: 3 }, { status: 'done', n: 7 }]);
        postgres._setPoolForTests(pool);
        expect(await repo.countByStatus('w1')).toEqual({ todo: 3, done: 7 });
        expect(pool.statements[0].text).toMatch(/GROUP BY status/);
        expect(pool.statements[0].params).toEqual(['w1']);
    });

    test('listForUser covers created-by or assigned-to, minus hidden tasks', async () => {
        const pool = fakePool(() => []);
        postgres._setPoolForTests(pool);
        await repo.listForUser('u1');
        const { text, params } = pool.statements[0];
        expect(text).toMatch(/NOT \(\$1 = ANY\(t\.deleted_for\)\)/);
        expect(text).toMatch(/t\.created_by = \$2 OR EXISTS \(SELECT 1 FROM task_assignees a WHERE a\.task_id = t\.id AND a\.user_id = \$2\)/);
        expect(params).toEqual(['u1', 'u1']);
    });

    test('search matches title, description or issue key, newest first, and skips empty text', async () => {
        const pool = fakePool(() => []);
        postgres._setPoolForTests(pool);
        expect(await repo.search('w1', '   ')).toEqual([]);
        expect(pool.statements).toHaveLength(0);
        await repo.search('w1', 'ACME-7', 5);
        const { text, params } = pool.statements[0];
        expect(text).toMatch(/t\.title ILIKE \$2 OR t\.description ILIKE \$2 OR t\.issue_key ILIKE \$2/);
        expect(text).toMatch(/ORDER BY t\.updated_at DESC NULLS LAST LIMIT \$3/);
        expect(params).toEqual(['w1', '%ACME-7%', 5]);
    });
});
