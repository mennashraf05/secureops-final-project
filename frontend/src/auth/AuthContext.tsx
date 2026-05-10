import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getMe, login, logout, register, verify2FA, verifyTotpSetup, type AuthUser, type LoginFlowData, type RegisterResponse } from '../api/client';

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginUser: (email: string, password: string) => Promise<LoginFlowData>;
  verifyTwoFactor: (email: string, code: string) => Promise<AuthUser>;
  verifyAuthenticatorSetup: (email: string, code: string) => Promise<AuthUser>;
  registerUser: (name: string, email: string, password: string) => Promise<RegisterResponse>;
  logoutUser: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
};

const TOKEN_STORAGE_KEY = 'secureops_token';
const USER_STORAGE_KEY = 'secureops_user';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser() {
  const rawUser = localStorage.getItem(USER_STORAGE_KEY);
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const storeAuth = useCallback((nextToken: string, nextUser: AuthUser) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_STORAGE_KEY)) {
      clearAuth();
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await getMe();
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
      setToken(localStorage.getItem(TOKEN_STORAGE_KEY));
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

  const loginUser = useCallback(
    async (email: string, password: string) => {
      const response = await login(email, password);
      return response.data;
    },
    [],
  );

  const verifyTwoFactor = useCallback(
    async (email: string, code: string) => {
      const response = await verify2FA(email, code);
      storeAuth(response.data.access_token, response.data.user);
      return response.data.user;
    },
    [storeAuth],
  );

  const verifyAuthenticatorSetup = useCallback(
    async (email: string, code: string) => {
      const response = await verifyTotpSetup(email, code);
      storeAuth(response.data.access_token, response.data.user);
      return response.data.user;
    },
    [storeAuth],
  );

  const registerUser = useCallback(async (name: string, email: string, password: string) => {
    const response = await register(name, email, password);
    return response.data;
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      if (localStorage.getItem(TOKEN_STORAGE_KEY)) {
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
      logoutUser,
      refreshCurrentUser,
    }),
    [isLoading, loginUser, logoutUser, refreshCurrentUser, registerUser, token, user, verifyAuthenticatorSetup, verifyTwoFactor],
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
