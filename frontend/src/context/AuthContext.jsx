import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { auth } from "../api/services";
import { setUnauthorizedHandler, tokenStore } from "../api/client";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!tokenStore.get());

  const clear = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    if (!tokenStore.get()) return;
    auth
      .me()
      .then(setUser)
      .catch(clear)
      .finally(() => setReady(true));
  }, [clear]);

  const finish = useCallback((response) => {
    tokenStore.set(response.token);
    setUser(response.user);
    return response.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      isAdmin: user?.role === "ADMIN",
      login: async (email, password) => finish(await auth.login(email, password)),
      register: async (name, email, password) => finish(await auth.register(name, email, password)),
      logout: async () => {
        await auth.logout().catch(() => {});
        clear();
      },
    }),
    [user, ready, finish, clear]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
