import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  async function bootstrap() {
    try {
      const r = await api.whoami(); // hits /.netlify/functions/whoami
      if (r?.ok && r?.user) setUser(r.user);
    } catch { /* not logged in */ }
    setReady(true);
  }

  useEffect(() => { bootstrap(); }, []);

  async function login(email, password) {
    const r = await api.login(email, password);
    // After login, re-bootstrap to read cookie-based session
    await bootstrap();
    return r;
  }

  async function logout() {
    // Clear cookie by setting Max-Age=0 (add a tiny endpoint if you want).
    // For now, just clear client and reload.
    setUser(null);
    window.location.href = '/login';
  }

  const value = { user, ready, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
