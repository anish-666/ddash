import React, { createContext, useContext, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  async function login(email, password) {
    const data = await api.login(email, password);
    setUser(data);
    return data;
  }

  function logout() {
    setUser(null);
    // optionally call a logout function to clear cookie server-side later
  }

  const value = { user, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
