import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  async function bootstrap() {
    try {
      const r = await api.whoami();
      if (r?.ok && r?.user) setUser(r.user);
      else setUser(null);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => { bootstrap(); }, []);

  async function login(email, password) {
    // if DISABLE_AUTH=1, backend returns ok without real check
    const r = await api.login(email, password);
    // refresh session from cookie
    await bootstrap();
    return r;
  }

  function logout() {
    // optional: add a /logout function to clear cookie; for now just reset client
    setUser(null);
    window.location.href = '/login';
  }

  const value = { user, ready, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
