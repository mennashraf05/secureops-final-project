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

function buildUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
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
  const headers = new Headers(options.headers);
  const token = getStoredToken();

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<T>;
}

export async function requestBlob(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const token = getStoredToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
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

export function verify2FA(email: string, code: string) {
  return request<ApiResponse<TokenResponse>>('/auth/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export function verifyTotpSetup(email: string, code: string) {
  return request<ApiResponse<TokenResponse>>('/auth/2fa/setup/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export function getMe() {
  return request<AuthUser>('/auth/me');
}

export function logout() {
  return request<{ success: boolean; message: string; data: unknown }>('/auth/logout', {
    method: 'POST',
  });
}
