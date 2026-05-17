import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AUTH_EXPIRED_EVENT, clearStoredAuth, getMe, getStoredToken, login, logout, register, verify2FA, verifyTotpSetup, type AuthUser, type LoginFlowData, type RegisterResponse } from '../api/client';

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginUser: (email: string, password: string) => Promise<LoginFlowData>;
  verifyTwoFactor: (email: string, code: string, rememberMe?: boolean) => Promise<AuthUser>;
  verifyAuthenticatorSetup: (email: string, code: string, rememberMe?: boolean) => Promise<AuthUser>;
  registerUser: (name: string, email: string, password: string) => Promise<RegisterResponse>;
  completeOAuthLogin: (token: string) => Promise<AuthUser>;
  logoutUser: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
};

const TOKEN_STORAGE_KEY = 'secureops_token';
const USER_STORAGE_KEY = 'secureops_user';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = useCallback(() => {
    clearStoredAuth();
    setToken(null);
    setUser(null);
  }, []);

  const storeAuth = useCallback((nextToken: string, nextUser: AuthUser, rememberMe = true) => {
    const primaryStorage = rememberMe ? localStorage : sessionStorage;
    const secondaryStorage = rememberMe ? sessionStorage : localStorage;
    secondaryStorage.removeItem(TOKEN_STORAGE_KEY);
    secondaryStorage.removeItem(USER_STORAGE_KEY);
    primaryStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    primaryStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const storedToken = getStoredToken();
    if (!storedToken) {
      clearAuth();
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await getMe();
      const activeStorage = localStorage.getItem(TOKEN_STORAGE_KEY) ? localStorage : sessionStorage;
      activeStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
      setToken(storedToken);
      setUser(currentUser);
    } catch {
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  }, [clearAuth]);

  useEffect(() => {
    void refreshCurrentUser();
  }, [refreshCurrentUser]);

  useEffect(() => {
    function handleAuthExpired() {
      clearAuth();
      setIsLoading(false);
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, [clearAuth]);

  const loginUser = useCallback(
    async (email: string, password: string) => {
      clearAuth();
      const response = await login(email, password);
      return response.data;
    },
    [clearAuth],
  );

  const verifyTwoFactor = useCallback(
    async (email: string, code: string, rememberMe = true) => {
      const response = await verify2FA(email, code, rememberMe);
      storeAuth(response.data.access_token, response.data.user, rememberMe);
      return response.data.user;
    },
    [storeAuth],
  );

  const verifyAuthenticatorSetup = useCallback(
    async (email: string, code: string, rememberMe = true) => {
      const response = await verifyTotpSetup(email, code, rememberMe);
      storeAuth(response.data.access_token, response.data.user, rememberMe);
      return response.data.user;
    },
    [storeAuth],
  );

  const registerUser = useCallback(async (name: string, email: string, password: string) => {
    const response = await register(name, email, password);
    return response.data;
  }, []);

  const completeOAuthLogin = useCallback(
    async (nextToken: string) => {
      localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
      const currentUser = await getMe();
      storeAuth(nextToken, currentUser, true);
      return currentUser;
    },
    [storeAuth],
  );

  const logoutUser = useCallback(async () => {
    try {
      if (localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY)) {
        await logout();
      }
    } catch {
      // Local logout should still complete for demo usability if the network is unavailable.
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      isLoading,
      loginUser,
      verifyTwoFactor,
      verifyAuthenticatorSetup,
      registerUser,
      completeOAuthLogin,
      logoutUser,
      refreshCurrentUser,
    }),
    [completeOAuthLogin, isLoading, loginUser, logoutUser, refreshCurrentUser, registerUser, token, user, verifyAuthenticatorSetup, verifyTwoFactor],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
