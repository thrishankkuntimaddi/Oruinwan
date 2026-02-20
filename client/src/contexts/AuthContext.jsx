// client/src/contexts/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { setOnTokenRefreshed } from "../services/api";
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
  const loadUser = async () => {
    try {
      // CRITICAL FIX: Load access token from localStorage
      const storedToken = localStorage.getItem("accessToken");
      if (storedToken) {
        setAccessToken(storedToken);

      } else {
        // Check if we should even attempt a refresh
        // Don't spam refresh requests if we've never logged in
        const lastLoginAttempt = sessionStorage.getItem("lastLoginAttempt");
        const hasRecentSession = lastLoginAttempt && (Date.now() - parseInt(lastLoginAttempt)) < 3600000; // 1 hour

        if (!hasRecentSession) {

          setLoading(false);
          return;
        }



        // Try to get a new access token using refresh token
        try {
          const refreshRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/refresh`, {
            method: "POST",  // Use POST for mutations
            credentials: "include", // Send cookies
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.accessToken) {
              setAccessToken(refreshData.accessToken);
              localStorage.setItem("accessToken", refreshData.accessToken);
              sessionStorage.setItem("lastLoginAttempt", Date.now().toString());

            }
          } else {

            // Clear the session marker
            sessionStorage.removeItem("lastLoginAttempt");
          }
        } catch (refreshErr) {
          console.error("❌ Refresh error:", refreshErr);
          sessionStorage.removeItem("lastLoginAttempt");
        }
      }

      // Now try to fetch user data
      const token = localStorage.getItem("accessToken");
      if (!token) {

        setUser(null);
        setAccessToken(null);
        return;
      }

      // Fetch user with access token
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/me`, {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`
        },
      });



      if (res.ok) {
        const data = await res.json();


        setUser(data);

        // ============================================================
        // 🔐 PHASE 1: IDENTITY KEY INITIALIZATION (Silent & Non-Blocking)
        // Runs for ALL authenticated users (OAuth, email/password, page refresh)
        // NOTE: requiresPasswordSetup is UX-only and does NOT block crypto
        // ============================================================
        (async () => {
          try {
            const userId = data._id || data.id || data.sub;
            if (!userId) {
              console.warn('⚠️ [PHASE 1] No user ID found, skipping initialization');
              return;
            }

            // Dynamically import to avoid circular dependencies
            const identityKeyService = (await import('../services/identityKeyService')).default;

            // PHASE 1: Pass null for password (will use cache if available)
            const result = await identityKeyService.initializeIdentityKeys(userId, null);

            // Handle password-protected identity ONLY if cache is missing
            if (result?.status === 'PASSWORD_REQUIRED') {
              console.log('🔐 [PHASE 1] Password-protected identity - cache missing, encryption deferred');
              setEncryptionReady(false);
              setRequiresPassword(true);
              return;
            }

            // Success - encryption ready
            if (result?.status === 'READY') {
              console.log('✅ [PHASE 1] Identity keys ready (from cache or newly generated)');
              setEncryptionReady(true);
              setRequiresPassword(false);

              // 🔴 FIX 2 — MANDATORY: Fire-and-forget repair (NEVER await, NEVER block UI)
              // 🆕 PHASE 2: Trigger automatic repair in background
              fetch(`${process.env.REACT_APP_BACKEND_URL}/api/v2/conversations/repair-access`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                  Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
                  'Content-Type': 'application/json'
                }
              })
                .then(res => res.json())
                .then(data => console.log('✅ [AUTO-REPAIR] Completed:', data))
                .catch(() => { }); // ✅ IMPORTANT: Silent failure, no UI impact, no retries
            }
          } catch (err) {
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.error('❌ [PHASE 1] HARD crypto failure:', err);
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            // Only real crypto failures block encryption
            setEncryptionReady(false);

            // ❌ NO alert()
            // ❌ NO throw
            // Non-blocking: User can still access app
          }
        })();
        // ============================================================


      } else {
        // Clear invalid tokens

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

  useEffect(() => {
    // Set up token refresh callback
    setOnTokenRefreshed((newToken) => {
      setAccessToken(newToken);

    });

    loadUser();
  }, []);

  // ------------------------------------------------------------
  // 🔄 AUTOMATIC TOKEN REFRESH
  // Refresh access token before it expires (every 13 minutes)
  // ------------------------------------------------------------
  useEffect(() => {
    if (!user) {
      return; // Don't set up refresh if not logged in
    }

    // Refresh 2 minutes before expiry (15m - 2m = 13m = 780000ms)
    const REFRESH_INTERVAL = 13 * 60 * 1000; // 13 minutes

    console.log('⏰ [TOKEN REFRESH] Setting up automatic refresh every 13 minutes');

    const refreshInterval = setInterval(async () => {
      try {
        console.log('🔄 [TOKEN REFRESH] Attempting automatic token refresh...');

        const refreshRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.accessToken) {
            setAccessToken(refreshData.accessToken);
            localStorage.setItem("accessToken", refreshData.accessToken);
            console.log('✅ [TOKEN REFRESH] Access token refreshed successfully');
          }
        } else {
          console.error('❌ [TOKEN REFRESH] Failed:', refreshRes.status);
          // If refresh fails, user might need to re-login
          if (refreshRes.status === 401 || refreshRes.status === 403) {
            console.warn('⚠️ [TOKEN REFRESH] Refresh token expired, logging out...');
            logoutRef.current(); // ✅ Always calls latest logout via ref (no stale closure)
          }
        }
      } catch (error) {
        console.error('❌ [TOKEN REFRESH] Error:', error);
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
        `${process.env.REACT_APP_BACKEND_URL}/api/auth/login`,
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

      // Save access token
      if (data.accessToken) {
        localStorage.setItem("accessToken", data.accessToken);
        setAccessToken(data.accessToken);
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
      // 🔐 PHASE 1: IDENTITY KEY INITIALIZATION (Silent & Non-Blocking)
      // Email/password authentication = user is finalized
      // ============================================================
      (async () => {
        try {
          const userId = data.user._id || data.user.id;

          // Dynamically import to avoid circular dependencies
          const identityKeyService = (await import('../services/identityKeyService')).default;

          // PHASE 1: Pass password for UMEK derivation
          const result = await identityKeyService.initializeIdentityKeys(userId, password);

          // Handle password-protected identity (defensive, shouldn't happen here)
          if (result?.status === 'PASSWORD_REQUIRED') {
            console.warn('🔐 [PHASE 1] Password required during login (unusual)');
            setEncryptionReady(false);
            return;
          }

          // Success - encryption ready
          if (result?.status === 'READY') {
            console.log('✅ [PHASE 1] Identity keys initialized successfully');
            setEncryptionReady(true);
            setRequiresPassword(false);

            // 🔴 FIX 2 — Fire-and-forget repair after login
            fetch(`${process.env.REACT_APP_BACKEND_URL}/api/v2/conversations/repair-access`, {
              method: 'POST',
              credentials: 'include',
              headers: {
                Authorization: `Bearer ${data.accessToken}`,
                'Content-Type': 'application/json'
              }
            })
              .then(res => res.json())
              .then(repairData => console.log('✅ [AUTO-REPAIR] Completed:', repairData))
              .catch(() => { }); // Silent failure
          }
        } catch (err) {
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('❌ [PHASE 1] HARD crypto failure:', err);
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

          // Only real crypto failures block encryption
          setEncryptionReady(false);

          // ❌ NO alert()
          // ❌ NO throw
          // Non-blocking: User can still access app, encryption will initialize lazily
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
        `${process.env.REACT_APP_BACKEND_URL}/api/auth/logout`,
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
    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/me`, {
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
    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/me/password`, {
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
