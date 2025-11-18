import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const API = process.env.REACT_APP_API_URL || "http://localhost:8081";
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    axios.defaults.baseURL = API;
    axios.interceptors.request.use((config) => {
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }, [API, token]);

  const login = async (email, password) => {
    const { data } = await axios.post("/api/auth/login", { email, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
  };

  const logout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const getMyPermissions = useCallback(async () => {
    if (!token) return {};
    try {
      const { data } = await axios.get("/api/permissions/my");
      return data || {};
    } catch { return {}; }
  }, [token]);

  return (
    <AuthCtx.Provider value={{ token, user, login, logout, getMyPermissions }}>
      {children}
    </AuthCtx.Provider>
  );
}
