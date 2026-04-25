import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { setOnTokenRefreshed, API_BASE } from '@services/api';
import api from '@services/api';
import { getDeviceMetadata, clearDeviceId } from '../utils/deviceId';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [encryptionReady, setEncryptionReady] = useState(false);
  
  const [requiresPassword, setRequiresPassword] = useState(false);
  
  const [accessToken, setAccessToken] = useState(() => {
    return localStorage.getItem("accessToken") || null;
  });

  
  
  
  
  
  const silentRefresh = async () => {
    try {
      const storedRefreshToken = localStorage.getItem('refreshToken');
      const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { 'Content-Type': 'application/json' },
        
        body: storedRefreshToken ? JSON.stringify({ refreshToken: storedRefreshToken }) : undefined,
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.accessToken) {
          localStorage.setItem("accessToken", refreshData.accessToken);
          setAccessToken(refreshData.accessToken);
          
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
      
      let token = localStorage.getItem("accessToken");

      if (!token) {
        console.log('🔄 [LOAD USER] No access token in storage — attempting silent refresh via cookie...');
        token = await silentRefresh();

        if (!token) {
          
          console.log('ℹ️ [LOAD USER] No valid session — user is logged out');
          setUser(null);
          setAccessToken(null);
          setLoading(false);
          return;
        }
      } else {
        setAccessToken(token);
      }

      
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`
        },
      });

      
      if (res.status === 401) {
        console.log('🔄 [LOAD USER] Access token rejected by /me — attempting silent refresh...');
        const newToken = await silentRefresh();

        if (!newToken) {
          
          console.warn('⚠️ [LOAD USER] Silent refresh failed after /me 401 — clearing session');
          setUser(null);
          setAccessToken(null);
          localStorage.removeItem("accessToken");
          setLoading(false);
          return;
        }

        
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
        const isServerError = err.message && (
          err.message.includes('500') ||
          err.message.includes('Failed to unwrap UMEK') ||
          err.message.includes('Crypto state fetch failed')
        );

        if (isServerError) {
          
          
          console.warn('⚠️ [PHASE 1] Transient server error during encryption init (not a password issue):', err.message);
          setEncryptionReady(false);
          
          return;
        }

        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ [PHASE 1] HARD crypto failure:', err);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        setEncryptionReady(false);
        setRequiresPassword(true);
      }
    })();
  };

  useEffect(() => {
    
    setOnTokenRefreshed((newToken) => {
      setAccessToken(newToken);
    });

    
    
    const handleForceLogout = () => {
      console.warn('🔴 [AUTH] Force logout event received from API interceptor');
      logoutRef.current();
    };
    window.addEventListener('auth:force-logout', handleForceLogout);

    loadUser();

    return () => {
      window.removeEventListener('auth:force-logout', handleForceLogout);
    };
  }, []); 

  
  
  
  
  
  
  useEffect(() => {
    if (!user) {
      return; 
    }

    
    
    
    const REFRESH_INTERVAL = 10 * 60 * 1000; 

    console.log('⏰ [TOKEN REFRESH] Setting up automatic refresh every 10 minutes');

    const refreshInterval = setInterval(async () => {
      try {
        console.log('🔄 [TOKEN REFRESH] Attempting automatic token refresh...');

        
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
          
          
          
          
          
          
          
          console.warn(
            `⚠️ [TOKEN REFRESH] Proactive refresh failed (status ${refreshRes.status}). ` +
            'Will retry on next API call via Axios interceptor — NOT logging out.'
          );
        }
      } catch (error) {
        
        console.error('❌ [TOKEN REFRESH] Network error during proactive refresh (will retry on next API call):', error.message);
      }
    }, REFRESH_INTERVAL);

    
    return () => {
      console.log('🛑 [TOKEN REFRESH] Clearing automatic refresh interval');
      clearInterval(refreshInterval);
    };
  }, [user]); 

  
  
  
  const login = async (email, password) => {
    try {
      
      const deviceMetadata = getDeviceMetadata();

      const response = await api.post(
        '/api/auth/login',
        {
          email,
          password,
          ...deviceMetadata  
        }
      );

      const { data } = response;

      
      if (data.accessToken) {
        localStorage.setItem("accessToken", data.accessToken);
        setAccessToken(data.accessToken);
      }
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }

      
      if (!data || !data.user || typeof data.user !== 'object') {
        throw new Error('Invalid user data received from login');
      }
      sessionStorage.setItem("lastLoginAttempt", Date.now().toString());

      
      const userWithCompany = { ...data.user };
      if (data.company) {
        userWithCompany.company = data.company;
      }
      setUser(userWithCompany);

      
      
      
      
      (async () => {
        try {
          const userId = data.user._id || data.user.id;
          const identityKeyService = (await import('../services/identityKeyService')).default;
          
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
      
      
      

      return data;
    } catch (error) {
      
      const err = new Error(error.response?.data?.message || error.message || "Login failed");
      if (error.response) {
        err.response = error.response;  
      }
      throw err;
    }
  };

  
  
  
  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch (err) {
      console.error("Logout error:", err);
    }

    setUser(null);
    setAccessToken(null);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    sessionStorage.removeItem("lastLoginAttempt");

    
    setEncryptionReady(false);

    
    clearDeviceId();

    
    
    
    window.dispatchEvent(new Event('auth:logout'));
  }, []); 

  
  const logoutRef = useRef(logout);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  
  
  
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

  
  
  
  
  const unlockEncryption = async (password) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    const userId = user._id || user.id || user.sub;
    if (!userId) {
      throw new Error('Invalid user ID');
    }

    
    const identityKeyService = (await import('../services/identityKeyService')).default;

    
    
    try {
      const resultNoPass = await identityKeyService.initializeIdentityKeys(userId, null);
      if (resultNoPass?.status === 'READY') {
        setRequiresPassword(false);
        setEncryptionReady(true);
        console.log('✅ [UNLOCK] Encryption unlocked via server KEK (no password needed)');
        return;
      }
    } catch (serverKekErr) {
      
      
      console.warn('⚠️ [UNLOCK] Server KEK unlock failed, trying password:', serverKekErr.message);
    }

    
    const result = await identityKeyService.initializeIdentityKeys(userId, password);

    
    if (result?.status === 'PASSWORD_REQUIRED') {
      throw new Error('Incorrect password');
    }

    
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
        setUser,        
        loading,
        accessToken,
        encryptionReady, 
        requiresPassword, 
        unlockEncryption, 
        login,
        logout,
        loadUser,
        refreshUser: loadUser, 
        updateProfile,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
