// client/src/contexts/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { setOnTokenRefreshed, API_BASE } from "../services/api";
import axios from 'axios';
import { getDeviceMetadata, clearDeviceId } from '../utils/deviceId';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // ✅ FIX 1: Add encryption ready state
  const [encryptionReady, setEncryptionReady] = useState(false);
  // ✅ Password unlock state
  const [requiresPassword, setRequiresPassword] = useState(false);
  // Initialize from localStorage immediately
  const [accessToken, setAccessToken] = useState(() => {
    return localStorage.getItem("accessToken") || null;
  });

  // ------------------------------------------------------------
  // Load user on app start
  // ------------------------------------------------------------
  // Helper: attempt one silent token refresh via the httpOnly cookie.
  // Returns the new access token string on success, or null on failure.
  const silentRefresh = async () => {
    try {
      const storedRefreshToken = localStorage.getItem('refreshToken');
      const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { 'Content-Type': 'application/json' },
        // Send refreshToken in body as cross-origin cookie fallback
        body: storedRefreshToken ? JSON.stringify({ refreshToken: storedRefreshToken }) : undefined,
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.accessToken) {
          localStorage.setItem("accessToken", refreshData.accessToken);
          setAccessToken(refreshData.accessToken);
          // Rotate the stored refresh token if server returned a new one
          if (refreshData.refreshToken) {
            localStorage.setItem('refreshToken', refreshData.refreshToken);
          }
          console.log('✅ [SILENT REFRESH] New access token obtained');
          return refreshData.accessToken;
        }
      } else {
        console.warn(`⚠️ [SILENT REFRESH] Failed with status ${refreshRes.status}`);
      }
    } catch (refreshErr) {
      console.error("❌ [SILENT REFRESH] Network error:", refreshErr);
    }
    return null;
  };

  const loadUser = async () => {
    try {
      // Step 1: Get access token — refresh silently if not in localStorage
      let token = localStorage.getItem("accessToken");

      if (!token) {
        console.log('🔄 [LOAD USER] No access token in storage — attempting silent refresh via cookie...');
        token = await silentRefresh();

        if (!token) {
          // Refresh cookie absent or expired — genuine logged-out state
          console.log('ℹ️ [LOAD USER] No valid session — user is logged out');
          setUser(null);
          setAccessToken(null);
          setLoading(false);
          return;
        }
      } else {
        setAccessToken(token);
      }

      // Step 2: Fetch user profile with the access token
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`
        },
      });

      // Step 3: If token expired mid-session, try one silent refresh then retry
      if (res.status === 401) {
        console.log('🔄 [LOAD USER] Access token rejected by /me — attempting silent refresh...');
        const newToken = await silentRefresh();

        if (!newToken) {
          // Refresh also failed → genuine session expiry
          console.warn('⚠️ [LOAD USER] Silent refresh failed after /me 401 — clearing session');
          setUser(null);
          setAccessToken(null);
          localStorage.removeItem("accessToken");
          setLoading(false);
          return;
        }

        // Retry /me with the fresh token
        const retryRes = await fetch(`${API_BASE}/api/auth/me`, {
          credentials: "include",
          headers: { Authorization: `Bearer ${newToken}` },
        });

        if (!retryRes.ok) {
          console.warn('⚠️ [LOAD USER] /me still failed after refresh — clearing session');
          setUser(null);
          setAccessToken(null);
          localStorage.removeItem("accessToken");
          setLoading(false);
          return;
        }

        const data = await retryRes.json();
        setUser(data);
        initializeEncryption(data);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setUser(data);
        initializeEncryption(data);
      } else {
        // Non-401 error (e.g. 500) — clear token but don't blame the refresh cookie
        console.warn(`⚠️ [LOAD USER] /me returned ${res.status} — clearing access token`);
        setUser(null);
        setAccessToken(null);
        localStorage.removeItem("accessToken");
      }
    } catch (err) {
      console.error("❌ Error loading user:", err);
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem("accessToken");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // 🔐 PHASE 1: IDENTITY KEY INITIALIZATION (extracted helper)
  // ============================================================
  const initializeEncryption = (data) => {
    (async () => {
      try {
        const userId = data._id || data.id || data.sub;
        if (!userId) {
          console.warn('⚠️ [PHASE 1] No user ID found, skipping initialization');
          return;
        }

        const identityKeyService = (await import('../services/identityKeyService')).default;
        const result = await identityKeyService.initializeIdentityKeys(userId, null);

        if (result?.status === 'PASSWORD_REQUIRED') {
          console.log('🔐 [PHASE 1] Password-protected identity - cache missing, encryption deferred');
          setEncryptionReady(false);
          setRequiresPassword(true);
          return;
        }

        if (result?.status === 'READY') {
          console.log('✅ [PHASE 1] Identity keys ready (from cache or newly generated)');
          setEncryptionReady(true);
          setRequiresPassword(false);

          // Fire-and-forget repair (NEVER await, NEVER block UI)
          fetch(`${API_BASE}/api/v2/conversations/repair-access`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
              'Content-Type': 'application/json'
            }
          })
            .then(res => res.json())
            .then(data => console.log('✅ [AUTO-REPAIR] Completed:', data))
            .catch(() => { });
        }
      } catch (err) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ [PHASE 1] HARD crypto failure:', err);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        setEncryptionReady(false);
      }
    })();
  };

  useEffect(() => {
    // Set up token refresh callback for the axios interceptor
    setOnTokenRefreshed((newToken) => {
      setAccessToken(newToken);
    });

    // Listen for forced logout events dispatched by the api.js interceptor
    // (when refresh fails mid-session during an API call)
    const handleForceLogout = () => {
      console.warn('🔴 [AUTH] Force logout event received from API interceptor');
      logoutRef.current();
    };
    window.addEventListener('auth:force-logout', handleForceLogout);

    loadUser();

    return () => {
      window.removeEventListener('auth:force-logout', handleForceLogout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------
  // 🔄 AUTOMATIC TOKEN REFRESH
  // Refresh access token before it expires (every 10 minutes)
  // 5-minute safety buffer before the 15-minute expiry avoids race
  // conditions with the Axios interceptor also trying to refresh.
  // ------------------------------------------------------------
  useEffect(() => {
    if (!user) {
      return; // Don't set up refresh if not logged in
    }

    // Refresh 5 minutes before expiry (15m - 5m = 10m = 600000ms)
    // Previously 13 minutes — too close to expiry, caused race conditions
    // with the Axios interceptor on the first expired API call.
    const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

    console.log('⏰ [TOKEN REFRESH] Setting up automatic refresh every 10 minutes');

    const refreshInterval = setInterval(async () => {
      try {
        console.log('🔄 [TOKEN REFRESH] Attempting automatic token refresh...');

        // Guard: skip if no access token exists (already logged out)
        const existingToken = localStorage.getItem('accessToken');
        if (!existingToken) {
          console.log('⏭️ [TOKEN REFRESH] No access token in storage, skipping proactive refresh');
          return;
        }

        const storedRefreshToken = localStorage.getItem('refreshToken');
        const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { 'Content-Type': 'application/json' },
          // Always send body fallback — cookie may be blocked cross-origin in production
          body: storedRefreshToken ? JSON.stringify({ refreshToken: storedRefreshToken }) : undefined,
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.accessToken) {
            setAccessToken(refreshData.accessToken);
            localStorage.setItem("accessToken", refreshData.accessToken);
            if (refreshData.refreshToken) {
              localStorage.setItem('refreshToken', refreshData.refreshToken);
            }
            console.log('✅ [TOKEN REFRESH] Access token refreshed successfully');
          }
        } else {
          // ⚠️ DO NOT logout here on proactive refresh failure.
          // The Axios interceptor in api.js already handles 401s correctly on every
          // API call, including retrying with the refresh token. Logging out here
          // causes a race: if both the proactive timer AND the interceptor fire at
          // ~15 min, the second one gets a 403 (already-rotated token) and this
          // handler would wrongly terminate the session.
          // Let the session expire naturally; the interceptor will handle recovery.
          console.warn(
            `⚠️ [TOKEN REFRESH] Proactive refresh failed (status ${refreshRes.status}). ` +
            'Will retry on next API call via Axios interceptor — NOT logging out.'
          );
        }
      } catch (error) {
        // Network error — silent, do not logout. Interceptor handles recovery.
        console.error('❌ [TOKEN REFRESH] Network error during proactive refresh (will retry on next API call):', error.message);
      }
    }, REFRESH_INTERVAL);

    // Cleanup interval on unmount or when user logs out
    return () => {
      console.log('🛑 [TOKEN REFRESH] Clearing automatic refresh interval');
      clearInterval(refreshInterval);
    };
  }, [user]); // CRITICAL: Only depend on user, NOT accessToken (prevents loop)

  // ------------------------------------------------------------
  // Login (normal email/password)
  // ------------------------------------------------------------
  const login = async (email, password) => {
    try {
      // PHASE 3: Get device metadata
      const deviceMetadata = getDeviceMetadata();

      const response = await axios.post(
        `${API_BASE}/api/auth/login`,
        {
          email,
          password,
          ...deviceMetadata  // Include device info
        },
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        }
      );

      const { data } = response;

      // Save access token and refresh token
      if (data.accessToken) {
        localStorage.setItem("accessToken", data.accessToken);
        setAccessToken(data.accessToken);
      }
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }

      // Ensure data.user exists and is valid
      if (!data || !data.user || typeof data.user !== 'object') {
        throw new Error('Invalid user data received from login');
      }
      sessionStorage.setItem("lastLoginAttempt", Date.now().toString());

      // Merge company data into user object for consistency with /me endpoint
      const userWithCompany = { ...data.user };
      if (data.company) {
        userWithCompany.company = data.company;
      }
      setUser(userWithCompany);

      // ============================================================
      // 🔐 PHASE 1: IDENTITY KEY INITIALIZATION (via shared helper)
      // Email/password authentication = user is finalized
      // ============================================================
      (async () => {
        try {
          const userId = data.user._id || data.user.id;
          const identityKeyService = (await import('../services/identityKeyService')).default;
          // Pass password for UMEK derivation on login
          const result = await identityKeyService.initializeIdentityKeys(userId, password);

          if (result?.status === 'PASSWORD_REQUIRED') {
            console.warn('🔐 [PHASE 1] Password required during login (unusual)');
            setEncryptionReady(false);
            return;
          }

          if (result?.status === 'READY') {
            console.log('✅ [PHASE 1] Identity keys initialized successfully');
            setEncryptionReady(true);
            setRequiresPassword(false);

            fetch(`${API_BASE}/api/v2/conversations/repair-access`, {
              method: 'POST',
              credentials: 'include',
              headers: {
                Authorization: `Bearer ${data.accessToken}`,
                'Content-Type': 'application/json'
              }
            })
              .then(res => res.json())
              .then(repairData => console.log('✅ [AUTO-REPAIR] Completed:', repairData))
              .catch(() => { });
          }
        } catch (err) {
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('❌ [PHASE 1] HARD crypto failure:', err);
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          setEncryptionReady(false);
        }
      })();
      // ============================================================
      // END PHASE 1
      // ============================================================


      return data;
    } catch (error) {
      // Preserve response data for special cases (e.g., deactivation with requiresReactivation flag)
      const err = new Error(error.response?.data?.message || error.message || "Login failed");
      if (error.response) {
        err.response = error.response;  // Preserve the full response object
      }
      throw err;
    }
  };

  // ------------------------------------------------------------
  // Logout
  // ------------------------------------------------------------
  const logout = useCallback(async () => {
    try {
      await axios.post(
        `${API_BASE}/api/auth/logout`,
        {},
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        }
      );
    } catch (err) {
      console.error("Logout error:", err);
    }

    setUser(null);
    setAccessToken(null);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    sessionStorage.removeItem("lastLoginAttempt");

    // ✅ FIX 1: Reset encryption ready state
    setEncryptionReady(false);

    // PHASE 3: Clear device ID on logout
    clearDeviceId();

    // E2EE: Clear encryption keys from IndexedDB
    // This will be handled by service cleanup listeners
    // Trigger event for encryption cleanup
    window.dispatchEvent(new Event('auth:logout'));
  }, []); // Stable logout reference - prevents stale closures in intervals

  // Keep a stable ref to logout so the interval never captures a stale closure
  const logoutRef = useRef(logout);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  // ------------------------------------------------------------
  // Update profile
  // ------------------------------------------------------------
  const updateProfile = async (updates) => {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
      body: JSON.stringify(updates),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    setUser(data.user);
    return data;
  };

  // ------------------------------------------------------------
  // Update password
  // ------------------------------------------------------------
  const updatePassword = async (oldPassword, newPassword) => {
    const res = await fetch(`${API_BASE}/api/auth/me/password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
      body: JSON.stringify({ oldPassword, newPassword }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    return data;
  };

  // ============================================================
  // 🔐 UNLOCK ENCRYPTION (Password Unlock Modal)
  // Retries identity key initialization with provided password
  // ============================================================
  const unlockEncryption = async (password) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    const userId = user._id || user.id || user.sub;
    if (!userId) {
      throw new Error('Invalid user ID');
    }

    // Dynamically import to avoid circular dependencies
    const identityKeyService = (await import('../services/identityKeyService')).default;

    // Retry with password
    const result = await identityKeyService.initializeIdentityKeys(userId, password);

    // Check if password was incorrect (still returns PASSWORD_REQUIRED)
    if (result?.status === 'PASSWORD_REQUIRED') {
      throw new Error('Incorrect password');
    }

    // Success - encryption unlocked
    if (result?.status === 'READY') {
      setRequiresPassword(false);
      setEncryptionReady(true);
      console.log('✅ [UNLOCK] Encryption unlocked successfully');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,        // <-- IMPORTANT FIX
        loading,
        accessToken,
        encryptionReady, // ✅ FIX 1: Export encryption ready state
        requiresPassword, // ✅ Password unlock state
        unlockEncryption, // ✅ Password unlock function
        login,
        logout,
        loadUser,
        refreshUser: loadUser, // Alias for manual refresh
        updateProfile,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
