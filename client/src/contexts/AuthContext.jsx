// client/src/contexts/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect } from "react";
import { setOnTokenRefreshed } from "../services/api";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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
        // 🔐 IDENTITY KEY INITIALIZATION (Silent & Non-Blocking)
        // Runs for ALL users: OAuth, regular login, page refresh
        // ============================================================
        (async () => {
          try {
            const userId = data._id || data.id || data.sub;
            if (!userId) {
              console.warn('⚠️ [Identity Keys] No user ID found, skipping initialization');
              return;
            }

            console.log('🔐 [Identity Keys] Initializing for user:', userId);

            // Dynamically import to avoid circular dependencies
            const identityKeyService = (await import('../services/identityKeyService')).default;

            const result = await identityKeyService.initializeIdentityKeys(userId);

            if (!result.existed) {
              // New keypair generated - upload public key to server
              await identityKeyService.uploadPublicKeyToServer();
              console.log(`✅ [Identity Keys] Created & uploaded (${result.algorithm})`);
            } else {
              console.log(`✅ [Identity Keys] Loaded existing key (${result.algorithm})`);
            }
          } catch (err) {
            console.warn('⚠️ [Identity Keys] Init failed (non-blocking):', err);
            // ❌ NO alert()
            // ❌ NO throw
            // Message encryption will retry later
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
    // 🔐 IDENTITY KEY INITIALIZATION (Silent & Non-Blocking)
    // ============================================================
    (async () => {
      try {
        const userId = data.user._id || data.user.id;
        console.log('🔐 [Identity Keys] Initializing for user:', userId);

        // Dynamically import to avoid circular dependencies
        const identityKeyService = (await import('../services/identityKeyService')).default;

        const result = await identityKeyService.initializeIdentityKeys(userId);

        if (!result.existed) {
          // New keypair generated - upload public key to server
          await identityKeyService.uploadPublicKeyToServer();
          console.log(`✅ [Identity Keys] Created & uploaded (${result.algorithm})`);
        } else {
          console.log(`✅ [Identity Keys] Loaded existing key (${result.algorithm})`);
        }
      } catch (err) {
        console.warn('⚠️ [Identity Keys] Init failed (non-blocking):', err);
        // ❌ NO alert()
        // ❌ NO throw
        // Message encryption will retry later
      }
    })();
    // ============================================================


    // ============================================================
    // 🔐 E2EE KEY INITIALIZATION
    // ============================================================
    try {
      console.log('🔐 [E2EE] Starting workspace key enrollment...');
      console.log('🔐 [E2EE] User ID:', data.user._id || data.user.id);

      // STEP 1: Auto-enroll in workspaces user is member of but doesn't have keys for
      console.log('🔐 [E2EE] Step 1: Auto-enrolling in missing workspaces...');
      try {
        const autoEnrollRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/keys/auto-enroll`, {
          method: 'POST',
          credentials: "include",
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.accessToken}`
          },
          body: JSON.stringify({ password })
        });

        if (autoEnrollRes.ok) {
          const autoEnrollData = await autoEnrollRes.json();
          console.log(`✅ [E2EE] Auto-enrolled in ${autoEnrollData.enrolledCount} workspaces`);
        } else {
          console.warn('⚠️ [E2EE] Auto-enrollment failed (non-blocking):', await autoEnrollRes.text());
        }
      } catch (autoEnrollError) {
        console.warn('⚠️ [E2EE] Auto-enrollment error (non-blocking):', autoEnrollError);
      }

      // STEP 2: Fetch encrypted workspace keys from backend
      console.log('🔐 [E2EE] Step 2: Fetching workspace keys from /api/keys/all...');
      const keysRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/keys/all`, {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${data.accessToken}`
        }
      });

      console.log('🔐 [E2EE] API Response status:', keysRes.status);

      if (keysRes.ok) {
        const keysData = await keysRes.json();
        console.log('🔐 [E2EE] API Response data:', keysData);

        const { encryptedKeys } = keysData;

        if (encryptedKeys && encryptedKeys.length > 0) {
          console.log(`🔑 [E2EE] Found ${encryptedKeys.length} workspace keys to decrypt`);
          console.log('🔑 [E2EE] Workspace IDs:', encryptedKeys.map(k => k.workspaceId));

          // Dynamically import to avoid circular dependencies
          const { enrollUserKeys } = await import('../services/keyManagement');

          console.log('🔓 [E2EE] Step 3: Starting decryption with user password...');
          const result = await enrollUserKeys(password, encryptedKeys);

          if (result.success) {
            console.log(`✅ [E2EE] Successfully enrolled in ${result.workspaceIds.length} workspaces`);
            console.log('✅ [E2EE] Enrolled workspace IDs:', result.workspaceIds);

            // Verify keys are in sessionStorage
            const storedKeys = result.workspaceIds.map(id => ({
              workspaceId: id,
              hasKey: sessionStorage.getItem(`e2ee_workspace_key_${id}`) !== null
            }));
            console.log('🔍 [E2EE] sessionStorage verification:', storedKeys);
          } else {
            console.error('❌ [E2EE] Key enrollment failed:', result.error);
            // Silent failure - encryption will initialize lazily on first message send
          }
        } else {
          console.log('ℹ️ [E2EE] No workspace keys found (user not in any workspaces yet)');
          // This is expected - encryption will initialize when user joins/creates workspace
        }
      } else {
        const errorText = await keysRes.text();
        console.error('❌ [E2EE] Failed to fetch workspace keys');
        console.error('❌ [E2EE] Status:', keysRes.status);
        console.error('❌ [E2EE] Response:', errorText);
        // Silent failure - encryption will initialize lazily when needed
      }
    } catch (e2eeError) {
      // Non-blocking: User can still use the app
      console.error('❌ [E2EE] Initialization failed (non-blocking):', e2eeError);
      console.error('❌ [E2EE] Stack trace:', e2eeError.stack);
      // Silent failure - encryption will initialize lazily on first message
    }
    // ============================================================

    // E2EE: Try to unlock encryption keys with password (non-blocking)
    // This will be handled by useEncryption hook in components
    // Store password temporarily for E2EE unlock
    sessionStorage.setItem('e2ee_unlock_password', password);

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
    sessionStorage.removeItem('e2ee_unlock_password');

    // E2EE: Clear encryption keys from IndexedDB
    // This will be handled by useEncryption hook cleanup
    // Trigger event for encryption cleanup
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
