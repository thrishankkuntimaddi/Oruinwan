// Task planning, time and file sharing calls of the live adapter against the server's shapes
// (docs/api/tasks.md, docs/api/files-knowledge.md).
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockApi = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
class MockApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
    this.code = data?.code;
  }
}
vi.mock('./http.js', () => ({
  api: mockApi,
  ApiError: MockApiError,
  NETWORK_MESSAGE: 'offline',
  absolute: (u) => u || null,
  accessToken: () => 't',
  refreshSession: vi.fn(),
  serverUrl: () => 'https://api.example',
}));
vi.mock('./crypto.js', () => ({ conversationKey: vi.fn(), encryptText: vi.fn(), decryptPayload: vi.fn() }));
vi.mock('./realtime.js', () => ({ socketRequest: vi.fn(), socketEmit: vi.fn() }));

const { workAdapter: a, blockersOf, mapTaskTime, mapPlanningTask } = await import('./adapter.work.js');

beforeEach(() => vi.clearAllMocks());

describe('trash and time report (Tasks parity with the web)', () => {
  it('lists only trashed top-level tasks, restores and deletes for good', async () => {
    mockApi.get.mockResolvedValue({
      tasks: [
        { _id: 't1', title: 'Old plan', deleted: true, status: 'todo', issueKey: 'OR-1', deletedAt: '2026-10-01T00:00:00Z' },
        { _id: 't2', title: 'Live', deleted: false },
        { _id: 't3', title: 'Sub', deleted: true, isSubtask: true },
      ],
    });
    expect(await a.trashedTasks('w1')).toEqual([
      { id: 't1', title: 'Old plan', status: 'todo', priority: 'medium', issueKey: 'OR-1', deletedAt: '2026-10-01T00:00:00Z' },
    ]);
    expect(mockApi.get).toHaveBeenCalledWith('/v2/tasks', { workspaceId: 'w1', includeDeleted: 'true' });
    await a.restoreTask('t1');
    expect(mockApi.post).toHaveBeenCalledWith('/v2/tasks/t1/restore');
    await a.purgeTask('t1');
    expect(mockApi.del).toHaveBeenCalledWith('/v2/tasks/t1/permanent');
  });

  it('reads the time report for a period', async () => {
    mockApi.get.mockResolvedValue({
      totalSeconds: 5400,
      byUser: [{ userId: 'u1', seconds: 5400, tasks: 2, running: true, user: { _id: 'u1', username: 'ana' } }],
      byTask: [{ taskId: 't1', title: 'Ship', issueKey: 'OR-1', estimatedHours: 2, seconds: 5400 }],
    });
    const r = await a.timeReport('w1', { from: '2026-10-01T00:00:00.000Z', to: '2026-10-07T00:00:00.000Z' });
    expect(mockApi.get).toHaveBeenCalledWith('/v2/tasks/time/report', { workspaceId: 'w1', from: '2026-10-01T00:00:00.000Z', to: '2026-10-07T00:00:00.000Z' });
    expect(r.totalSeconds).toBe(5400);
    expect(r.byUser[0]).toMatchObject({ userId: 'u1', seconds: 5400, tasks: 2, running: true, user: { id: 'u1', name: 'ana' } });
    expect(r.byTask[0]).toEqual({ taskId: 't1', title: 'Ship', issueKey: 'OR-1', estimatedHours: 2, seconds: 5400 });
    await a.timeReport('w1', {});
    expect(mockApi.get).toHaveBeenLastCalledWith('/v2/tasks/time/report', { workspaceId: 'w1' });
  });
});

describe('blockers', () => {
  it('reads the blockers of a 409 TASK_BLOCKED and nothing else', () => {
    const err = new MockApiError('Blocked', 409, { code: 'TASK_BLOCKED', blockers: [{ _id: 'b1', title: 'API', issueKey: 'OR-2', status: 'in_progress' }] });
    expect(blockersOf(err)).toEqual([{ id: 'b1', title: 'API', issueKey: 'OR-2', status: 'in_progress' }]);
    expect(blockersOf(new MockApiError('Nope', 403, { message: 'x' }))).toBeNull();
    expect(blockersOf(null)).toBeNull();
  });

  it('completes anyway with ignoreBlockers', async () => {
    mockApi.put.mockResolvedValue({ task: { _id: 't1', status: 'done' } });
    await a.setTaskStatus('t1', 'done');
    expect(mockApi.put).toHaveBeenLastCalledWith('/v2/tasks/t1', { status: 'done' });
    await a.setTaskStatus('t1', 'done', undefined, { ignoreBlockers: true });
    expect(mockApi.put).toHaveBeenLastCalledWith('/v2/tasks/t1', { status: 'done', ignoreBlockers: true });
  });

  it('lists open blockers', async () => {
    mockApi.get.mockResolvedValue({ blocked: true, blockers: [{ _id: 'b1', title: 'API', status: 'todo' }] });
    expect(await a.taskBlockers('t1')).toEqual({ blocked: true, blockers: [{ id: 'b1', title: 'API', issueKey: null, status: 'todo' }] });
    expect(mockApi.get).toHaveBeenCalledWith('/v2/tasks/t1/blockers');
  });
});

describe('planning fields', () => {
  it('moves a task between sprints and milestones, null removes it', async () => {
    mockApi.put.mockResolvedValue({ task: { _id: 't1', sprintId: 's2' } });
    const t = await a.setTaskPlanning('t1', { sprintId: 's2' });
    expect(mockApi.put).toHaveBeenLastCalledWith('/v2/tasks/t1', { sprintId: 's2' });
    expect(t.sprintId).toBe('s2');
    await a.setTaskPlanning('t1', { sprintId: null, milestoneId: null });
    expect(mockApi.put).toHaveBeenLastCalledWith('/v2/tasks/t1', { sprintId: null, milestoneId: null });
  });

  it('saves a repeat rule and sends null to stop repeating', async () => {
    mockApi.put.mockResolvedValue({ task: { _id: 't1', recurring: { isRecurring: true, pattern: 'weekly', interval: 2, daysOfWeek: [1, 3], endDate: '2026-12-31T00:00:00.000Z' } } });
    const rule = { isRecurring: true, pattern: 'weekly', interval: 2, daysOfWeek: [1, 3], endDate: null, nextDue: null };
    const t = await a.setTaskRecurring('t1', rule);
    expect(mockApi.put).toHaveBeenLastCalledWith('/v2/tasks/t1', { recurring: rule });
    expect(t.recurring).toMatchObject({ isRecurring: true, pattern: 'weekly', interval: 2, daysOfWeek: [1, 3], endDate: '2026-12-31T00:00:00.000Z' });
    mockApi.put.mockResolvedValue({ task: { _id: 't1' } });
    await a.setTaskRecurring('t1', { isRecurring: false });
    expect(mockApi.put).toHaveBeenLastCalledWith('/v2/tasks/t1', { recurring: null });
    expect(mapPlanningTask({ _id: 'x', recurring: { isRecurring: false } }).recurring).toBeNull();
  });

  it('removes a dependency', async () => {
    mockApi.del.mockResolvedValue({ dependencies: [{ _id: 't3' }] });
    expect(await a.removeDependency('t1', 't2')).toEqual(['t3']);
    expect(mockApi.del).toHaveBeenCalledWith('/v2/tasks/t1/dependency/t2');
  });
});

describe('time', () => {
  it('maps the per-person breakdown', async () => {
    mockApi.get.mockResolvedValue({
      taskId: 't1', estimatedHours: 4, totalSeconds: 5400, runningSeconds: 120,
      byUser: [{ userId: 'u1', seconds: 3720, running: true, sessions: 2, user: { _id: 'u1', username: 'ana' } }],
    });
    const t = await a.taskTime('t1');
    expect(mockApi.get).toHaveBeenCalledWith('/v2/tasks/t1/time');
    expect(t).toMatchObject({ estimatedHours: 4, totalSeconds: 5400, runningSeconds: 120 });
    expect(t.byUser[0]).toMatchObject({ userId: 'u1', seconds: 3720, running: true, sessions: 2, user: { id: 'u1', name: 'ana' } });
    expect(mapTaskTime(null)).toEqual({ estimatedHours: null, totalSeconds: 0, runningSeconds: 0, byUser: [] });
  });

  it('logs time without the timer', async () => {
    mockApi.post.mockResolvedValue({ timeTracking: { totalTime: 1800 } });
    expect(await a.logTime('t1', { minutes: 30, note: 'Review' })).toEqual({ totalTime: 1800 });
    expect(mockApi.post).toHaveBeenCalledWith('/v2/tasks/t1/time/log', { minutes: 30, note: 'Review' });
    await a.logTime('t1', { minutes: 5 });
    expect(mockApi.post).toHaveBeenLastCalledWith('/v2/tasks/t1/time/log', { minutes: 5 });
  });
});

describe('file sharing', () => {
  it('grants, revokes and changes who can see a file', async () => {
    mockApi.post.mockResolvedValue({ file: { _id: 'f1', name: 'a.pdf', access: 'restricted', myRole: 'owner', permissions: [] } });
    await a.shareFile('f1', [{ userId: 'u2', role: 'edit' }]);
    expect(mockApi.post).toHaveBeenLastCalledWith('/v2/files/f1/share', { permissions: [{ user: 'u2', role: 'edit' }] });
    const f = await a.revokeFileAccess('f1', ['u2']);
    expect(mockApi.post).toHaveBeenLastCalledWith('/v2/files/f1/share', { remove: ['u2'] });
    expect(f).toMatchObject({ access: 'restricted', myRole: 'owner' });
    await a.shareFile('f1', [], { access: 'workspace' });
    expect(mockApi.post).toHaveBeenLastCalledWith('/v2/files/f1/share', { access: 'workspace' });
  });
});
