import React, { createContext, useContext, useState } from 'react';
import { api } from './api.js';

/*
 * Simple auth context.
 * Backend can bypass auth if DISABLE_AUTH=1 is set on Netlify.
 */

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
  }

  const value = { user, login, logout };
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
