import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUser, saveUser, cacheGet, cacheSet, cacheRemove, removeToken, removeUser } from '../services/storage';

const WORKSPACE_CACHE_KEY = 'active_workspace';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [workspace, setWorkspaceState] = useState(null); 

  
  useEffect(() => {
    (async () => {
      const u = await getUser();
      if (u) setUserState(u);
      const ws = await cacheGet(WORKSPACE_CACHE_KEY);
      if (ws) setWorkspaceState(ws);
    })();
  }, []);

  async function setUser(u) {
    setUserState(u);
    if (u) await saveUser(u);
  }

  async function setWorkspace(ws) {
    setWorkspaceState(ws);
    if (ws) {
      await cacheSet(WORKSPACE_CACHE_KEY, ws);
    } else {
      await cacheRemove(WORKSPACE_CACHE_KEY);
    }
  }

  async function clearSession() {
    setUserState(null);
    setWorkspaceState(null);
    await Promise.all([
      removeToken(),
      removeUser(),
      cacheRemove(WORKSPACE_CACHE_KEY),
    ]);
  }

  return (
    <AppContext.Provider value={{ user, workspace, setUser, setWorkspace, clearSession }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
