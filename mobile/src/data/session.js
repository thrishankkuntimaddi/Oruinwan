// Session: who is signed in, to which server, and which workspace is open.
import { create } from 'zustand';
import { prefs, wipeDevice } from '../native/storage.js';
import { clearQueries, invalidate } from './query.js';
import { emit, on, toast } from '../lib/bus.js';
import { logEvent } from '../config/remote.js';
import { disablePush, enablePush, lastPushToken, pushAvailable, pushPlatform } from '../native/push.js';
import { closeBrowser, onAppState, openExternal } from '../native/index.js';
import { cacheScope, clearCache, flushCache, startCache } from './persist.js';
import { startOutbox, stopOutbox, clearOutbox } from './outbox.js';
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
  // A company SSO sign-in is being finished (after the browser came back to the app).
  ssoBusy: false,
  // A sign-in the server paused for two-step verification or the device limit
  // ({ code: 'MFA_REQUIRED' | 'DEVICE_LIMIT', pendingToken, …, ctx }). In memory only.
  challenge: null,

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
      // Last session's data first, so the app opens with it even offline (data/persist.js).
      await startCache(cacheScope(get().server, prefs.get('live.user')?.id)).catch(() => {});
      const { user, offline } = await adapter.restore({ server: get().server });
      set({ user, offline: Boolean(offline), status: 'signed-in' });
      startOutbox(user.id);
      await get().loadWorkspaces();
      // Push tokens can change (reinstall, OS update); re-register quietly if allowed.
      if (!offline) get().syncPush();
    } catch (err) {
      console.warn('[session] restore failed', err?.message);
      adapter = signedOutAdapter;
      clearCache().catch(() => {});
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

  /**
   * Throws { code: '2FA_REQUIRED' } on servers that still want the code inline. When the server
   * pauses the sign-in (two-step verification, device limit) the challenge screen takes over.
   */
  async signIn({ server, email, password, otp }) {
    const live = await loadLive();
    let user;
    try {
      ({ user } = await live.signIn({ server, email, password, otp }));
    } catch (err) {
      if (get().takeChallenge(err)) return;
      throw err;
    }
    adapter = live;
    clearQueries();
    startCache(cacheScope(live.serverUrl(), user.id)).catch(() => {});
    startOutbox(user.id);
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
    let result;
    try {
      result = await live.googleSignIn(params);
    } catch (err) {
      if (get().takeChallenge(err)) return { challenge: true };
      throw err;
    }
    if (result.needsSignup) return result;
    await get().finishLiveSignIn(live, result, kind);
    return {};
  },

  /**
   * Company SSO, step one: finds the company's sign-in for this email and opens it in the in-app
   * browser. Resolves false when the email's company has no SSO. The browser comes back through
   * oruinwan://sso (finishSso).
   */
  async startSso({ server, email }) {
    const live = await loadLive();
    const found = await live.ssoDiscover({ server, email });
    if (!found.enabled) return false;
    const sso = await import('./live/sso.js');
    const { verifier, challenge } = sso.makePkce();
    sso.savePending({ server: live.serverUrl(), verifier });
    const { deviceId } = await import('./live/http.js');
    await openExternal(sso.appStartUrl(found.startUrl, { challenge, deviceId: deviceId() }));
    logEvent('sso_start', { protocol: found.protocol || 'unknown' });
    return true;
  },

  /** Step two: the link oruinwan://sso?code=… (or ?error=…). Returns false for other links. */
  finishSso(link) {
    // Cheap check first, so other links (invitations) never load the SSO code.
    if (!/^oruinwan(-[a-z]+)?:\/\/sso\b/i.test(String(link || ''))) return false;
    (async () => {
      const sso = await import('./live/sso.js');
      const parsed = sso.parseSsoReturn(link);
      closeBrowser();
      const pending = sso.takePending();
      if (!parsed) return;
      if (parsed.error || !pending) {
        set({ ssoBusy: false });
        toast(pending ? sso.ssoErrorMessage(parsed.error) : 'That sign-in link has expired. Start again.', 'danger');
        return;
      }
      if (get().status === 'signed-in') return;
      set({ ssoBusy: true });
      try {
        const live = await loadLive();
        const result = await live.ssoSignIn({ server: pending.server, code: parsed.code, verifier: pending.verifier });
        await get().finishLiveSignIn(live, result, 'sso');
      } catch (err) {
        if (get().takeChallenge(err)) return;
        toast(err.message || "Single sign-on didn't finish. Try again.", 'danger');
      } finally {
        set({ ssoBusy: false });
      }
    })();
    return true;
  },

  /** Creates the account a Google sign-in asked for (username and date of birth), then signs in. */
  async googleSignUp(params) {
    const live = await loadLive();
    const result = await live.googleSignUp(params);
    await get().finishLiveSignIn(live, result, 'google');
    logEvent('sign_up', { method: 'google' });
  },

  /** Shows the challenge screen for a paused sign-in. Returns false when `err` is something else. */
  takeChallenge(err) {
    if (err?.code !== 'SIGNIN_CHALLENGE' || !err.challenge) return false;
    set({ challenge: err.challenge });
    return true;
  },

  cancelChallenge() {
    set({ challenge: null });
  },

  /**
   * Finishes a paused sign-in (body: { otp } | { emailCode } | { signOutDeviceIds } |
   * { signOutAll } | {} after approval). A next step (device limit after the code) replaces the
   * challenge; errors are thrown for the screen to show.
   */
  async continueChallenge(body) {
    const challenge = get().challenge;
    if (!challenge) return;
    const live = await loadLive();
    try {
      const result = await live.signinContinue(challenge, body);
      set({ challenge: null });
      await get().finishLiveSignIn(live, result, challenge.ctx?.kind || 'password');
    } catch (err) {
      if (err?.code === 'SIGNIN_CHALLENGE') {
        set({ challenge: err.challenge });
        return;
      }
      throw err;
    }
  },

  async challengeStatus() {
    const challenge = get().challenge;
    if (!challenge) return null;
    return (await loadLive()).signinStatus(challenge.pendingToken);
  },

  async challengeEmailCode() {
    const challenge = get().challenge;
    if (!challenge) return null;
    return (await loadLive()).signinEmailCode(challenge.pendingToken);
  },

  /** QR sign-in from the start screen: claims the code shown on a signed-in computer. */
  async qrClaim({ server, code }) {
    return (await loadLive()).qrClaim({ server, code });
  },

  /** → { status } while waiting; signs in (or shows the device-limit screen) once allowed. */
  async qrPoll({ code, secret }) {
    const live = await loadLive();
    try {
      const result = await live.qrPoll({ code, secret });
      if (!result.done) return result;
      await get().finishLiveSignIn(live, result, 'qr');
      return { status: 'done' };
    } catch (err) {
      if (get().takeChallenge(err)) return { status: 'challenge' };
      throw err;
    }
  },

  async qrForget(code) {
    (await loadLive()).forgetQrClaim(code);
  },

  async finishLiveSignIn(live, { user, requiresPasswordSetup }, kind) {
    adapter = live;
    clearQueries();
    startCache(cacheScope(live.serverUrl(), user.id)).catch(() => {});
    startOutbox(user.id);
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
      const token = await enablePush({ ask, webKey: status.webKey });
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
    stopOutbox();
    clearOutbox();
    await clearCache().catch(() => {});
    clearQueries();
    prefs.set('workspaces.cache', null);
    if (wipe) await wipeDevice();
    set({ status: 'signed-out', mode: null, user: null, workspaces: [], workspaceId: null, needsPassword: false, pickingWorkspace: false, creatingWorkspace: false, challenge: null });
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

// Save the cache when the app goes to the background (it may be closed there).
onAppState((active) => {
  if (!active) flushCache();
}).catch(() => {});
