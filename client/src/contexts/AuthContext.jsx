import React, { createContext, useState, useEffect, useCallback } from "react";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // user object
  const [accessToken, setAccessToken] = useState(null); // short lived token
  const [loading, setLoading] = useState(true); // loading app on startup

  // ---------------------------------------------------------
  // 1) LOGIN FUNCTION
  // ---------------------------------------------------------
  const login = async (email, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include", // IMPORTANT: includes refresh cookie
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");

    setUser(data.user);
    setAccessToken(data.accessToken);
    return true;
  };

  // ---------------------------------------------------------
  // 2) LOGOUT FUNCTION
  // ---------------------------------------------------------
  const logout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    setUser(null);
    setAccessToken(null);
  };

  // ---------------------------------------------------------
  // 3) AUTO REFRESH TOKEN
  // called automatically when accessToken expires OR on page load
  // ---------------------------------------------------------
  const refreshAccessToken = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        setUser(null);
        setAccessToken(null);
        return null;
      }

      // only refresh token returns the new access token
      if (data.accessToken) {
        setAccessToken(data.accessToken);
      }

      return data.accessToken;
    } catch (err) {
      setUser(null);
      setAccessToken(null);
      return null;
    }
  }, []);

  // ---------------------------------------------------------
  // 4) AUTO LOGIN ON PAGE RELOAD
  // (App loads → tries refresh endpoint → sets user)
  // ---------------------------------------------------------
  useEffect(() => {
    async function initAuth() {
      const token = await refreshAccessToken();

      if (token) {
        // get user details by decoding token OR call a "me" endpoint
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUser({
          id: payload.id || payload.sub,
          email: payload.email,
          roles: payload.roles || ["user"],
          verified: payload.verified
        });
      }

      setLoading(false);
    }

    initAuth();
  }, [refreshAccessToken]);

  // ---------------------------------------------------------
  // GLOBAL CONTEXT VALUES
  // ---------------------------------------------------------
  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        login,
        logout,
        loading,
        refreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
