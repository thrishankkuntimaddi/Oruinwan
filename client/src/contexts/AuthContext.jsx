// client/src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // try silent login on mount (refresh using cookie)
  useEffect(() => {
    let mounted = true;
    async function attemptRefresh() {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
          setUser(null);
          setAccessToken(null);
          return;
        }
        const data = await res.json();
        if (mounted) {
          setAccessToken(data.accessToken);
          setUser(data.user);
        }
      } catch (err) {
        console.error('refresh failed', err);
        setUser(null);
        setAccessToken(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    attemptRefresh();
    return () => { mounted = false; };
  }, []);

  const login = async ({ email, password }) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(err.message || 'Login failed');
    }
    const data = await res.json();
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('logout error', err);
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  };

  // helper for API calls that need auth; auto-401 handling could be added
  const apiFetch = async (url, options = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await fetch(url, { credentials: 'include', ...options, headers });
    // optionally: if 401 try refresh & retry once (not implemented here)
    return res;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, accessToken, setAccessToken, login, logout, loading, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}
