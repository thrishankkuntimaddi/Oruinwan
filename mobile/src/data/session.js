// Session: who is signed in, to which server (or the demo), and which workspace is open.
import { create } from 'zustand';
import { prefs, wipeDevice } from '../native/storage.js';
import { demoAdapter } from './demo/adapter.js';
import { clearQueries, invalidate } from './query.js';
import { emit, on } from '../lib/bus.js';
import { logEvent } from '../config/remote.js';

let adapter = demoAdapter;
let liveModule = null;

async function loadLive() {
  liveModule ||= import('./live/adapter.js');
  return (await liveModule).liveAdapter;
}

/** The active data source. Screens call api().channels(ws) etc. */
export const api = () => adapter;

const saved = prefs.get('session') || {};

export const useSession = create((set, get) => ({
  status: 'booting', // booting | signed-out | signed-in
  mode: saved.mode || null, // demo | live
  server: saved.server || '',
  user: null,
  workspaces: prefs.get('workspaces.cache') || [],
  workspaceId: saved.workspaceId || null,
  offline: false,

  persist() {
    const { mode, server, workspaceId } = get();
    prefs.set('session', { mode, server, workspaceId });
  },

  async boot() {
    const { mode } = get();
    if (!mode) return set({ status: 'signed-out' });
    try {
      adapter = mode === 'demo' ? demoAdapter : await loadLive();
      const { user, offline } = await adapter.restore({ server: get().server });
      set({ user, offline: Boolean(offline), status: 'signed-in' });
      await get().loadWorkspaces();
    } catch (err) {
      console.warn('[session] restore failed', err?.message);
      adapter = demoAdapter;
      set({ status: 'signed-out', mode: null, user: null });
      get().persist();
    }
  },

  async startDemo() {
    adapter = demoAdapter;
    const { user } = await adapter.restore();
    set({ mode: 'demo', server: '', user, status: 'signed-in', workspaceId: null });
    await get().loadWorkspaces();
    get().persist();
    logEvent('demo_started');
  },

  /** Throws { code: '2FA_REQUIRED' } when a one-time code is needed. */
  async signIn({ server, email, password, otp }) {
    const live = await loadLive();
    const { user } = await live.signIn({ server, email, password, otp });
    adapter = live;
    clearQueries();
    set({ mode: 'live', server: live.serverUrl(), user, status: 'signed-in', workspaceId: null, offline: false });
    await get().loadWorkspaces();
    get().persist();
    logEvent('login', { method: 'password' });
  },

  async loadWorkspaces() {
    try {
      const workspaces = await adapter.workspaces();
      const current = workspaces.find((w) => w.id === get().workspaceId) || workspaces.find((w) => !w.isPersonal) || workspaces[0];
      set({ workspaces, workspaceId: current?.id || null });
      prefs.set('workspaces.cache', workspaces);
      get().persist();
      adapter.onWorkspace?.(current?.id);
    } catch (err) {
      if (!get().workspaces.length) throw err;
    }
  },

  switchWorkspace(id) {
    if (id === get().workspaceId) return;
    set({ workspaceId: id });
    get().persist();
    adapter.onWorkspace?.(id);
    emit('workspace:changed', id);
  },

  setUser(patch) {
    set({ user: { ...get().user, ...patch } });
  },

  async signOut({ wipe = false } = {}) {
    try {
      await adapter.signOut();
    } catch {
      /* server unreachable: still sign out locally */
    }
    adapter = demoAdapter;
    clearQueries();
    prefs.set('workspaces.cache', null);
    if (wipe) await wipeDevice();
    set({ status: 'signed-out', mode: null, user: null, workspaces: [], workspaceId: null });
    get().persist();
    emit('session:ended');
  },
}));

export const useWorkspace = () => {
  const workspaces = useSession((s) => s.workspaces);
  const id = useSession((s) => s.workspaceId);
  return workspaces.find((w) => w.id === id) || null;
};

// Unread totals on the workspace switcher; coalesce bursts of realtime events.
let reloadTimer = null;
function reloadWorkspacesSoon() {
  if (reloadTimer) return;
  reloadTimer = setTimeout(() => {
    reloadTimer = null;
    if (useSession.getState().status === 'signed-in') useSession.getState().loadWorkspaces();
  }, 1500);
}

// Data changes from an adapter (demo writes, socket events) refresh the matching queries.
on('data:changed', (keys) => {
  if (keys.includes('*')) invalidate('');
  else invalidate(...keys);
  if (keys.some((k) => k === 'channels' || k === 'dms' || k === 'workspaces')) reloadWorkspacesSoon();
});

on('auth:expired', () => {
  useSession.getState().signOut();
  emit('toast', { message: 'Your session ended. Please sign in again.', tone: 'warning', id: 'auth' });
});
