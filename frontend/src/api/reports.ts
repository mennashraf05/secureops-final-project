import { request, requestBlob } from './client';
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

export async function createLowStockReport() {
  return request<ApiResponse<ReportJob>>('/reports/low-stock', {
    method: 'POST',
  });
}

export async function createSecurityReport() {
  return request<ApiResponse<ReportJob>>('/reports/security', {
    method: 'POST',
  });
}

export async function createAuditReport() {
  return request<ApiResponse<ReportJob>>('/reports/audit', {
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

function filenameFromContentDisposition(value: string | null, fallback: string) {
  if (!value) return fallback;

  const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1].replace(/"/g, ''));

  const match = value.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

export async function downloadReport(jobId: number) {
  const response = await requestBlob(`/reports/jobs/${jobId}/download`);
  const blob = await response.blob();
  const filename = filenameFromContentDisposition(
    response.headers.get('Content-Disposition'),
    `report_job_${jobId}.txt`,
  );
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
