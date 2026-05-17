export type UserRole = 'admin' | 'user';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  email_verified: boolean;
  two_factor_enabled: boolean;
  two_factor_required: boolean;
  two_factor_method: 'email' | 'authenticator';
  created_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: AuthUser;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type RegisterResponse = {
  email: string;
  email_verification_required: boolean;
};

export type LoginFlowData = {
  email: string;
  email_verification_required?: boolean;
  two_factor_required?: boolean;
  two_factor_setup_required?: boolean;
  totp_secret?: string;
  otpauth_uri?: string;
};

type ApiErrorBody = {
  detail?: string | { msg?: string }[];
  message?: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const TOKEN_STORAGE_KEY = 'secureops_token';
const USER_STORAGE_KEY = 'secureops_user';
const LEGACY_TOKEN_STORAGE_KEYS = ['access_token', 'token', 'authToken'];
export const AUTH_EXPIRED_EVENT = 'secureops-auth-expired';

function buildUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

function storageToken(storage: Storage) {
  const currentToken = storage.getItem(TOKEN_STORAGE_KEY);
  if (currentToken) return currentToken;

  const legacyToken = LEGACY_TOKEN_STORAGE_KEYS
    .map((key) => storage.getItem(key))
    .find((value): value is string => Boolean(value));

  if (legacyToken) {
    storage.setItem(TOKEN_STORAGE_KEY, legacyToken);
  }

  return legacyToken ?? null;
}

export function getStoredToken() {
  return storageToken(localStorage) ?? storageToken(sessionStorage);
}

export function getAuthHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const token = getStoredToken();

  if (token) {
    nextHeaders.set('Authorization', `Bearer ${token}`);
  }

  return nextHeaders;
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(USER_STORAGE_KEY);

  for (const key of LEGACY_TOKEN_STORAGE_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

function isAuthFlowPath(path: string) {
  return path.startsWith('/auth/login')
    || path.startsWith('/auth/register')
    || path.startsWith('/auth/verify-email')
    || path.startsWith('/auth/resend-verification')
    || path.startsWith('/auth/password/')
    || path.startsWith('/auth/set-password')
    || path.startsWith('/auth/2fa/');
}

function isSessionCheckPath(path: string) {
  return path === '/auth/me';
}

function notifyAuthExpired(path: string, failedToken: string | null) {
  const currentToken = getStoredToken();
  if (failedToken && currentToken && failedToken !== currentToken) {
    return;
  }

  clearStoredAuth();
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  if (!isAuthFlowPath(path) && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

async function parseError(response: Response) {
  let body: ApiErrorBody | null = null;

  try {
    body = await response.json();
  } catch {
    return 'Request failed. Please try again.';
  }

  if (typeof body?.detail === 'string') {
    return body.detail;
  }

  if (Array.isArray(body?.detail) && body.detail[0]?.msg) {
    return body.detail[0].msg;
  }

  return body?.message ?? 'Request failed. Please try again.';
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const requestToken = getStoredToken();
  const headers = getAuthHeaders(options.headers);

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await parseError(response);
    if (response.status === 401 && isSessionCheckPath(path)) {
      notifyAuthExpired(path, requestToken);
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function requestBlob(path: string, options: RequestInit = {}) {
  const requestToken = getStoredToken();
  const headers = getAuthHeaders(options.headers);

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await parseError(response);
    if (response.status === 401 && isSessionCheckPath(path)) {
      notifyAuthExpired(path, requestToken);
    }
    throw new Error(message);
  }

  return response;
}

export function login(email: string, password: string) {
  return request<ApiResponse<LoginFlowData>>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(name: string, email: string, password: string) {
  return request<ApiResponse<RegisterResponse>>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export function verifyEmail(email: string, code: string) {
  return request<ApiResponse<{ email: string }>>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export function resendVerification(email: string) {
  return request<ApiResponse<RegisterResponse>>('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function setPassword(email: string, code: string, password: string) {
  return request<ApiResponse<LoginFlowData>>('/auth/set-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, password }),
  });
}

export function verify2FA(email: string, code: string, remember_me = false) {
  return request<ApiResponse<TokenResponse>>('/auth/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code, remember_me }),
  });
}

export function verifyTotpSetup(email: string, code: string, remember_me = false) {
  return request<ApiResponse<TokenResponse>>('/auth/2fa/setup/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code, remember_me }),
  });
}

export function getMe() {
  return request<AuthUser>('/auth/me');
}

export function updateProfile(name: string) {
  return request<ApiResponse<AuthUser>>('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function changePassword(current_password: string, new_password: string) {
  return request<ApiResponse<Record<string, never>>>('/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({ current_password, new_password }),
  });
}

export function forgotPassword(email: string) {
  return request<ApiResponse<Record<string, never>>>('/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(email: string, code: string, new_password: string) {
  return request<ApiResponse<Record<string, never>>>('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ email, code, new_password }),
  });
}

export function logout() {
  return request<{ success: boolean; message: string; data: unknown }>('/auth/logout', {
    method: 'POST',
  });
}
