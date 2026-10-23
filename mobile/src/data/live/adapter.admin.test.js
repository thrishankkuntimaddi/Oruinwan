// Workspace admin calls of the live adapter: the same endpoints as the web's Workspace admin.
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
vi.mock('./crypto.js', () => ({ conversationKey: vi.fn(), encryptText: vi.fn(), decryptPayload: vi.fn() }));
vi.mock('./realtime.js', () => ({ socketRequest: vi.fn(), socketEmit: vi.fn() }));

const { workAdapter: a } = await import('./adapter.work.js');

beforeEach(() => vi.clearAllMocks());

describe('workspace admin', () => {
  it('reads and saves the enforced member permissions as workspace settings', async () => {
    mockApi.get.mockResolvedValue({ workspaces: [{ id: 'w1', settings: { allowMemberInvite: false } }, { id: 'w2', settings: {} }] });
    expect(await a.workspacePermissions('w1')).toEqual({ invite: 'admin', channelCreation: 'member' });
    expect(await a.workspacePermissions('w2')).toEqual({ invite: 'member', channelCreation: 'member' });
    await a.saveWorkspacePermissions('w1', { invite: 'member' });
    expect(mockApi.put).toHaveBeenCalledWith('/workspaces/w1', { settings: { allowMemberInvite: true } });
    await a.saveWorkspacePermissions('w1', { channelCreation: 'admin' });
    expect(mockApi.put).toHaveBeenLastCalledWith('/workspaces/w1', { settings: { allowMemberChannelCreation: false } });
  });

  it('renames separately and saves only changed fields', async () => {
    await a.updateWorkspaceInfo('w1', { name: 'New', rules: 'Be kind' }, { name: 'Old', rules: '' });
    expect(mockApi.put).toHaveBeenCalledWith('/workspaces/w1/rename', { name: 'New' });
    expect(mockApi.put).toHaveBeenCalledWith('/workspaces/w1', { rules: 'Be kind' });
    mockApi.put.mockClear();
    await a.updateWorkspaceInfo('w1', { name: 'Old' }, { name: 'Old' });
    expect(mockApi.put).not.toHaveBeenCalled();
  });

  it('manages members and the workspace lifecycle', async () => {
    await a.changeMemberRole('w1', 'u1', 'admin');
    expect(mockApi.post).toHaveBeenCalledWith('/workspaces/w1/members/u1/change-role', { newRole: 'admin' });
    await a.suspendMember('w1', 'u1');
    expect(mockApi.post).toHaveBeenCalledWith('/workspaces/w1/members/u1/suspend');
    await a.removeMember('w1', 'u1');
    expect(mockApi.post).toHaveBeenCalledWith('/workspaces/w1/remove-member', { userId: 'u1' });
    await a.transferOwnership('w1', 'u2');
    expect(mockApi.post).toHaveBeenCalledWith('/workspaces/w1/transfer-ownership', { userId: 'u2' });
    await a.archiveWorkspace('w1');
    expect(mockApi.post).toHaveBeenCalledWith('/workspaces/w1/archive');
    await a.deleteWorkspace('w1');
    expect(mockApi.del).toHaveBeenCalledWith('/workspaces/w1');
    await a.setDefaultChannel('w1', 'c1', true);
    expect(mockApi.put).toHaveBeenCalledWith('/workspaces/w1/channels/c1/default', { isDefault: true });
  });

  it('lists members with their membership status', async () => {
    mockApi.get.mockResolvedValue({ members: [{ _id: 'u1', username: 'ann', role: 'admin', membershipStatus: 'suspended', isCurrentUser: false }] });
    const [m] = await a.memberDirectory('w1');
    expect(m).toMatchObject({ id: 'u1', role: 'admin', status: 'suspended', isMe: false });
  });
});
