// Free-plan limits in the live adapter: GET /api/plan and /api/plan/ai mapped into the app's
// shape, and notes created from a template carrying templateId.
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockApi = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
vi.mock('./http.js', () => ({
  api: mockApi,
  absolute: (u) => u,
  accessToken: () => 'tok',
  configure: vi.fn(),
  currentRefreshToken: () => null,
  deviceId: () => 'dev',
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
vi.mock('./realtime.js', async (importOriginal) => ({
  ...(await importOriginal()),
  connectRealtime: vi.fn(),
  disconnectRealtime: vi.fn(),
  joinWorkspace: vi.fn(),
  resumeRealtime: vi.fn(),
  socketEmit: vi.fn(),
}));

const { liveAdapter } = await import('./adapter.js');

beforeEach(() => vi.clearAllMocks());

describe('free-plan limits', () => {
  it("reads the plan and today's AI count for a workspace", async () => {
    mockApi.get.mockResolvedValueOnce({
      plan: 'free',
      exempt: false,
      upgradeUrl: '/pricing',
      plans: [{ id: 'free', name: 'Free' }, { id: 'pro', name: 'Pro', comingSoon: true }],
      items: [{ key: 'channels.perWorkspace', label: 'Channels', used: 10, max: 10, atLimit: true, scope: 'workspace' }],
      notes: { perTemplate: 2, byTemplate: { meeting: 1 } },
      huddles: { participants: 10, minutes: 30 },
      ai: { userUsed: 12, userMax: 50, userRemaining: 38, workspaceUsed: 40, workspaceMax: 300, workspaceRemaining: 260, resetsAt: '2026-10-22T00:00:00.000Z' },
      blocked: { 'channels.perWorkspace': true },
    });
    const plan = await liveAdapter.getPlan('w1');
    expect(mockApi.get).toHaveBeenCalledWith('/plan', { workspaceId: 'w1' });
    expect(plan).toMatchObject({ plan: 'free', exempt: false, blocked: { 'channels.perWorkspace': true }, huddles: { participants: 10, minutes: 30 } });
    expect(plan.items[0]).toMatchObject({ used: 10, max: 10, atLimit: true, scope: 'workspace' });
    expect(plan.plans[1]).toEqual({ id: 'pro', name: 'Pro', comingSoon: true });
    expect(plan.notes).toEqual({ perTemplate: 2, byTemplate: { meeting: 1 } });
    expect(plan.ai).toMatchObject({ userRemaining: 38, userMax: 50 });

    mockApi.get.mockResolvedValueOnce({ userUsed: 49, userMax: 50, workspaceUsed: 1, workspaceMax: 300, resetsAt: null, exempt: false });
    expect(await liveAdapter.getAiQuota('w1')).toMatchObject({ userRemaining: 1, workspaceRemaining: 299 });
    expect(mockApi.get).toHaveBeenLastCalledWith('/plan/ai', { workspaceId: 'w1' });
  });

  it('treats a company plan as unblocked, and a server without plans as no plan', async () => {
    mockApi.get.mockResolvedValueOnce({ plan: 'company', exempt: true, blocked: { 'channels.perWorkspace': true } });
    const company = await liveAdapter.getPlan('w1');
    expect(company.exempt).toBe(true);
    expect(company.blocked).toEqual({});
    mockApi.get.mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }));
    expect(await liveAdapter.getPlan('w1')).toBeNull();
    mockApi.get.mockRejectedValueOnce(Object.assign(new Error('Server error'), { status: 500 }));
    await expect(liveAdapter.getAiQuota('w1')).rejects.toThrow('Server error');
  });

  it('sends the template a note was made from, and none for a blank note', async () => {
    mockApi.post.mockResolvedValue({ note: { _id: 'n1', title: 'Meeting notes' } });
    await liveAdapter.createNote('w1', { title: 'Meeting notes', type: 'meeting', content: '<p></p>', templateId: 'meeting' });
    expect(mockApi.post).toHaveBeenLastCalledWith('/v2/notes', expect.objectContaining({ workspaceId: 'w1', type: 'meeting', templateId: 'meeting' }));
    await liveAdapter.createNote('w1', { title: '', type: 'note', content: '' });
    expect(mockApi.post.mock.lastCall[1]).not.toHaveProperty('templateId');
    await liveAdapter.createNote('w1', { title: '', type: 'note', content: '', templateId: 'blank' });
    expect(mockApi.post.mock.lastCall[1]).not.toHaveProperty('templateId');
  });
});
