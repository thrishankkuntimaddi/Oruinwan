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
        console.log("✅ Access token loaded from localStorage");
      } else {
        // Check if we should even attempt a refresh
        // Don't spam refresh requests if we've never logged in
        const lastLoginAttempt = sessionStorage.getItem("lastLoginAttempt");
        const hasRecentSession = lastLoginAttempt && (Date.now() - parseInt(lastLoginAttempt)) < 3600000; // 1 hour

        if (!hasRecentSession) {
          console.log("ℹ️ No access token and no recent session - skipping refresh attempt");
          setLoading(false);
          return;
        }

        console.log("ℹ️ No access token in localStorage, trying refresh token");

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
              console.log("✅ New access token obtained from refresh");
            }
          } else {
            console.log("ℹ️ No valid refresh token - user needs to log in");
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
        console.log("❌ Still no access token after refresh attempt");
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

      console.log('🔍 /me Response status:', res.status);

      if (res.ok) {
        const data = await res.json();
        console.log('📦 User data:', data);

        setUser(data);
        console.log("✅ User loaded:", data.username);
      } else {
        // Clear invalid tokens
        console.log("❌ Failed to load user, clearing tokens");
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
      console.log("🔄 AuthContext synced with refreshed token");
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
    console.log("✅ Token saved to localStorage:", data.accessToken.substring(0, 20) + "...");

    // Then update state (this triggers re-renders)
    setAccessToken(data.accessToken);

    // Merge company data into user object for consistency with /me endpoint
    const userWithCompany = { ...data.user };
    if (data.company) {
      userWithCompany.company = data.company;
    }
    setUser(userWithCompany);

    console.log("✅ Token and user set in context");

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
    console.log("✅ Token cleared from localStorage");
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
