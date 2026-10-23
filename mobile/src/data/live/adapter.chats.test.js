// Chats calls of the live adapter against the server's real shapes: saved messages, reminders,
// polls, checklists, edit history, threads, AI on decrypted text and server search.
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockApi = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
vi.mock('./http.js', () => ({ api: mockApi, absolute: (u) => (u ? `https://api.example${u}` : null) }));
const mockEncrypt = vi.fn(async (key, text) => ({ ciphertext: `enc(${text})`, messageIv: 'iv', isEncrypted: true }));
const mockDecrypt = vi.fn(async (key, p) => String(p.ciphertext).replace(/^enc\((.*)\)$/, '$1'));
vi.mock('./crypto.js', () => ({
  conversationKey: vi.fn(async () => 'key'),
  encryptText: (...a) => mockEncrypt(...a),
  decryptPayload: (...a) => mockDecrypt(...a),
}));
vi.mock('../e2ee.js', () => ({ useE2ee: { getState: () => ({ status: 'ready' }) } }));

const { chatsAdapter, convOf, mapMessageInfo, mapPoll, messageExtras, parseChecklistText } = await import('./adapter.chats.js');

const mapMessage = vi.fn(async (conv, m) => ({ id: String(m._id), convId: conv.id, text: m.text || '', state: 'ok', parentId: m.parentId || null }));
const a = chatsAdapter({ mapMessage, me: () => ({ id: 'me' }), ws: () => 'w1', dm: () => null });

beforeEach(() => vi.clearAllMocks());

describe('mapping', () => {
  it('maps polls with enriched and plain voter ids', () => {
    const poll = mapPoll({
      question: 'Lunch?',
      options: [{ text: 'Pizza', votes: [{ _id: 'u1', username: 'ana' }, 'u2'] }, { text: 'Salad', votes: [] }],
      allowMultiple: false,
      isActive: true,
      createdBy: 'u1',
      totalVotes: 2,
    });
    expect(poll.options[0].votes).toEqual([{ id: 'u1', name: 'ana' }, { id: 'u2', name: null }]);
    expect(poll).toMatchObject({ question: 'Lunch?', active: true, totalVotes: 2, createdBy: 'u1' });
    expect(mapPoll(null)).toBeNull();
  });

  it('adds saved, edit, thread and checklist state', () => {
    const extras = messageExtras(
      { type: 'checklist', checklist: [{ checked: true, checkedBy: 'u1' }, { checked: false }], bookmarkedBy: ['me'], editHistory: [{}, {}], resolvedThreadAt: '2026-01-01', followers: ['x'] },
      'me',
    );
    expect(extras).toMatchObject({ type: 'checklist', saved: true, editCount: 2, resolved: true, following: false, poll: null });
    expect(extras.checklist).toEqual([
      { checked: true, checkedBy: 'u1', text: '' },
      { checked: false, checkedBy: null, text: '' },
    ]);
    expect(messageExtras({}, 'me')).toMatchObject({ type: 'message', saved: false, editCount: 0, checklist: null });
  });

  it('reads checklist text and conversations', () => {
    expect(parseChecklistText('{"title":"Launch","items":["a",{"text":"b"}]}')).toEqual({ title: 'Launch', items: ['a', 'b'] });
    expect(parseChecklistText('not json')).toBeNull();
    expect(convOf({ channel: { _id: 'c1', name: 'general' } })).toEqual({ kind: 'channel', id: 'c1', name: '#general' });
    expect(convOf({ dm: 'd1' })).toEqual({ kind: 'dm', id: 'd1', name: null });
    expect(convOf({})).toBeNull();
  });
});

describe('saved and reminders', () => {
  it('toggles and lists saved messages of this workspace', async () => {
    mockApi.post.mockResolvedValueOnce({ bookmarked: true, messageId: 'm1' });
    expect(await a.toggleSave({ kind: 'channel', id: 'c1' }, 'm1')).toBe(true);
    expect(mockApi.post).toHaveBeenCalledWith('/v2/messages/m1/bookmark', {});

    mockApi.get.mockResolvedValueOnce({
      messages: [
        { _id: 'm1', channel: { _id: 'c1', name: 'general' }, workspace: 'w1', text: 'hi' },
        { _id: 'm2', dm: 'd1', workspace: 'w2' },
      ],
    });
    const list = await a.savedMessages('w1');
    expect(list).toHaveLength(1);
    expect(list[0].conv).toEqual({ kind: 'channel', id: 'c1', name: '#general' });
    expect(list[0].message.id).toBe('m1');
  });

  it('sets, lists and cancels reminders', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true, reminder: { _id: 'r1', remindAt: '2026-02-01T09:00:00.000Z' } });
    const at = new Date('2026-02-01T09:00:00.000Z');
    expect(await a.remindMe({ kind: 'dm', id: 'd1' }, 'm1', at, 'call back')).toEqual({ id: 'r1', at: '2026-02-01T09:00:00.000Z' });
    expect(mockApi.post).toHaveBeenCalledWith('/v2/messages/m1/reminder', { remindAt: at.toISOString(), note: 'call back' });

    mockApi.get.mockResolvedValueOnce({ reminders: [{ _id: 'r1', remindAt: '2026-02-01', note: 'n', messageId: { _id: 'm1', dm: 'd1', workspace: 'w1' } }] });
    const list = await a.reminders('w1');
    expect(list[0]).toMatchObject({ id: 'r1', note: 'n', conv: { kind: 'dm', id: 'd1' } });

    mockApi.del.mockResolvedValueOnce({ success: true });
    await a.cancelReminder('r1');
    expect(mockApi.del).toHaveBeenCalledWith('/v2/messages/reminders/r1');
  });

  it('reads a fired reminder for the banner', async () => {
    const r = await a.readReminder({ reminderId: 'r9', note: 'look', message: { _id: 'm3', channel: 'c1' } });
    expect(r).toMatchObject({ id: 'r9', note: 'look', conv: { kind: 'channel', id: 'c1' } });
    expect(r.message.id).toBe('m3');
  });
});

describe('polls, checklists and tasks', () => {
  it('creates and votes on polls', async () => {
    mockApi.post.mockResolvedValueOnce({ message: { _id: 'p1' } });
    await a.createPoll({ kind: 'dm', id: 'd1' }, { question: 'Q', options: ['a', 'b'] });
    expect(mockApi.post).toHaveBeenCalledWith('/v2/messages/poll', { poll: { question: 'Q', options: ['a', 'b'] }, dmId: 'd1' });

    mockApi.post.mockResolvedValueOnce({ message: { poll: { question: 'Q', options: [{ text: 'a', votes: [{ _id: 'me', username: 'me' }] }], isActive: true } } });
    const poll = await a.votePoll(null, 'p1', [0]);
    expect(mockApi.post).toHaveBeenLastCalledWith('/v2/messages/p1/vote', { optionIndices: [0] });
    expect(poll.totalVotes).toBe(1);
  });

  it('sends checklists encrypted, with only the item count in clear', async () => {
    mockApi.post.mockResolvedValueOnce({ message: { _id: 'k1' } });
    await a.sendChecklist({ kind: 'channel', id: 'c1' }, { title: 'Go', items: ['one', ' ', 'two'] });
    const [path, body] = mockApi.post.mock.calls[0];
    expect(path).toBe('/v2/messages/channel');
    expect(body).toMatchObject({ type: 'checklist', checklistCount: 2, channelId: 'c1', ciphertext: 'enc({"title":"Go","items":["one","two"]})' });
    expect(JSON.stringify(body)).not.toContain('"text"');

    mockApi.post.mockResolvedValueOnce({ checklist: [{ checked: true }, { checked: false }] });
    expect(await a.toggleChecklistItem(null, 'k1', 0)).toEqual([
      { checked: true, checkedBy: null, text: '' },
      { checked: false, checkedBy: null, text: '' },
    ]);
  });

  it('converts a message to a task', async () => {
    mockApi.post.mockResolvedValueOnce({ task: { _id: 't1', title: 'Fix', status: 'todo' } });
    const t = await a.convertToTask({ kind: 'channel', id: 'c1' }, 'm1', { title: 'Fix', description: ' ', priority: 'high', due: '2026-03-01' });
    expect(t).toEqual({ id: 't1', title: 'Fix', status: 'todo' });
    const body = mockApi.post.mock.calls[0][1];
    expect(body).toMatchObject({ title: 'Fix', priority: 'high' });
    expect(body.description).toBeUndefined();
    expect(body.dueDate).toMatch(/^2026-0[23]/);
  });
});

describe('edit history and threads', () => {
  it('decrypts every version on the phone', async () => {
    mockApi.get.mockResolvedValueOnce({
      canRestore: true,
      current: { version: 3, isEncrypted: true, ciphertext: 'enc(v3)', messageIv: 'iv', editedAt: 't3' },
      versions: [
        { index: 0, version: 1, isEncrypted: true, ciphertext: 'enc(v1)', messageIv: 'iv' },
        { index: 1, version: 2, isEncrypted: false, text: 'v2' },
      ],
    });
    const h = await a.messageVersions({ kind: 'channel', id: 'c1' }, 'm1');
    expect(h.canRestore).toBe(true);
    expect(h.versions.map((v) => v.text)).toEqual(['v1', 'v2', 'v3']);
    expect(h.versions[2].current).toBe(true);
  });

  it('loads thread state and follows / resolves', async () => {
    mockApi.get.mockResolvedValueOnce({
      parent: { _id: 'p' },
      replies: [{ _id: 'r2', createdAt: '2026-01-02' }, { _id: 'r1', createdAt: '2026-01-01' }],
      participants: [{ _id: 'u1', username: 'ana', profilePicture: '/a.png', replyCount: 2 }],
      resolved: true,
      resolvedBy: { _id: 'u1', username: 'ana' },
      followStatus: { following: true, followerCount: 3 },
    });
    const t = await a.threadInfo({ kind: 'channel', id: 'c1' }, 'p');
    expect(t.participants).toEqual([{ id: 'u1', username: 'ana', avatarUrl: 'https://api.example/a.png', replyCount: 2 }]);
    expect(t).toMatchObject({ resolved: true, following: true, followerCount: 3, resolvedBy: { id: 'u1', username: 'ana' } });

    mockApi.del.mockResolvedValueOnce({ following: false, followerCount: 2 });
    expect(await a.followThread('p', false)).toEqual({ following: false, followerCount: 2 });
    expect(mockApi.del).toHaveBeenCalledWith('/threads/p/follow');
    mockApi.post.mockResolvedValueOnce({ isResolved: false });
    expect(await a.resolveThread('p')).toBe(false);
    expect(mockApi.post).toHaveBeenCalledWith('/threads/v2/p/resolve', {});
  });
});

describe('AI and search', () => {
  it('sends decrypted text to the AI endpoints', async () => {
    mockApi.post.mockResolvedValueOnce({ suggestions: ['Sure', '', 'Thanks!'] });
    expect(await a.smartReplies('w1', [{ sender: 'Ana', text: 'Ready?', isMe: false }])).toEqual(['Sure', 'Thanks!']);
    expect(mockApi.post).toHaveBeenCalledWith('/ai/smart-replies', { workspaceId: 'w1', messages: [{ sender: 'Ana', text: 'Ready?', isMe: false }] });

    mockApi.post.mockResolvedValueOnce({ translated: 'Hola', detectedLang: 'en' });
    expect(await a.translate('w1', 'Hello', 'es')).toEqual({ text: 'Hola', detectedLang: 'en' });

    mockApi.post.mockResolvedValueOnce({ summary: 'S' });
    expect(await a.summarizeThread('w1', 'p', 'parent', [{ sender: 'A', text: 'x' }])).toBe('S');
    expect(mockApi.post).toHaveBeenLastCalledWith('/v2/messages/ai/thread-summary', { workspaceId: 'w1', parentMessageId: 'p', parentText: 'parent', replies: [{ sender: 'A', text: 'x' }] });

    mockApi.post.mockResolvedValueOnce({ text: 'Summary' });
    expect(await a.summarizeConversation('w1', [{ sender: 'A', text: 'x' }], { title: '#g', mode: 'action_items' })).toBe('Summary');
    expect(mockApi.post).toHaveBeenLastCalledWith('/ai/conversation', { workspaceId: 'w1', messages: [{ sender: 'A', text: 'x' }], mode: 'action_items', title: '#g' });
  });

  it('asks company knowledge', async () => {
    mockApi.post.mockResolvedValueOnce({ answer: 'A', fallback: false, references: [{ type: 'knowledge', title: 'Handbook', id: 'k1' }, { type: 'meeting', title: 'Sync', id: 'mt1' }] });
    const r = await a.askKnowledge('w1', 'How?');
    expect(r.references).toEqual([
      { kind: 'page', id: 'k1', label: 'Handbook' },
      { kind: 'meeting', id: 'mt1', label: 'Sync' },
    ]);
  });

  it('searches pages and files on the server', async () => {
    mockApi.get.mockResolvedValueOnce({ knowledge: [{ id: 'k1', title: 'Plan', icon: '🗺', snippet: 's' }], files: [{ id: 'f1', name: 'a.pdf', mimeType: 'application/pdf', createdBy: { name: 'ana' } }] });
    const r = await a.searchServer('w1', { q: 'plan', type: 'knowledge', semantic: 'false' });
    expect(mockApi.get).toHaveBeenCalledWith('/search', { q: 'plan', type: 'knowledge', semantic: 'false', workspaceId: 'w1', limit: 30 });
    expect(r.knowledge[0]).toMatchObject({ id: 'k1', title: 'Plan', icon: '🗺' });
    expect(r.files[0]).toMatchObject({ id: 'f1', name: 'a.pdf', owner: 'ana' });
    expect(await a.searchServer('w1', { q: '' })).toEqual({ knowledge: [], files: [], tasks: [], notes: [] });
  });

  it('reads the channel mention policy', async () => {
    mockApi.get.mockResolvedValueOnce({ isMuted: false, postingPolicy: 'everyone', broadcastMentions: 'admins', canManage: false });
    expect(await a.channelPolicy('c1')).toEqual({ broadcastMentions: 'admins', canManage: false, postingPolicy: 'everyone', muted: false });
  });
});

describe('conversation tools (the web header menu)', () => {
  it('loads pinned messages for a channel or a DM', async () => {
    mockApi.get.mockResolvedValueOnce({ messages: [{ _id: 'p1', text: 'Pinned' }] });
    expect(await a.pinnedMessages({ kind: 'channel', id: 'c1' })).toEqual([expect.objectContaining({ id: 'p1', convId: 'c1' })]);
    expect(mockApi.get).toHaveBeenLastCalledWith('/v2/messages/pinned', { channelId: 'c1' });
    mockApi.get.mockResolvedValueOnce({ messages: [] });
    await a.pinnedMessages({ kind: 'dm', id: 'd1' });
    expect(mockApi.get).toHaveBeenLastCalledWith('/v2/messages/pinned', { dmId: 'd1' });
  });

  it('lists channel threads by latest reply', async () => {
    mapMessage.mockImplementation(async (conv, m) => ({ id: String(m._id), convId: conv.id, lastReplyAt: m.lastReplyAt, at: m.createdAt }));
    mockApi.get.mockResolvedValueOnce({ threads: [{ _id: 't1', lastReplyAt: '2026-01-01' }, { _id: 't2', lastReplyAt: '2026-02-01' }] });
    const list = await a.channelThreads('c1');
    expect(mockApi.get).toHaveBeenCalledWith('/threads/channels/c1/threads');
    expect(list.map((m) => m.id)).toEqual(['t2', 't1']);
  });

  it('reads and changes DM mute and block state, clears and deletes', async () => {
    mockApi.get.mockResolvedValueOnce({ isMuted: true, isBlocked: false, isBlockedByOther: true, isGroup: false });
    expect(await a.dmStatus('d1')).toEqual({ muted: true, blocked: false, blockedByOther: true, isGroup: false });
    await a.setDmMuted('d1', true);
    expect(mockApi.post).toHaveBeenLastCalledWith('/v2/dm/d1/mute', {});
    await a.setDmMuted('d1', false);
    expect(mockApi.del).toHaveBeenLastCalledWith('/v2/dm/d1/mute');
    await a.setDmBlocked('d1', true);
    expect(mockApi.post).toHaveBeenLastCalledWith('/v2/dm/d1/block', {});
    await a.setDmBlocked('d1', false);
    expect(mockApi.del).toHaveBeenLastCalledWith('/v2/dm/d1/block');
    await a.clearDm('d1');
    expect(mockApi.post).toHaveBeenLastCalledWith('/v2/dm/d1/clear', {});
    await a.deleteDm('d1');
    expect(mockApi.del).toHaveBeenLastCalledWith('/v2/dm/d1');
  });

  it('maps message info: readers with times, the rest as not read yet, never the sender', async () => {
    const data = {
      message: { _id: 'm1', sender: { _id: 'me', username: 'me' }, createdAt: '2026-03-01T10:00:00Z', isPinned: false },
      members: [{ _id: 'me', username: 'me' }, { _id: 'u1', username: 'ana', profilePicture: '/a.png' }, { _id: 'u2', username: 'ben' }, { _id: 'u3', username: 'cy' }],
      readByUsers: [{ _id: 'u1', username: 'ana', readAt: '2026-03-01T10:05:00Z' }, { _id: 'me', username: 'me' }],
      readBy: ['u1', 'u2', 'me'],
      editedAt: null,
      editCount: 0,
    };
    const info = mapMessageInfo(data, 'me');
    expect(info.sentAt).toBe('2026-03-01T10:00:00Z');
    expect(info.recipients).toBe(3);
    expect(info.read).toEqual([
      { id: 'u1', username: 'ana', avatarUrl: 'https://api.example/a.png', readAt: '2026-03-01T10:05:00Z' },
      { id: 'u2', username: 'ben', avatarUrl: null, readAt: null },
    ]);
    expect(info.unread.map((u) => u.id)).toEqual(['u3']);
    expect(info.pinnedBy).toBeNull();

    mockApi.get.mockResolvedValueOnce(data);
    expect((await a.messageInfo({ kind: 'dm', id: 'd1' }, 'm1', 'me')).read).toHaveLength(2);
    expect(mockApi.get).toHaveBeenCalledWith('/v2/messages/m1/info');
  });

  it('message info for a 1:1 DM nobody has read yet', () => {
    const info = mapMessageInfo({ message: { sender: 'me' }, members: [{ _id: 'me' }, { _id: 'u1', username: 'ana' }], readByUsers: [], readBy: [] });
    expect(info.read).toEqual([]);
    expect(info.unread).toEqual([{ id: 'u1', username: 'ana', avatarUrl: null, readAt: null }]);
    expect(info.recipients).toBe(1);
  });
});
