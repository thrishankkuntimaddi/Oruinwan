import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { setOnTokenRefreshed, refreshAccessToken, API_BASE } from '@services/api';
import api from '@services/api';
import { getDeviceMetadata, clearDeviceId } from '../utils/deviceId';
import logger from '../utils/logger';
import { clearAllAiHistory } from '../utils/aiChatHistoryStorage';

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
      const token = await refreshAccessToken();
      setAccessToken(token);
      logger.debug('✅ [SILENT REFRESH] New access token obtained');
      return token;
    } catch (refreshErr) {
      logger.warn('⚠️ [SILENT REFRESH] Failed:', refreshErr?.response?.status || refreshErr?.message);
      return null;
    }
  };

  const loadUser = async () => {
    try {
      
      let token = localStorage.getItem("accessToken");

      if (!token) {
        logger.debug('🔄 [LOAD USER] No access token in storage — attempting silent refresh via cookie...');
        token = await silentRefresh();

        if (!token) {
          
          logger.debug('ℹ️ [LOAD USER] No valid session — user is logged out');
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
        logger.debug('🔄 [LOAD USER] Access token rejected by /me — attempting silent refresh...');
        const newToken = await silentRefresh();

        if (!newToken) {
          
          logger.warn('⚠️ [LOAD USER] Silent refresh failed after /me 401 — clearing session');
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
          logger.warn('⚠️ [LOAD USER] /me still failed after refresh — clearing session');
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
        
        logger.warn(`⚠️ [LOAD USER] /me returned ${res.status} — clearing access token`);
        setUser(null);
        setAccessToken(null);
        localStorage.removeItem("accessToken");
      }
    } catch (err) {
      logger.error("❌ Error loading user:", err);
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
          logger.warn('⚠️ [PHASE 1] No user ID found, skipping initialization');
          return;
        }

        const identityKeyService = (await import('../services/identityKeyService')).default;
        const result = await identityKeyService.initializeIdentityKeys(userId, null);

        if (result?.status === 'PASSWORD_REQUIRED') {
          
          logger.debug('🔐 [PHASE 1] Password-protected identity - cache missing, encryption deferred');
          setEncryptionReady(false);
          setRequiresPassword(true);
          return;
        }

        if (result?.status === 'READY') {
          logger.debug('✅ [PHASE 1] Identity keys ready (from cache or newly generated)');
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
            .then(data => logger.debug('✅ [AUTO-REPAIR] Completed:', data))
            .catch(() => { });
        }
      } catch (err) {
        const isServerError = err.message && (
          err.message.includes('500') ||
          err.message.includes('Failed to unwrap UMEK') ||
          err.message.includes('Crypto state fetch failed')
        );

        if (isServerError) {
          
          
          logger.warn('⚠️ [PHASE 1] Transient server error during encryption init (not a password issue):', err.message);
          setEncryptionReady(false);
          
          return;
        }

        logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logger.error('❌ [PHASE 1] HARD crypto failure:', err);
        logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
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
      logger.warn('🔴 [AUTH] Force logout event received from API interceptor');
      logoutRef.current();
    };
    window.addEventListener('auth:force-logout', handleForceLogout);

    loadUser();

    return () => {
      window.removeEventListener('auth:force-logout', handleForceLogout);
    };
  }, []); 

  
  
  
  
  
  
  const currentUserIdRef = useRef(null);
  useEffect(() => {
    currentUserIdRef.current = user ? (user._id || user.id || user.sub || null) : null;
  }, [user]);

  const refreshUserKey = user ? (user._id || user.id || 'anon') : null;
  useEffect(() => {
    if (!refreshUserKey) {
      return; 
    }

    
    
    
    const REFRESH_INTERVAL = 10 * 60 * 1000; 

    logger.debug('⏰ [TOKEN REFRESH] Setting up automatic refresh every 10 minutes');

    const refreshInterval = setInterval(async () => {
      try {
        logger.debug('🔄 [TOKEN REFRESH] Attempting automatic token refresh...');

        
        const existingToken = localStorage.getItem('accessToken');
        if (!existingToken) {
          logger.debug('⏭️ [TOKEN REFRESH] No access token in storage, skipping proactive refresh');
          return;
        }

        await refreshAccessToken();
        logger.debug('✅ [TOKEN REFRESH] Access token refreshed successfully');
      } catch (error) {
        
        logger.warn('⚠️ [TOKEN REFRESH] Proactive refresh failed (will retry on next API call via interceptor — NOT logging out):', error.message);
      }
    }, REFRESH_INTERVAL);

    
    return () => {
      logger.debug('🛑 [TOKEN REFRESH] Clearing automatic refresh interval');
      clearInterval(refreshInterval);
    };
  }, [refreshUserKey]); 

  
  
  
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
            logger.warn('🔐 [PHASE 1] Password required during login (unusual)');
            setEncryptionReady(false);
            return;
          }

          if (result?.status === 'READY') {
            logger.debug('✅ [PHASE 1] Identity keys initialized successfully');
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
              .then(repairData => logger.debug('✅ [AUTO-REPAIR] Completed:', repairData))
              .catch(() => { });
          }
        } catch (err) {
          logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          logger.error('❌ [PHASE 1] HARD crypto failure:', err);
          logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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
    const loggedOutUserId = currentUserIdRef.current;
    try {
      await api.post('/api/auth/logout', {});
    } catch (err) {
      logger.error("Logout error:", err);
    }

    setUser(null);
    setAccessToken(null);
    localStorage.removeItem("accessToken");
    sessionStorage.removeItem("lastLoginAttempt");
    clearAllAiHistory();

    
    setEncryptionReady(false);

    
    clearDeviceId();

    
    
    
    window.dispatchEvent(new CustomEvent('auth:logout', { detail: { userId: loggedOutUserId } }));
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
        logger.debug('✅ [UNLOCK] Encryption unlocked via server KEK (no password needed)');
        return;
      }
    } catch (serverKekErr) {
      
      
      logger.warn('⚠️ [UNLOCK] Server KEK unlock failed, trying password:', serverKekErr.message);
    }

    
    const result = await identityKeyService.initializeIdentityKeys(userId, password);

    
    if (result?.status === 'PASSWORD_REQUIRED') {
      throw new Error('Incorrect password');
    }

    
    if (result?.status === 'READY') {
      setRequiresPassword(false);
      setEncryptionReady(true);
      logger.debug('✅ [UNLOCK] Encryption unlocked successfully');
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
