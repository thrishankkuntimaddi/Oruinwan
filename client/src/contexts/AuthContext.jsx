// client/src/contexts/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect } from "react";

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
        console.log("ℹ️ No access token in localStorage, will try refresh token");
      }

      // Try to fetch user data with stored access token OR refresh token cookie
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/me`, {
        credentials: "include",
        headers: storedToken
          ? { Authorization: `Bearer ${storedToken}` }
          : {},
      });

      // If backend auto-refreshed, it will send a new access token
      const newAT = res.headers.get("x-access-token");
      if (newAT) {
        setAccessToken(newAT);
        localStorage.setItem("accessToken", newAT);
        console.log("✅ New access token received from auto-refresh");
      }

      if (res.ok) {
        const data = await res.json();
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

    // Save to state
    setAccessToken(data.accessToken);
    setUser(data.user);

    // CRITICAL: Save to localStorage so it persists across page refreshes
    localStorage.setItem("accessToken", data.accessToken);
    console.log("✅ Token saved to localStorage");

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
        loadUser,      // <-- ADD THIS for OAuthSuccess
        updateProfile,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
