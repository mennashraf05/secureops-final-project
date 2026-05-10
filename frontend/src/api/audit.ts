import { request } from './client';
import type { ApiResponse, AuditLog, AuditLogQueryParams } from '../types/audit';

function auditLogQuery(params?: AuditLogQueryParams) {
  const query = new URLSearchParams();

  if (params?.service_name) query.set('service_name', params.service_name);
  if (params?.action) query.set('action', params.action);
  if (params?.status) query.set('status', params.status);
  if (params?.user_id) query.set('user_id', String(params.user_id));
  if (params?.limit) query.set('limit', String(params.limit));

  const value = query.toString();
  return value ? `?${value}` : '';
}

function unwrap<T>(response: ApiResponse<T>) {
  if (!response.success) {
    throw new Error(response.message || 'Request failed. Please try again.');
  }

  return response.data;
}

export async function getAuditLogs(params?: AuditLogQueryParams) {
  const response = await request<ApiResponse<AuditLog[]>>(`/audit/logs${auditLogQuery(params)}`);
  return unwrap(response);
}

export async function getAuditLogById(id: number | string) {
  const response = await request<ApiResponse<AuditLog>>(`/audit/logs/${id}`);
  return unwrap(response);
}

export async function deleteAuditLog(id: number | string) {
  const response = await request<ApiResponse<unknown>>(`/audit/logs/${id}`, {
    method: 'DELETE',
  });
  return unwrap(response);
}
