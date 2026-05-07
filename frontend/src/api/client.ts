export type UserRole = 'admin' | 'user';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: AuthUser;
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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

export function login(email: string, password: string) {
  return request<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(name: string, email: string, password: string) {
  return request<AuthUser>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
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
