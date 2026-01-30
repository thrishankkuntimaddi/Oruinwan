// client/src/contexts/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect } from "react";
import { setOnTokenRefreshed } from "../services/api";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // ✅ FIX 1: Add encryption ready state
  const [encryptionReady, setEncryptionReady] = useState(false);
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

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔐 [PHASE 1] Initializing identity keys for user:', userId);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            // Dynamically import to avoid circular dependencies
            const identityKeyService = (await import('../services/identityKeyService')).default;

            const result = await identityKeyService.initializeIdentityKeys(userId);

            if (!result.existed) {
              // New keypair generated - upload public key to server
              console.log('🔑 [PHASE 1] Generating new identity key pair');
              await identityKeyService.uploadPublicKeyToServer();
              console.log('📤 [PHASE 1] Uploading public key');
              console.log(`✅ [PHASE 1] Created & uploaded new identity key (${result.algorithm})`);
            } else {
              console.log(`✅ [PHASE 1] Found existing identity key (${result.algorithm})`);
            }

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✅ [PHASE 1] COMPLETE — Identity established');
            console.log('✅ [REHYDRATION] Encryption ready at:', new Date().toISOString());
            console.log('   Algorithm:', result.algorithm);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            // ✅ FIX 1: Signal encryption is ready
            setEncryptionReady(true);
          } catch (err) {
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.error('❌ [PHASE 1] FAILED — Identity initialization error:', err);
            console.error('❌ [REHYDRATION] Encryption NOT ready - keys failed to load');
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            // ⚠️ GUARDRAIL: Do NOT auto-regenerate keys - could be corruption
            // User must explicitly reset if keys are corrupted
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
  // Login (normal email/password)
  // ------------------------------------------------------------
  const login = async ({ email, password }) => {
    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "Login failed");

    // CRITICAL FIX: Save to localStorage FIRST to ensure immediate availability
    localStorage.setItem("accessToken", data.accessToken);
    sessionStorage.setItem("lastLoginAttempt", Date.now().toString());


    // Then update state (this triggers re-renders)
    setAccessToken(data.accessToken);

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
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔐 [PHASE 1] Initializing identity keys for user:', userId);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Dynamically import to avoid circular dependencies
        const identityKeyService = (await import('../services/identityKeyService')).default;

        const result = await identityKeyService.initializeIdentityKeys(userId);

        if (!result.existed) {
          // New keypair generated - upload public key to server
          console.log('🔑 [PHASE 1] Generating new identity keypair');
          await identityKeyService.uploadPublicKeyToServer();
          console.log('📤 [PHASE 1] Uploading public key');
          console.log(`✅ [PHASE 1] Created & uploaded new identity key (${result.algorithm})`);
        } else {
          console.log(`✅ [PHASE 1] Found existing identity key (${result.algorithm})`);
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ [PHASE 1] COMPLETE — Identity established');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } catch (err) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ [PHASE 1] FAILED — Identity initialization error:', err);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // ❌ NO alert()
        // ❌ NO throw
        // Non-blocking: User can still access app, encryption will initialize lazily
      }
    })();
    // ============================================================
    // END PHASE 1
    // ============================================================

    return data;
  };

  // ------------------------------------------------------------
  // Logout
  // ------------------------------------------------------------
  const logout = async () => {
    await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    setUser(null);
    setAccessToken(null);
    localStorage.removeItem("accessToken");
    sessionStorage.removeItem("lastLoginAttempt");

    // ✅ FIX 1: Reset encryption ready state
    setEncryptionReady(false);

    // E2EE: Clear encryption keys from IndexedDB
    // This will be handled by service cleanup listeners
    // Trigger event for encryption cleanup
    console.log('🗑️ [LOGOUT] Dispatching auth:logout event for cache cleanup');
    window.dispatchEvent(new Event('auth:logout'));
  };

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

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,        // <-- IMPORTANT FIX
        loading,
        accessToken,
        encryptionReady, // ✅ FIX 1: Export encryption ready state
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
