import { request, type AuthUser } from './client';

export type AdminCreateUserPayload = {
  name: string;
  email: string;
  role: AuthUser['role'];
};

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export async function getUsers() {
  const response = await request<ApiResponse<AuthUser[]>>('/auth/users');
  return response.data;
}

export async function createUser(payload: AdminCreateUserPayload) {
  return request<ApiResponse<AuthUser>>('/auth/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(id: number) {
  return request<ApiResponse<AuthUser>>(`/auth/users/${id}`, {
    method: 'DELETE',
  });
}
