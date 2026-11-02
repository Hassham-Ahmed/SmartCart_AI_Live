import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { getToken, setToken, setUnauthorizedHandler } from "../api/client";

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    // Sessions created before token auth existed have no token: treat as logged out
    // so the user signs in again instead of hitting 401s everywhere.
    return raw && getToken() ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  const login = useCallback((userData, token) => {
    setToken(token);
    try {
      localStorage.setItem("user", JSON.stringify(userData));
    } catch {
      /* ignore */
    }
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    try {
      ["user", "isLoggedIn", "userName"].forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  // Expired/invalid token anywhere in the app -> clean logout.
  useEffect(() => {
    setUnauthorizedHandler(() => logout());
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const value = {
    user,
    login,
    logout,
    isLoggedIn: !!user,
    isAdmin: user?.role === "admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
