import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setCsrf, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false); // true right after the person signed out on purpose

  // who am I? (the session lives in an HttpOnly cookie)
  useEffect(() => {
    api('/auth/me')
      .then((d) => { if (d.user) { setCsrf(d.csrf); setUser(d.user); } })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  // a 401 from any API call means the session expired
  useEffect(() => { setUnauthorizedHandler(() => { setCsrf(''); setUser(null); }); }, []);

  const start = useCallback((d) => { setCsrf(d.csrf); setUser(d.user); setLoggedOut(false); }, []);

  const value = useMemo(() => ({
    user,
    ready,
    loggedOut,
    setUser,
    login: async (email, password) => start(await api('/auth/login', { method: 'POST', body: { email, password } })),
    signup: async (form) => start(await api('/auth/signup', { method: 'POST', body: form })),
    logout: async () => {
      try { await api('/auth/logout', { method: 'POST' }); } catch { /* already signed out */ }
      setCsrf('');
      setLoggedOut(true);
      setUser(null);
    },
  }), [user, ready, loggedOut, start]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
