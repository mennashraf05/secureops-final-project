import { request } from './client';
import type { ApiResponse, MonitoringSummary, RiskLevel, SecurityCharts, SecurityOverview, UserRiskDetails, UserRiskScore } from '../types/monitoring';

function unwrap<T>(response: ApiResponse<T>) {
  if (!response.success) {
    throw new Error(response.message || 'Request failed. Please try again.');
  }

  return response.data;
}

export async function getMonitoringSummary() {
  const response = await request<ApiResponse<MonitoringSummary>>('/audit/monitoring/summary');
  return unwrap(response);
}

export async function getSecurityOverview() {
  const response = await request<ApiResponse<SecurityOverview>>('/audit/security/overview');
  return unwrap(response);
}

export async function getSecurityCharts() {
  const response = await request<ApiResponse<SecurityCharts>>('/audit/security/charts');
  return unwrap(response);
}

export async function getUserRiskScores(params?: { limit?: number; risk_level?: RiskLevel | 'all' }) {
  const query = new URLSearchParams();

  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.risk_level && params.risk_level !== 'all') query.set('risk_level', params.risk_level);

  const response = await request<ApiResponse<UserRiskScore[]>>(`/audit/security/user-risk${query.toString() ? `?${query}` : ''}`);
  return unwrap(response);
}

export async function getUserRiskDetails(userId: number | 'system') {
  const response = await request<ApiResponse<UserRiskDetails>>(`/audit/security/user-risk/${userId}`);
  return unwrap(response);
}

export async function dismissSecurityAlert(auditLogId: number, reason = 'Reviewed by admin') {
  const response = await request<ApiResponse<unknown>>(`/audit/security/alerts/${auditLogId}/dismiss`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return unwrap(response);
}
