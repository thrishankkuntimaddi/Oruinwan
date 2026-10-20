import { beforeEach, describe, expect, it, vi } from 'vitest';

// The live adapter, recorded instead of talking to a server.
const live = {
  kind: 'live',
  restore: vi.fn(async () => ({ user: { id: 'u1', name: 'Ada' } })),
  workspaces: vi.fn(async () => [{ id: 'w1', name: 'Acme' }]),
  onWorkspace: vi.fn(),
  pushStatus: vi.fn(async () => null),
  signOut: vi.fn(async () => {}),
};
vi.mock('./live/adapter.js', () => ({ liveAdapter: live }));
vi.mock('../native/push.js', () => ({
  disablePush: vi.fn(),
  enablePush: vi.fn(),
  lastPushToken: () => null,
  pushAvailable: false,
  pushPlatform: 'android',
}));
vi.mock('../config/remote.js', () => ({ logEvent: vi.fn() }));

async function loadSession(saved) {
  vi.resetModules();
  localStorage.clear();
  if (saved) localStorage.setItem('oru.session', JSON.stringify(saved));
  localStorage.setItem('oru.workspaces.cache', JSON.stringify([{ id: 'demo-ws', name: 'Sample' }]));
  localStorage.setItem('oru.demo.state.v1', JSON.stringify({ any: 'thing' }));
  return import('./session.js');
}

describe('session', () => {
  beforeEach(() => vi.clearAllMocks());

  it('boots a saved demo session to signed out and drops its leftovers', async () => {
    const { useSession, api } = await loadSession({ mode: 'demo', workspaceId: 'demo-ws' });
    await useSession.getState().boot();
    const s = useSession.getState();
    expect(s.status).toBe('signed-out');
    expect(s.mode).toBe(null);
    expect(s.workspaces).toEqual([]);
    expect(live.restore).not.toHaveBeenCalled();
    expect(localStorage.getItem('oru.demo.state.v1')).toBe(null);
    expect(localStorage.getItem('oru.workspaces.cache')).toBe(null);
    expect(JSON.parse(localStorage.getItem('oru.session')).mode).toBe(null);
    expect(api().kind).toBe('signed-out');
  });

  it('while signed out, api() calls fail politely instead of crashing', async () => {
    const { api } = await loadSession(null);
    await expect(api().channels('w1')).rejects.toMatchObject({ code: 'NOT_SIGNED_IN' });
    expect(() => api().onResume?.()).not.toThrow();
    expect(() => api().onWorkspace?.('w1')).not.toThrow();
    expect(api().huddles).toBe(null);
  });

  it('restores a live session through the live adapter', async () => {
    const { useSession, api } = await loadSession({ mode: 'live', server: 'https://chat.example.org', workspaceId: 'w1' });
    await useSession.getState().boot();
    expect(live.restore).toHaveBeenCalledWith({ server: 'https://chat.example.org' });
    expect(useSession.getState()).toMatchObject({ status: 'signed-in', mode: 'live', workspaceId: 'w1' });
    expect(api()).toBe(live);

    await useSession.getState().signOut();
    expect(live.signOut).toHaveBeenCalled();
    expect(useSession.getState()).toMatchObject({ status: 'signed-out', mode: null });
    expect(api().kind).toBe('signed-out');
  });
});
