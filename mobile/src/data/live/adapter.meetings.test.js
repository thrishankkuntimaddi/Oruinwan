// Meeting records against the unified server contract (docs/api/meetings-unified.md): the
// summary is an object, action items are one list, lists come in pages by status.
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockApi = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
vi.mock('./http.js', () => ({
  api: mockApi,
  ApiError: class extends Error {},
  NETWORK_MESSAGE: 'offline',
  absolute: (u) => u || null,
  accessToken: () => 't',
  refreshSession: vi.fn(),
  serverUrl: () => 'https://api.example',
}));
vi.mock('./crypto.js', () => ({ conversationKey: vi.fn(), encryptText: vi.fn(), decryptPayload: vi.fn(), withCurrentKey: async (conv, getKey, send) => send(await getKey()) }));
vi.mock('./realtime.js', () => ({ socketRequest: vi.fn(), socketEmit: vi.fn() }));

const { workAdapter: a, mapMeeting, mapSummary, mapActionItem } = await import('./adapter.work.js');

beforeEach(() => vi.clearAllMocks());

const record = {
  _id: 'm1',
  kind: 'huddle',
  title: 'Huddle in #design',
  status: 'completed',
  workspaceId: 'w1',
  scheduledStart: null,
  startTime: '2026-10-20T10:00:00.000Z',
  startedAt: '2026-10-20T10:00:00.000Z',
  endedAt: '2026-10-20T10:30:00.000Z',
  durationSec: 1800,
  conversation: { kind: 'channel', id: 'c1', name: 'design' },
  huddleId: 'h-123',
  createdBy: { _id: 'u1', username: 'alice' },
  participantIds: ['u1', 'u2'],
  invitees: [],
  attendees: [{ userId: 'u2', username: 'bob', joinedAt: '2026-10-20T10:01:00.000Z' }],
  noteId: 'n1',
  actionItems: [
    { id: 'a1', text: 'Draft notes', assigneeId: 'u2', assignedTo: { _id: 'u2', username: 'bob' }, dueDate: '2026-11-01T00:00:00.000Z', done: false, status: 'pending', taskId: null, source: 'ai' },
    { _id: 'a2', text: 'Ship', assignedTo: 'u1', status: 'done', taskId: 't9' },
  ],
  summary: { text: 'We agreed to ship Monday.', generatedAt: '2026-10-20T10:31:00.000Z', by: 'u1', source: 'ai', messageId: null },
  hasRecording: true,
  hasTranscript: true,
  hasContent: true,
};

describe('mapMeeting (unified record)', () => {
  it('reads the summary object, the conversation and the call fields', () => {
    const m = mapMeeting(record);
    expect(m).toMatchObject({
      id: 'm1',
      kind: 'huddle',
      status: 'completed',
      start: '2026-10-20T10:00:00.000Z',
      end: null,
      durationSec: 1800,
      conversation: { kind: 'channel', id: 'c1', name: 'design' },
      huddleId: 'h-123',
      noteId: 'n1',
      participantIds: ['u1', 'u2'],
      attendees: [{ id: 'u2', name: 'bob' }],
      hasRecording: true,
      summary: { text: 'We agreed to ship Monday.', source: 'ai', by: 'u1', generatedAt: '2026-10-20T10:31:00.000Z' },
    });
    expect(m.organizer).toMatchObject({ id: 'u1', name: 'alice' });
  });

  it('maps action items: assignee, due date, done, task link', () => {
    const [first, second] = mapMeeting(record).actionItems;
    expect(first).toMatchObject({ id: 'a1', text: 'Draft notes', assigneeId: 'u2', dueDate: '2026-11-01T00:00:00.000Z', done: false, source: 'ai', taskId: null });
    expect(first.assignee).toMatchObject({ id: 'u2', name: 'bob' });
    expect(second).toMatchObject({ id: 'a2', assigneeId: 'u1', done: true, status: 'done', taskId: 't9' });
  });

  it('accepts an older text summary, and none', () => {
    expect(mapSummary('Plain text')).toMatchObject({ text: 'Plain text', source: null });
    expect(mapSummary('')).toBeNull();
    expect(mapSummary(null)).toBeNull();
    expect(mapSummary({ text: '   ' })).toBeNull();
    expect(mapMeeting({ _id: 'x', summary: null }).summary).toBeNull();
  });

  it('a scheduled meeting runs as meeting-<id> and ends after its duration', () => {
    const m = mapMeeting({ _id: 'm2', title: 'Planning', scheduledStart: '2026-10-22T10:00:00.000Z', duration: 30, channelId: 'c1' });
    expect(m).toMatchObject({ kind: 'scheduled', huddleId: 'meeting-m2', end: '2026-10-22T10:30:00.000Z', conversation: { kind: 'channel', id: 'c1' } });
    expect(mapMeeting({ _id: 'm3', workspaceId: 'w1' }).conversation).toEqual({ kind: 'workspace', id: 'w1', name: null });
  });

  it('mapActionItem treats done:true as done without a status', () => {
    expect(mapActionItem({ id: 'q', text: 'x', done: true })).toMatchObject({ done: true, status: 'done' });
  });
});

describe('meeting calls', () => {
  it('pages lists by status with before / after cursors and search', async () => {
    mockApi.get.mockResolvedValueOnce({ meetings: [record], hasMore: true, nextBefore: '2026-10-20T10:00:00.000Z|m1' });
    const page = await a.meetingsPage('w1', { status: 'past', q: ' design ' });
    expect(mockApi.get).toHaveBeenCalledWith('/v2/meetings', { workspaceId: 'w1', status: 'past', limit: 20, q: 'design' });
    expect(page).toMatchObject({ hasMore: true, cursor: '2026-10-20T10:00:00.000Z|m1' });
    expect(page.meetings[0].id).toBe('m1');

    mockApi.get.mockResolvedValueOnce({ meetings: [], hasMore: false, nextAfter: null });
    await a.meetingsPage('w1', { status: 'upcoming', cursor: 'c-1' });
    expect(mockApi.get).toHaveBeenLastCalledWith('/v2/meetings', { workspaceId: 'w1', status: 'upcoming', limit: 20, after: 'c-1' });

    mockApi.get.mockResolvedValueOnce({ meetings: [], hasMore: false, nextBefore: null });
    await a.meetingsPage('w1', { status: 'live', cursor: 'b-1' });
    expect(mockApi.get).toHaveBeenLastCalledWith('/v2/meetings', { workspaceId: 'w1', status: 'live', limit: 20, before: 'b-1' });
  });

  it('summarize returns the summary object; edits go through PUT', async () => {
    mockApi.post.mockResolvedValueOnce({ summary: 'Text', meetingSummary: { text: 'Text', source: 'ai', by: 'me' }, source: 'transcript' });
    expect(await a.summarizeMeeting('m1')).toMatchObject({ summary: { text: 'Text', source: 'ai' }, source: 'transcript' });
    mockApi.put.mockResolvedValueOnce({ summary: { text: 'Mine', source: 'manual' } });
    expect(await a.saveSummary('m1', 'Mine')).toMatchObject({ text: 'Mine', source: 'manual' });
    expect(mockApi.put).toHaveBeenCalledWith('/v2/meetings/m1/summary', { text: 'Mine' });
  });

  it('action items: add, edit, toggle, convert, delete answer with the list', async () => {
    const list = { actionItems: [{ id: 'a1', text: 'X', status: 'pending', done: false }] };
    mockApi.post.mockResolvedValueOnce(list);
    expect(await a.addActionItem('m1', { text: 'X', assigneeId: 'u2', dueDate: '2026-11-01T00:00:00.000Z' })).toHaveLength(1);
    expect(mockApi.post).toHaveBeenLastCalledWith('/v2/meetings/m1/action-items', { text: 'X', assigneeId: 'u2', dueDate: '2026-11-01T00:00:00.000Z' });

    mockApi.patch.mockResolvedValueOnce(list);
    await a.updateActionItem('m1', 'a1', { assigneeId: null, dueDate: null, text: 'Y' });
    expect(mockApi.patch).toHaveBeenLastCalledWith('/v2/meetings/m1/action-items/a1', { text: 'Y', assigneeId: null, dueDate: null });

    mockApi.post.mockResolvedValueOnce(list);
    await a.toggleActionItem('m1', 'a1');
    expect(mockApi.post).toHaveBeenLastCalledWith('/v2/meetings/m1/action-items/a1/toggle', {});

    mockApi.post.mockResolvedValueOnce({ actionItems: [{ id: 'a1', text: 'X', taskId: 't1' }], task: { _id: 't1' } });
    expect(await a.convertActionItem('m1', 'a1')).toMatchObject({ taskId: 't1', actionItems: [{ id: 'a1', taskId: 't1' }] });

    mockApi.del.mockResolvedValueOnce({ removed: true, actionItems: [] });
    expect(await a.deleteActionItem('m1', 'a1')).toEqual([]);
  });

  it('notes, end and by-huddle', async () => {
    mockApi.post.mockResolvedValueOnce({ noteId: 'n7', created: true });
    expect(await a.meetingNote('m1')).toBe('n7');
    mockApi.patch.mockResolvedValueOnce({ meeting: { ...record, status: 'completed' } });
    expect((await a.endMeeting('m1')).status).toBe('completed');
    expect(mockApi.patch).toHaveBeenLastCalledWith('/v2/meetings/m1/end', {});
    mockApi.get.mockResolvedValueOnce({ meeting: record });
    expect((await a.meetingByHuddle('h-123')).id).toBe('m1');
    expect(mockApi.get).toHaveBeenLastCalledWith('/v2/meetings/by-huddle/h-123');
    mockApi.get.mockRejectedValueOnce(Object.assign(new Error('none'), { status: 404 }));
    expect(await a.meetingByHuddle('h-x')).toBeNull();
  });
});
