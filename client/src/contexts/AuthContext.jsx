import React, { createContext, useContext, useState, useEffect } from "react";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);     // logged in user
  const [loading, setLoading] = useState(true); // loading initial user
  const [accessToken, setAccessToken] = useState(null);

  // ------------------------------------------------------------
  // 1. LOAD USER ON APP START (using /me)
  // ------------------------------------------------------------
  const loadUser = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/auth/me", {
        credentials: "include",
      });

      // New access token might be sent via header
      const newAT = res.headers.get("x-access-token");
      if (newAT) setAccessToken(newAT);

      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  // ------------------------------------------------------------
  // 2. LOGIN
  // ------------------------------------------------------------
  const login = async ({ email, password }) => {
    const res = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Login failed");
    }

    setAccessToken(data.accessToken);
    setUser(data.user);

    return data;
  };

  // ------------------------------------------------------------
  // 3. LOGOUT
  // ------------------------------------------------------------
  const logout = async () => {
    await fetch("http://localhost:5000/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    setUser(null);
    setAccessToken(null);
  };

  // ------------------------------------------------------------
  // 4. UPDATE PROFILE
  // ------------------------------------------------------------
  const updateProfile = async (updates) => {
    const res = await fetch("http://localhost:5000/api/auth/me", {
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

    setUser(data.user);  // update local user

    return data;
  };

  // ------------------------------------------------------------
  // 5. UPDATE PASSWORD
  // ------------------------------------------------------------
  const updatePassword = async (oldPassword, newPassword) => {
    const res = await fetch("http://localhost:5000/api/auth/me/password", {
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
        loading,
        accessToken,
        login,
        logout,
        updateProfile,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
