import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  getUser, saveUser, removeUser, cacheGet, cacheSet, cacheRemove, cacheClearAll,
} from '../services/storage';
import { loadTokens, getAccessTokenSync, getRefreshTokenSync, setTokens, clearTokens } from '../services/tokens';
import { getMe, logoutApi } from '../services/api/auth';
import {
  connectSocket, disconnectSocket, joinWorkspace, signalActive, signalIdle,
} from '../services/socket';
import {
  restoreIdentity, unlockIdentity, forgetIdentity, getE2EEStatus, onE2EEStatus,
  clearConversationKeys, prefetchWorkspaceKeys,
} from '../services/crypto';
import { registerForPush, unregisterPush } from '../services/push';
import { clearQueue, flush } from '../services/offlineQueue';
import { on, toast } from '../services/events';

const WORKSPACE_CACHE_KEY = 'active_workspace';

const AppContext = createContext(null);

export const normalizeUser = (u) => (u ? { ...u, _id: u._id ?? u.id, id: u.id ?? u._id } : null);
export const normalizeWorkspace = (ws) => (ws ? { ...ws, _id: ws._id ?? ws.id, id: ws.id ?? ws._id } : null);

export function AppProvider({ children }) {
  const [status, setStatus] = useState('loading'); // loading | signedOut | signedIn
  const [user, setUserState] = useState(null);
  const [workspace, setWorkspaceState] = useState(null);
  const [e2ee, setE2ee] = useState(getE2EEStatus());
  const signingOut = useRef(false);

  useEffect(() => onE2EEStatus((s, detail) => setE2ee({ status: s, detail })), []);

  // ── Boot ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadTokens();
      const hasSession = !!(getAccessTokenSync() || getRefreshTokenSync());
      const [u, ws] = await Promise.all([getUser(), cacheGet(WORKSPACE_CACHE_KEY)]);
      if (cancelled) return;
      if (!hasSession || !u) {
        setStatus('signedOut');
        return;
      }
      setUserState(normalizeUser(u));
      setWorkspaceState(normalizeWorkspace(ws));
      setStatus('signedIn');
    })();
    return () => { cancelled = true; };
  }, []);

  const setUser = useCallback(async (u) => {
    const n = normalizeUser(u);
    setUserState(n);
    if (n) await saveUser(n);
  }, []);

  const setWorkspace = useCallback(async (ws) => {
    const n = normalizeWorkspace(ws);
    setWorkspaceState(n);
    if (n) await cacheSet(WORKSPACE_CACHE_KEY, n);
    else await cacheRemove(WORKSPACE_CACHE_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await getMe();
      const fresh = data?.user || data;
      if (fresh?._id || fresh?.id) {
        setUserState((prev) => {
          const merged = normalizeUser({ ...(prev || {}), ...fresh });
          saveUser(merged).catch(() => {});
          return merged;
        });
      }
    } catch (_) {}
  }, []);

  /** Called by Login after a successful POST /auth/login. */
  const signIn = useCallback(async (data, password) => {
    await setTokens({ accessToken: data.accessToken || data.token, refreshToken: data.refreshToken });
    const u = normalizeUser(data.user);
    await saveUser(u);
    setUserState(u);
    setStatus('signedIn');
    if (password && u?._id) {
      unlockIdentity(u._id, password).catch((err) => {
        if (err?.code === 'NO_IDENTITY') return;
        console.warn('[E2EE] unlock after login:', err?.message);
      });
    }
  }, []);

  const signOut = useCallback(async ({ remote = true, reason } = {}) => {
    if (signingOut.current) return;
    signingOut.current = true;
    const uid = user?._id;
    try {
      if (remote) {
        await unregisterPush();
        await logoutApi().catch(() => {});
      }
      disconnectSocket();
      clearConversationKeys();
      await forgetIdentity(uid);
      await clearQueue();
      await cacheClearAll();
      await clearTokens();
      await removeUser();
    } finally {
      setUserState(null);
      setWorkspaceState(null);
      setStatus('signedOut');
      signingOut.current = false;
      if (reason) toast(reason, 'error');
    }
  }, [user?._id]);

  // Refresh token rejected → local sign-out.
  useEffect(() => on('auth:expired', () => {
    signOut({ remote: false, reason: 'Your session expired. Please sign in again.' });
  }), [signOut]);

  // ── Signed-in side effects ────────────────────────────────────────────
  const uid = user?._id;
  useEffect(() => {
    if (status !== 'signedIn' || !uid) return undefined;
    connectSocket().then(() => signalActive()).catch(() => {});
    registerForPush();
    restoreIdentity(uid);
    refreshUser();
    flush();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        connectSocket().then(() => signalActive()).catch(() => {});
        flush();
      } else if (next === 'background') {
        signalIdle();
      }
    });
    return () => sub.remove();
  }, [status, uid, refreshUser]);

  const wsId = workspace?._id;
  useEffect(() => {
    if (status !== 'signedIn' || !wsId) return undefined;
    let leave = () => {};
    let cancelled = false;
    connectSocket().then(() => { if (!cancelled) leave = joinWorkspace(wsId); }).catch(() => {});
    if (e2ee.status === 'ready') prefetchWorkspaceKeys(wsId);
    return () => { cancelled = true; leave(); };
  }, [status, wsId, e2ee.status]);

  const value = useMemo(() => ({
    status, user, workspace, e2ee,
    setUser, setWorkspace, refreshUser, signIn, signOut,
    // Back-compat alias
    clearSession: () => signOut({ remote: false }),
  }), [status, user, workspace, e2ee, setUser, setWorkspace, refreshUser, signIn, signOut]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
