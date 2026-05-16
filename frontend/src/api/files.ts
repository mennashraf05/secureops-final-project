import { request, requestBlob, type ApiResponse } from './client';

export type SecureFile = {
  id: number;
  owner_user_id: number;
  original_filename: string;
  safe_filename: string;
  content_type: string;
  extension: string;
  size_bytes: number;
  plaintext_sha256: string;
  encrypted_sha256: string;
  encryption_algorithm: string;
  status: string;
  created_at: string;
  integrity_status: 'passed' | 'failed';
  download_url: string;
};

export type IntegrityResult = {
  file_id: number;
  integrity_status: 'passed' | 'failed';
  encrypted_sha256_matches: boolean;
};

const TOKEN_STORAGE_KEY = 'secureops_token';

function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) ?? sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

async function parseUploadError(response: Response) {
  try {
    const body = await response.json() as { message?: string; detail?: string };
    return body.message ?? body.detail ?? 'File upload failed.';
  } catch {
    return 'File upload failed.';
  }
}

export async function uploadSecureFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const headers = new Headers();
  const token = getStoredToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch('/files/upload', {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseUploadError(response));
  }

  return response.json() as Promise<ApiResponse<SecureFile>>;
}

export async function getSecureFiles() {
  const response = await request<ApiResponse<SecureFile[]>>('/files');
  return response.data;
}

export async function verifySecureFile(fileId: number) {
  const response = await request<ApiResponse<IntegrityResult>>(`/files/${fileId}/verify-integrity`, {
    method: 'POST',
  });
  return response;
}

export async function deleteSecureFile(fileId: number) {
  return request<ApiResponse<{ id: number }>>(`/files/${fileId}`, {
    method: 'DELETE',
  });
}

export async function downloadSecureFile(file: SecureFile) {
  const response = await requestBlob(file.download_url);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.safe_filename || file.original_filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
