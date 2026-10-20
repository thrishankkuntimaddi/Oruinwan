// The live adapter's mapping for invitations, attachments, Knowledge pages, Files and the
// workspace switcher's unread counts, against the server's real response shapes.
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockApi = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
vi.mock('./http.js', () => ({
  api: mockApi,
  absolute: (u) => u,
  accessToken: () => 'tok',
  configure: vi.fn(),
  currentRefreshToken: () => null,
  endSession: vi.fn(),
  loadTokens: vi.fn(),
  refreshSession: vi.fn(),
  saveTokens: vi.fn(),
  serverUrl: () => 'https://api.example',
  settleRefresh: vi.fn(),
  request: vi.fn(),
  NETWORK_MESSAGE: 'offline',
  ApiError: class ApiError extends Error {},
}));
const mockEncrypt = vi.fn(async (key, text) => ({ ciphertext: `enc(${text})`, messageIv: 'iv', isEncrypted: true }));
vi.mock('./crypto.js', () => ({
  conversationKey: vi.fn(async () => 'key'),
  encryptText: (...a) => mockEncrypt(...a),
  forgetIdentity: vi.fn(),
  prefetchWorkspaceKeys: vi.fn(),
  protectIdentityWithPassword: vi.fn(),
  readMessage: vi.fn(async (conv, m) => (m.payload?.ciphertext ? { state: 'ok', text: 'decrypted' } : { state: 'attachment', text: m.attachments?.[0]?.name || '' })),
  restoreIdentity: vi.fn(),
  unlockIdentity: vi.fn(),
  decryptPayload: vi.fn(),
}));
// Only the connection is stubbed: other screens (huddles) add their own exports here.
vi.mock('./realtime.js', async (importOriginal) => ({
  ...(await importOriginal()),
  connectRealtime: vi.fn(),
  disconnectRealtime: vi.fn(),
  joinWorkspace: vi.fn(),
  resumeRealtime: vi.fn(),
  socketEmit: vi.fn(),
}));
vi.mock('../../native/index.js', async (importOriginal) => ({ ...(await importOriginal()), clientPlatform: 'android' }));

const { liveAdapter } = await import('./adapter.js');

const ATTACHMENT = { type: 'file', url: '/api/v2/uploads/file?path=channels%2Fb.pdf', name: 'brief.pdf', size: 393, mimeType: 'application/pdf', gcsPath: 'channels/b.pdf' };

beforeEach(() => vi.clearAllMocks());

describe('invitations', () => {
  it('describes an invitation', async () => {
    mockApi.get.mockResolvedValue({ workspaceName: 'Acme Studio', workspaceDescription: '', workspaceIcon: 'rocket', workspaceColor: '#b8956a', invitedBy: 'wizard-test', memberCount: 2, role: 'member' });
    expect(await liveAdapter.inviteDetails('tok/en')).toEqual({ name: 'Acme Studio', description: '', icon: 'rocket', color: '#b8956a', invitedBy: 'wizard-test', memberCount: 2, role: 'member' });
    expect(mockApi.get).toHaveBeenCalledWith('/workspaces/invite/tok%2Fen');
  });

  it('joins, and tells "already a member" apart', async () => {
    mockApi.post.mockResolvedValueOnce({ message: 'Successfully joined workspace', workspace: { id: 'w1', name: 'Acme Studio' } });
    expect(await liveAdapter.joinWithInvite('t')).toEqual({ id: 'w1', name: 'Acme Studio' });
    expect(mockApi.post).toHaveBeenCalledWith('/workspaces/join', { token: 't' });

    mockApi.post.mockRejectedValueOnce(Object.assign(new Error('You are already a member of this workspace'), { status: 400 }));
    await expect(liveAdapter.joinWithInvite('t')).rejects.toMatchObject({ code: 'ALREADY_MEMBER' });
  });
});

describe('workspaces', () => {
  it('shows the unread count the server sends', async () => {
    mockApi.get.mockResolvedValue({ workspaces: [{ id: 'w1', name: 'Acme', role: 'owner', memberCount: 2, unreadCount: 16 }, { id: 'w2', name: 'B' }] });
    const list = await liveAdapter.workspaces();
    expect(list.map((w) => w.unread)).toEqual([16, 0]);
  });
});

describe('attachments', () => {
  it('sends a channel file like the web client and keeps the attachment on the message', async () => {
    mockApi.post.mockResolvedValue({ message: { _id: 'm1', type: 'file', attachments: [ATTACHMENT], sender: 'u1', createdAt: '2026-10-20T10:00:00Z' } });
    const m = await liveAdapter.sendAttachment({ kind: 'channel', id: 'ch1' }, { ...ATTACHMENT }, { clientTempId: 'tmp1' });
    expect(mockApi.post).toHaveBeenCalledWith('/v2/messages/channel', {
      type: 'file',
      channelId: 'ch1',
      clientTempId: 'tmp1',
      attachments: [{ type: 'file', url: ATTACHMENT.url, name: 'brief.pdf', size: 393, mimeType: 'application/pdf' }],
    });
    expect(m).toMatchObject({ id: 'm1', state: 'attachment', attachments: [{ name: 'brief.pdf', gcsPath: 'channels/b.pdf', mimeType: 'application/pdf' }] });
  });

  it('sends a thread file with its name as the encrypted caption', async () => {
    mockApi.post.mockResolvedValue({ reply: { _id: 'r1', parentId: 'p1', payload: { ciphertext: 'enc', messageIv: 'iv', attachments: [ATTACHMENT] } } });
    const m = await liveAdapter.sendAttachment({ kind: 'channel', id: 'ch1' }, { ...ATTACHMENT }, { parentId: 'p1' });
    expect(mockEncrypt).toHaveBeenCalledWith('key', 'brief.pdf');
    expect(mockApi.post.mock.calls[0][0]).toBe('/v2/messages/thread/p1');
    expect(mockApi.post.mock.calls[0][1]).toMatchObject({ ciphertext: 'enc(brief.pdf)', messageIv: 'iv', attachments: [{ url: ATTACHMENT.url }] });
    // Thread replies keep files in the payload.
    expect(m.attachments).toHaveLength(1);
  });

  it('opens library files through the same signed links', async () => {
    mockApi.get.mockResolvedValue({ files: [{ _id: 'f1', name: 'budget.csv', mimeType: 'text/csv', size: 19, url: '/api/v2/uploads/file?path=ws%2Fb.csv', gcsPath: 'ws/b.csv', createdBy: { _id: 'u1' } }] });
    const [f] = await liveAdapter.files('w1');
    expect(f).toMatchObject({ id: 'f1', name: 'budget.csv', kind: 'sheet', mimeType: 'text/csv', url: '/api/v2/uploads/file?path=ws%2Fb.csv', gcsPath: 'ws/b.csv', owner: 'u1' });
  });
});

describe('knowledge pages', () => {
  it('lists every page with its parent and a plain excerpt', async () => {
    mockApi.get.mockResolvedValue({
      pages: [
        { _id: 'k1', title: 'Handbook', icon: '📘', content: '# Handbook\n\nHow **we** work.', parentId: null },
        { _id: 'k2', title: 'Release', parentId: 'k1', summary: 'Tags and rollout' },
      ],
    });
    const list = await liveAdapter.knowledge('w1');
    expect(mockApi.get).toHaveBeenCalledWith('/v2/knowledge/pages', { workspaceId: 'w1' });
    expect(list).toEqual([
      expect.objectContaining({ id: 'k1', parentId: null, icon: '📘', excerpt: 'How we work.' }),
      expect.objectContaining({ id: 'k2', parentId: 'k1', icon: '📄', excerpt: 'Tags and rollout' }),
    ]);
    expect(list[0].content).toBeUndefined();
  });

  it('creates, edits and deletes pages', async () => {
    mockApi.post.mockResolvedValue({ page: { _id: 'k3', title: 'Untitled page', content: '', icon: '👋', parentId: 'k1' } });
    const p = await liveAdapter.createPage('w1', { title: '  ', content: '', icon: '👋', parentId: 'k1' });
    expect(mockApi.post).toHaveBeenCalledWith('/v2/knowledge/pages', { workspaceId: 'w1', title: 'Untitled page', content: '', icon: '👋', parentId: 'k1' });
    expect(p).toMatchObject({ id: 'k3', parentId: 'k1', content: '' });

    mockApi.put.mockResolvedValue({ page: { _id: 'k3', title: 'Guide', content: '# Guide', icon: '👋' } });
    const u = await liveAdapter.updatePage('k3', { title: 'Guide', content: '# Guide', ignored: true });
    expect(mockApi.put).toHaveBeenCalledWith('/v2/knowledge/pages/k3', { title: 'Guide', content: '# Guide' });
    expect(u).toMatchObject({ title: 'Guide', content: '# Guide' });

    await liveAdapter.deletePage('k3');
    expect(mockApi.del).toHaveBeenCalledWith('/v2/knowledge/pages/k3');
  });
});
