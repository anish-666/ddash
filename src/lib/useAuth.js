import React, { createContext, useContext, useState } from 'react';
import { api } from './api.js';

/*
 * A simple authentication context.  In this example
 * authentication is optional and can be bypassed by
 * setting DISABLE_AUTH=1 on the backend.  When
 * DISABLE_AUTH is set, login() simply returns the
 * provided email.  In a real application you would
 * implement proper sessions, cookies, JWTs, etc.
 */

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  async function login(email, password) {
    // Attempt to authenticate via the API.  The API
    // returns the user object on success.
    const data = await api.login(email, password);
    setUser(data);
    return data;
  }

  function logout() {
    // Clear user state.  In a real app you would also
    // remove session cookies.  Here we simply reset
    // user to null.
    setUser(null);
  }

  const value = { user, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}