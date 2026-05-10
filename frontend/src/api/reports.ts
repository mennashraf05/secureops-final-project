import { request } from './client';
import type { ApiResponse, ReportJob, ReportJobQueryParams } from '../types/report';

function reportJobQuery(params?: ReportJobQueryParams) {
  const query = new URLSearchParams();

  if (params?.status) query.set('status', params.status);

  const value = query.toString();
  return value ? `?${value}` : '';
}

function unwrap<T>(response: ApiResponse<T>) {
  if (!response.success) {
    throw new Error(response.message || 'Request failed. Please try again.');
  }

  return response.data;
}

export async function createInventoryReport() {
  return request<ApiResponse<ReportJob>>('/reports/inventory', {
    method: 'POST',
  });
}

export async function getReportJobs(params?: ReportJobQueryParams) {
  const response = await request<ApiResponse<ReportJob[]>>(`/reports/jobs${reportJobQuery(params)}`);
  return unwrap(response);
}

export async function getReportJobById(id: number | string) {
  const response = await request<ApiResponse<ReportJob>>(`/reports/jobs/${id}`);
  return unwrap(response);
}
