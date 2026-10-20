// Session: who is signed in, to which server, and which workspace is open.
import { create } from 'zustand';
import { prefs, wipeDevice } from '../native/storage.js';
import { clearQueries, invalidate } from './query.js';
import { emit, on } from '../lib/bus.js';
import { logEvent } from '../config/remote.js';
import { disablePush, enablePush, lastPushToken, pushAvailable, pushPlatform } from '../native/push.js';
import { openExternal } from '../native/index.js';
import { parseInvite } from '../lib/invite.js';

let liveModule = null;

async function loadLive() {
  liveModule ||= import('./live/adapter.js');
  return (await liveModule).liveAdapter;
}

/**
 * Stands in for the server while nobody is signed in: every call fails with NOT_SIGNED_IN
 * instead of crashing, and the optional hooks (onResume, onWorkspace, huddles) are no-ops.
 */
const signedOutAdapter = new Proxy(
  { kind: 'signed-out', huddles: null, onResume() {}, onWorkspace() {} },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === 'symbol' || prop === 'then') return undefined;
      return () => Promise.reject(Object.assign(new Error('Not signed in'), { code: 'NOT_SIGNED_IN' }));
    },
  },
);

let adapter = signedOutAdapter;

/** The active data source. Screens call api().channels(ws) etc. */
export const api = () => adapter;

const saved = prefs.get('session') || {};
// Only a server sign-in is restored; anything else saved here (such as the old on-device demo)
// starts signed out.
if (saved.mode !== 'live') saved.mode = null;
prefs.set('demo.state.v1', null); // the old demo's sample data, no longer used

export const useSession = create((set, get) => ({
  status: 'booting', // booting | signed-out | signed-in
  mode: saved.mode, // 'live' while signed in, null when signed out
  server: saved.server || '',
  user: null,
  workspaces: prefs.get('workspaces.cache') || [],
  workspaceId: saved.workspaceId || null,
  offline: false,
  // A first Google sign-in still has to choose how its keys are protected (set a
  // password, or let the server hold them). Saved, so a reload asks again instead of skipping.
  needsPassword: Boolean(saved.needsPassword),
  // Right after a live sign-in: show "Welcome back" and the workspace list before opening one.
  // Not saved, so reopening the app goes straight to the last workspace.
  pickingWorkspace: false,
  // The create-workspace screens are open (over everything else).
  creatingWorkspace: false,
  // An invitation link to join a workspace (opened, or pasted). Saved, so it survives signing in
  // or creating an account first; the join screen shows once someone is signed in.
  joinToken: prefs.get('invite.pending') || null,

  persist() {
    const { mode, server, workspaceId, needsPassword } = get();
    prefs.set('session', { mode, server, workspaceId, needsPassword });
  },

  async boot() {
    const { mode } = get();
    if (mode !== 'live') {
      set({ status: 'signed-out', mode: null, workspaces: [], workspaceId: null });
      prefs.set('workspaces.cache', null);
      return get().persist();
    }
    try {
      adapter = await loadLive();
      const { user, offline } = await adapter.restore({ server: get().server });
      set({ user, offline: Boolean(offline), status: 'signed-in' });
      await get().loadWorkspaces();
      // Push tokens can change (reinstall, OS update); re-register quietly if allowed.
      if (!offline) get().syncPush();
    } catch (err) {
      console.warn('[session] restore failed', err?.message);
      adapter = signedOutAdapter;
      set({ status: 'signed-out', mode: null, user: null });
      get().persist();
    }
  },

  /** Creates an account on a server. Nothing is signed in until the email is verified. */
  async signUp({ server, username, email, dob, password }) {
    const live = await loadLive();
    await live.signUp({ server, username, email, dob, password });
    logEvent('sign_up', { method: 'password' });
  },

  async resendVerification({ server, email }) {
    const live = await loadLive();
    await live.resendVerification({ server, email });
  },

  /** Throws { code: '2FA_REQUIRED' } when a one-time code is needed. */
  async signIn({ server, email, password, otp }) {
    const live = await loadLive();
    const { user } = await live.signIn({ server, email, password, otp });
    adapter = live;
    clearQueries();
    set({ mode: 'live', server: live.serverUrl(), user, status: 'signed-in', workspaceId: null, offline: false, pickingWorkspace: true });
    await get().loadWorkspaces();
    get().persist();
    get().syncPush();
    logEvent('login', { method: 'password' });
  },

  /**
   * Google sign-in (`{ server, accessToken }`). Throws { code: '2FA_REQUIRED' } when a one-time
   * code is needed; call again with `otp`. Returns { needsSignup, ticket } when the Google email
   * has no account yet; then finish with googleSignUp.
   */
  async signInWithProvider(kind, params) {
    const live = await loadLive();
    const result = await live.googleSignIn(params);
    if (result.needsSignup) return result;
    await get().finishLiveSignIn(live, result, kind);
    return {};
  },

  /** Creates the account a Google sign-in asked for (username and date of birth), then signs in. */
  async googleSignUp(params) {
    const live = await loadLive();
    const result = await live.googleSignUp(params);
    await get().finishLiveSignIn(live, result, 'google');
    logEvent('sign_up', { method: 'google' });
  },

  async finishLiveSignIn(live, { user, requiresPasswordSetup }, kind) {
    adapter = live;
    clearQueries();
    set({ mode: 'live', server: live.serverUrl(), user, status: 'signed-in', workspaceId: null, offline: false, needsPassword: requiresPasswordSetup, pickingWorkspace: true });
    get().persist();
    await get().loadWorkspaces().catch(() => {});
    get().syncPush();
    logEvent('login', { method: kind });
  },

  async protectWithPassword(password) {
    await adapter.protectWithPassword(get().user.id, password);
    set({ needsPassword: false });
    get().persist();
  },

  async skipPassword() {
    await adapter.skipPassword(get().user.id);
    set({ needsPassword: false });
    get().persist();
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

  openCreateWorkspace() {
    set({ creatingWorkspace: true });
  },

  closeCreateWorkspace() {
    set({ creatingWorkspace: false });
  },

  /** The new workspace exists: show it in the list and open it. */
  async finishCreateWorkspace(ws) {
    set({ creatingWorkspace: false, pickingWorkspace: false });
    await get().loadWorkspaces().catch(() => {});
    if (ws?.id) get().switchWorkspace(ws.id);
  },

  /**
   * An invitation link was opened or pasted. Returns false when it isn't one. Company invitations
   * (which create a company account) open in the browser.
   */
  openInvite(input) {
    const invite = parseInvite(input);
    if (!invite) return false;
    if (invite.kind === 'company') {
      openExternal(invite.url);
      return true;
    }
    prefs.set('invite.pending', invite.token);
    set({ joinToken: invite.token, creatingWorkspace: false });
    if (get().status === 'signed-out') emit('toast', { message: 'Sign in or create an account to accept the invitation.', id: 'invite' });
    return true;
  },

  closeInvite() {
    prefs.set('invite.pending', null);
    set({ joinToken: null });
  },

  /** Joined (or already a member): show it in the list and open it. */
  async finishInvite(ws) {
    prefs.set('invite.pending', null);
    set({ joinToken: null, pickingWorkspace: false });
    await get().loadWorkspaces().catch(() => {});
    if (ws?.id) get().switchWorkspace(ws.id);
  },

  /** From the post-sign-in picker: open this workspace. */
  chooseWorkspace(id) {
    set({ pickingWorkspace: false });
    if (id && id !== get().workspaceId) get().switchWorkspace(id);
  },

  switchWorkspace(id) {
    if (id === get().workspaceId) return;
    set({ workspaceId: id });
    get().persist();
    adapter.onWorkspace?.(id);
    emit('workspace:changed', id);
  },

  /**
   * Push notifications for this device. With `ask`, shows the system prompt if needed.
   * Returns 'on', 'off' (not allowed) or 'unavailable' (no push in this build or on this server).
   */
  async syncPush({ ask = false } = {}) {
    if (get().mode !== 'live' || !pushAvailable) return 'unavailable';
    try {
      const status = await adapter.pushStatus();
      if (!status?.[pushPlatform]) return 'unavailable';
      const token = await enablePush({ ask });
      if (!token) return 'off';
      await adapter.registerPushToken(token, pushPlatform);
      return 'on';
    } catch {
      return 'unavailable';
    }
  },

  setUser(patch) {
    set({ user: { ...get().user, ...patch } });
  },

  async signOut({ wipe = false } = {}) {
    // This phone shouldn't get the account's notifications once signed out.
    const pushToken = get().mode === 'live' ? lastPushToken() : null;
    if (pushToken) {
      await adapter.unregisterPushToken(pushToken).catch(() => {});
      await disablePush();
    }
    try {
      await adapter.signOut();
    } catch {
      /* server unreachable: still sign out locally */
    }
    adapter = signedOutAdapter;
    clearQueries();
    prefs.set('workspaces.cache', null);
    if (wipe) await wipeDevice();
    set({ status: 'signed-out', mode: null, user: null, workspaces: [], workspaceId: null, needsPassword: false, pickingWorkspace: false, creatingWorkspace: false });
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

// Data changes from the adapter (socket events, local writes) refresh the matching queries.
on('data:changed', (keys) => {
  if (keys.includes('*')) invalidate('');
  else invalidate(...keys);
  if (keys.some((k) => k === 'channels' || k === 'dms' || k === 'workspaces')) reloadWorkspacesSoon();
});

on('auth:expired', () => {
  useSession.getState().signOut();
  emit('toast', { message: 'Your session ended. Please sign in again.', tone: 'warning', id: 'auth' });
});
